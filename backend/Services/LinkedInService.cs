using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class LinkedInService
{
    private const string LinkedInApiBase = "https://api.linkedin.com/v2";
    private const string LinkedInTokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";

    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public LinkedInService(IConfiguration config, IHttpClientFactory httpFactory)
    {
        _config = config;
        _httpFactory = httpFactory;
    }

    private static byte[] GetMediaBytes(Media m)
    {
        if (m.Data != null && m.Data.Length > 0) return m.Data;
        if (!string.IsNullOrEmpty(m.FilePath) && File.Exists(m.FilePath))
            return File.ReadAllBytes(m.FilePath);
        return Array.Empty<byte>();
    }

    public async Task<bool> RefreshAccessToken(User user, AppDbContext db, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(user.RefreshToken)) return false;

        try
        {
            var client = _httpFactory.CreateClient();
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = user.RefreshToken,
                ["client_id"] = _config["LinkedIn:ClientId"] ?? "",
                ["client_secret"] = _config["LinkedIn:ClientSecret"] ?? "",
            });

            var resp = await client.PostAsync(LinkedInTokenUrl, content, ct);
            if (!resp.IsSuccessStatusCode) return false;

            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            user.AccessToken = root.GetProperty("access_token").GetString();
            if (root.TryGetProperty("refresh_token", out var rt))
                user.RefreshToken = rt.GetString();
            var expiresIn = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
            user.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
            user.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Auth] Token refresh failed: {ex.Message}");
            return false;
        }
    }

    public async Task<string?> GetValidAccessToken(User user, AppDbContext db, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(user.AccessToken)) return null;
        if (user.AccessToken == "dev-token") return "dev-token";

        if (user.TokenExpiresAt.HasValue &&
            DateTime.UtcNow >= user.TokenExpiresAt.Value.AddMinutes(-5))
        {
            var success = await RefreshAccessToken(user, db, ct);
            if (!success) return null;
        }

        return user.AccessToken;
    }

    public async Task<string> PublishTextPost(string accessToken, string authorUrn, string text, CancellationToken ct = default)
    {
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var jsonPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["author"] = authorUrn,
            ["lifecycleState"] = "PUBLISHED",
            ["specificContent"] = new Dictionary<string, object>
            {
                ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                {
                    ["shareCommentary"] = new Dictionary<string, string> { ["text"] = text },
                    ["shareMediaCategory"] = "NONE"
                }
            },
            ["visibility"] = new Dictionary<string, string>
            {
                ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
            }
        });

        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInApiBase}/ugcPosts", content, ct);
        resp.EnsureSuccessStatusCode();
        var respJson = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(respJson);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public async Task<string> UploadImage(string accessToken, string authorUrn, byte[] imageData, CancellationToken ct = default)
    {
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var registerPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["registerUploadRequest"] = new Dictionary<string, object>
            {
                ["recipes"] = new[] { "urn:li:digitalmediaRecipe:feedshare-image" },
                ["owner"] = authorUrn,
                ["serviceRelationships"] = new[]
                {
                    new Dictionary<string, string>
                    {
                        ["relationshipType"] = "OWNER",
                        ["identifier"] = "urn:li:userGeneratedContent"
                    }
                }
            }
        });

        var registerContent = new StringContent(registerPayload, Encoding.UTF8, "application/json");
        var registerResp = await client.PostAsync($"{LinkedInApiBase}/assets?action=registerUpload", registerContent, ct);
        registerResp.EnsureSuccessStatusCode();
        var registerJson = await registerResp.Content.ReadAsStringAsync(ct);
        using var registerDoc = JsonDocument.Parse(registerJson);
        var value = registerDoc.RootElement.GetProperty("value");
        var uploadUrl = value.GetProperty("uploadMechanism")
            .GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest")
            .GetProperty("uploadUrl").GetString()!;
        var asset = value.GetProperty("asset").GetString()!;

        // Upload binary
        var uploadClient = _httpFactory.CreateClient();
        uploadClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var byteContent = new ByteArrayContent(imageData);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var uploadResp = await uploadClient.PutAsync(uploadUrl, byteContent, ct);
        uploadResp.EnsureSuccessStatusCode();

        return asset;
    }

    public async Task<string> PublishImagePost(string accessToken, string authorUrn, string text, byte[] imageData, CancellationToken ct = default)
    {
        var asset = await UploadImage(accessToken, authorUrn, imageData, ct);

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var jsonPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["author"] = authorUrn,
            ["lifecycleState"] = "PUBLISHED",
            ["specificContent"] = new Dictionary<string, object>
            {
                ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                {
                    ["shareCommentary"] = new Dictionary<string, string> { ["text"] = text },
                    ["shareMediaCategory"] = "IMAGE",
                    ["media"] = new[]
                    {
                        new Dictionary<string, string>
                        {
                            ["status"] = "READY",
                            ["media"] = asset
                        }
                    }
                }
            },
            ["visibility"] = new Dictionary<string, string>
            {
                ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
            }
        });

        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInApiBase}/ugcPosts", content, ct);
        resp.EnsureSuccessStatusCode();
        var respJson = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(respJson);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public async Task<string> PublishMultiImagePost(string accessToken, string authorUrn, string text, List<byte[]> imageDataList, CancellationToken ct = default)
    {
        var assets = new List<string>();
        foreach (var imageData in imageDataList)
        {
            var asset = await UploadImage(accessToken, authorUrn, imageData, ct);
            assets.Add(asset);
        }

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var mediaArray = assets.Select(a => new Dictionary<string, string>
        {
            ["status"] = "READY",
            ["media"] = a
        }).ToArray();

        var jsonPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["author"] = authorUrn,
            ["lifecycleState"] = "PUBLISHED",
            ["specificContent"] = new Dictionary<string, object>
            {
                ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                {
                    ["shareCommentary"] = new Dictionary<string, string> { ["text"] = text },
                    ["shareMediaCategory"] = "IMAGE",
                    ["media"] = mediaArray
                }
            },
            ["visibility"] = new Dictionary<string, string>
            {
                ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
            }
        });

        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInApiBase}/ugcPosts", content, ct);
        resp.EnsureSuccessStatusCode();
        var respJson = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(respJson);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public async Task<string> UploadVideo(string accessToken, string authorUrn, byte[] videoData, CancellationToken ct = default)
    {
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        // Register upload with video recipe
        var registerPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["registerUploadRequest"] = new Dictionary<string, object>
            {
                ["recipes"] = new[] { "urn:li:digitalmediaRecipe:feedshare-video" },
                ["owner"] = authorUrn,
                ["serviceRelationships"] = new[]
                {
                    new Dictionary<string, string>
                    {
                        ["relationshipType"] = "OWNER",
                        ["identifier"] = "urn:li:userGeneratedContent"
                    }
                }
            }
        });

        var registerContent = new StringContent(registerPayload, Encoding.UTF8, "application/json");
        var registerResp = await client.PostAsync($"{LinkedInApiBase}/assets?action=registerUpload", registerContent, ct);
        registerResp.EnsureSuccessStatusCode();
        var registerJson = await registerResp.Content.ReadAsStringAsync(ct);
        using var registerDoc = JsonDocument.Parse(registerJson);
        var value = registerDoc.RootElement.GetProperty("value");
        var uploadUrl = value.GetProperty("uploadMechanism")
            .GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest")
            .GetProperty("uploadUrl").GetString()!;
        var asset = value.GetProperty("asset").GetString()!;

        // Upload binary
        var uploadClient = _httpFactory.CreateClient();
        uploadClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        uploadClient.Timeout = TimeSpan.FromMinutes(10);
        var byteContent = new ByteArrayContent(videoData);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var uploadResp = await uploadClient.PutAsync(uploadUrl, byteContent, ct);
        uploadResp.EnsureSuccessStatusCode();

        // Poll until processing is complete (ALLOWED status)
        var assetId = asset.Replace("urn:li:digitalmediaAsset:", "");
        var pollClient = _httpFactory.CreateClient();
        pollClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        pollClient.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var timeout = DateTime.UtcNow.AddMinutes(5);
        while (DateTime.UtcNow < timeout)
        {
            await Task.Delay(5000, ct);
            var statusResp = await pollClient.GetAsync($"{LinkedInApiBase}/assets/{assetId}", ct);
            if (statusResp.IsSuccessStatusCode)
            {
                var statusJson = await statusResp.Content.ReadAsStringAsync(ct);
                using var statusDoc = JsonDocument.Parse(statusJson);
                var recipes = statusDoc.RootElement.GetProperty("recipes");
                foreach (var recipe in recipes.EnumerateArray())
                {
                    if (recipe.TryGetProperty("status", out var s) && s.GetString() == "AVAILABLE")
                        return asset;
                }
            }
        }

        // Return asset even if polling times out — LinkedIn may still process it
        Console.WriteLine($"[LinkedIn] Video processing poll timed out for asset {asset}");
        return asset;
    }

    public async Task<string> PublishVideoPost(string accessToken, string authorUrn, string text, Media videoMedia, CancellationToken ct = default)
    {
        var videoData = GetMediaBytes(videoMedia);
        var asset = await UploadVideo(accessToken, authorUrn, videoData, ct);

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var jsonPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["author"] = authorUrn,
            ["lifecycleState"] = "PUBLISHED",
            ["specificContent"] = new Dictionary<string, object>
            {
                ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                {
                    ["shareCommentary"] = new Dictionary<string, string> { ["text"] = text },
                    ["shareMediaCategory"] = "VIDEO",
                    ["media"] = new[]
                    {
                        new Dictionary<string, string>
                        {
                            ["status"] = "READY",
                            ["media"] = asset
                        }
                    }
                }
            },
            ["visibility"] = new Dictionary<string, string>
            {
                ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
            }
        });

        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInApiBase}/ugcPosts", content, ct);
        resp.EnsureSuccessStatusCode();
        var respJson = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(respJson);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public async Task<string> UploadDocument(string accessToken, string authorUrn, byte[] documentData, CancellationToken ct = default)
    {
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var registerPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["registerUploadRequest"] = new Dictionary<string, object>
            {
                ["recipes"] = new[] { "urn:li:digitalmediaRecipe:feedshare-document" },
                ["owner"] = authorUrn,
                ["serviceRelationships"] = new[]
                {
                    new Dictionary<string, string>
                    {
                        ["relationshipType"] = "OWNER",
                        ["identifier"] = "urn:li:userGeneratedContent"
                    }
                }
            }
        });

        var registerContent = new StringContent(registerPayload, Encoding.UTF8, "application/json");
        var registerResp = await client.PostAsync($"{LinkedInApiBase}/assets?action=registerUpload", registerContent, ct);
        registerResp.EnsureSuccessStatusCode();
        var registerJson = await registerResp.Content.ReadAsStringAsync(ct);
        using var registerDoc = JsonDocument.Parse(registerJson);
        var value = registerDoc.RootElement.GetProperty("value");
        var uploadUrl = value.GetProperty("uploadMechanism")
            .GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest")
            .GetProperty("uploadUrl").GetString()!;
        var asset = value.GetProperty("asset").GetString()!;

        // Upload binary
        var uploadClient = _httpFactory.CreateClient();
        uploadClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        uploadClient.Timeout = TimeSpan.FromMinutes(5);
        var byteContent = new ByteArrayContent(documentData);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var uploadResp = await uploadClient.PutAsync(uploadUrl, byteContent, ct);
        uploadResp.EnsureSuccessStatusCode();

        return asset;
    }

    public async Task<string> PublishDocumentPost(string accessToken, string authorUrn, string text, Media documentMedia, CancellationToken ct = default)
    {
        var documentData = GetMediaBytes(documentMedia);
        var asset = await UploadDocument(accessToken, authorUrn, documentData, ct);

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var jsonPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["author"] = authorUrn,
            ["lifecycleState"] = "PUBLISHED",
            ["specificContent"] = new Dictionary<string, object>
            {
                ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                {
                    ["shareCommentary"] = new Dictionary<string, string> { ["text"] = text },
                    ["shareMediaCategory"] = "NATIVE_DOCUMENT",
                    ["media"] = new[]
                    {
                        new Dictionary<string, string>
                        {
                            ["status"] = "READY",
                            ["media"] = asset
                        }
                    }
                }
            },
            ["visibility"] = new Dictionary<string, string>
            {
                ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
            }
        });

        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInApiBase}/ugcPosts", content, ct);
        resp.EnsureSuccessStatusCode();
        var respJson = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(respJson);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public async Task<string> PostComment(string accessToken, string postUrn, string authorUrn, string text, CancellationToken ct = default)
    {
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var payload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["actor"] = authorUrn,
            ["message"] = new Dictionary<string, string> { ["text"] = text }
        });

        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInApiBase}/socialActions/{Uri.EscapeDataString(postUrn)}/comments", content, ct);
        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public static string StripHtml(string html)
    {
        var text = Regex.Replace(html, @"<br\s*/?>", "\n");
        text = Regex.Replace(text, @"</p>\s*<p>", "\n\n");
        text = Regex.Replace(text, @"<li>", "- ");
        text = Regex.Replace(text, @"</li>", "\n");
        text = Regex.Replace(text, @"<[^>]+>", "");
        return text.Trim();
    }

    public async Task<bool> PublishPost(Post post, User user, AppDbContext db, CancellationToken ct = default)
    {
        try
        {
            post.Status = "publishing";
            await db.SaveChangesAsync(ct);

            // Ensure token is valid before publishing
            var accessToken = await GetValidAccessToken(user, db, ct);
            if (accessToken == null)
            {
                post.Status = "failed";
                post.ErrorMessage = "LinkedIn access token is missing or refresh failed. Please re-authenticate.";
                await db.SaveChangesAsync(ct);
                return false;
            }

            var authorUrn = $"urn:li:person:{user.LinkedInId}";
            var plainText = StripHtml(post.Content);

            string postUrn;

            // Check post_media junction for multi-attachment support
            var postMedia = post.PostMedia?.Where(pm => pm.Media != null).OrderBy(pm => pm.Position).ToList();
            if (postMedia == null || postMedia.Count == 0)
            {
                // Try loading from DB if not already included
                postMedia = await db.PostMedia
                    .Where(pm => pm.PostId == post.Id)
                    .OrderBy(pm => pm.Position)
                    .Include(pm => pm.Media)
                    .ToListAsync(ct);
            }

            if (postMedia.Count > 0)
            {
                var mediaType = postMedia[0].Media.MediaType;
                postUrn = mediaType switch
                {
                    "video" => await PublishVideoPost(accessToken, authorUrn, plainText, postMedia[0].Media, ct),
                    "document" => await PublishDocumentPost(accessToken, authorUrn, plainText, postMedia[0].Media, ct),
                    "image" when postMedia.Count == 1 => await PublishImagePost(accessToken, authorUrn, plainText, GetMediaBytes(postMedia[0].Media), ct),
                    "image" => await PublishMultiImagePost(accessToken, authorUrn, plainText, postMedia.Select(pm => GetMediaBytes(pm.Media)).ToList(), ct),
                    _ => await PublishTextPost(accessToken, authorUrn, plainText, ct)
                };
            }
            else if (post.Image != null && post.Image.Data != null && post.Image.Data.Length > 0)
                postUrn = await PublishImagePost(accessToken, authorUrn, plainText, post.Image.Data, ct);
            else
                postUrn = await PublishTextPost(accessToken, authorUrn, plainText, ct);

            post.LinkedInPostUrn = postUrn;
            post.LinkedInPostId = postUrn;
            post.PublishedAt = DateTime.UtcNow;
            post.Status = "published";
            post.ErrorMessage = null;

            if (post.FirstComment != null && !string.IsNullOrEmpty(post.FirstComment.Content))
            {
                try
                {
                    var commentId = await PostComment(accessToken, postUrn, authorUrn, post.FirstComment.Content, ct);
                    post.FirstComment.LinkedInCommentId = commentId;
                    post.FirstComment.Posted = 1;
                }
                catch (Exception ex)
                {
                    post.ErrorMessage = $"Post published but first comment failed: {ex.Message}";
                }
            }

            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (HttpRequestException ex)
        {
            post.Status = "failed";
            var statusCode = (int?)ex.StatusCode;
            if (statusCode == 429)
                post.ErrorMessage = "LinkedIn rate limit exceeded. Try again later.";
            else if (statusCode == 401)
                post.ErrorMessage = "LinkedIn access token expired. Please re-authenticate.";
            else
                post.ErrorMessage = $"LinkedIn API error ({statusCode}): {ex.Message[..Math.Min(ex.Message.Length, 500)]}";
            await db.SaveChangesAsync(ct);
            return false;
        }
        catch (Exception ex)
        {
            post.Status = "failed";
            post.ErrorMessage = $"Publishing failed: {ex.Message[..Math.Min(ex.Message.Length, 500)]}";
            await db.SaveChangesAsync(ct);
            return false;
        }
    }

    public async Task<Dictionary<string, int>> FetchLinkedInAnalytics(Post post, User user, AppDbContext db, CancellationToken ct = default)
    {
        var accessToken = await GetValidAccessToken(user, db, ct);

        if (string.IsNullOrEmpty(accessToken) || accessToken == "dev-token")
        {
            var rng = new Random();
            return new Dictionary<string, int>
            {
                ["impressions"] = rng.Next(50, 5000),
                ["likes"] = rng.Next(0, 200),
                ["comments"] = rng.Next(0, 50),
                ["shares"] = rng.Next(0, 30),
            };
        }

        int likes = 0, comments = 0, shares = 0, impressions = 0;

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        try
        {
            var resp = await client.GetAsync($"{LinkedInApiBase}/socialActions/{Uri.EscapeDataString(post.LinkedInPostUrn!)}", ct);
            if (resp.IsSuccessStatusCode)
            {
                var json = await resp.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (root.TryGetProperty("likesSummary", out var ls) && ls.TryGetProperty("totalLikes", out var tl))
                    likes = tl.GetInt32();
                if (root.TryGetProperty("commentsSummary", out var cs) && cs.TryGetProperty("totalFirstLevelComments", out var tc))
                    comments = tc.GetInt32();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Analytics] socialActions fetch failed for post {post.Id}: {ex.Message}");
        }

        try
        {
            var shareUrn = post.LinkedInPostUrn ?? post.LinkedInPostId;
            if (!string.IsNullOrEmpty(shareUrn))
            {
                var resp = await client.GetAsync($"{LinkedInApiBase}/socialActions/{Uri.EscapeDataString(shareUrn)}/statistics", ct);
                if (resp.IsSuccessStatusCode)
                {
                    var json = await resp.Content.ReadAsStringAsync(ct);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("totalShareStatistics", out var tss))
                    {
                        if (tss.TryGetProperty("impressionCount", out var ic)) impressions = ic.GetInt32();
                        if (tss.TryGetProperty("shareCount", out var sc)) shares = sc.GetInt32();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Analytics] Share statistics fetch failed for post {post.Id}: {ex.Message}");
        }

        return new Dictionary<string, int>
        {
            ["impressions"] = impressions,
            ["likes"] = likes,
            ["comments"] = comments,
            ["shares"] = shares,
        };
    }
}
