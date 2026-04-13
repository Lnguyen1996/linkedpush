using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using PostizApi.Data;
using PostizApi.Models;

namespace PostizApi.Services;

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

    public async Task<bool> RefreshAccessToken(User user, AppDbContext db)
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

            var resp = await client.PostAsync(LinkedInTokenUrl, content);
            if (!resp.IsSuccessStatusCode) return false;

            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            user.AccessToken = root.GetProperty("access_token").GetString();
            if (root.TryGetProperty("refresh_token", out var rt))
                user.RefreshToken = rt.GetString();
            var expiresIn = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
            user.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
            user.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Auth] Token refresh failed: {ex.Message}");
            return false;
        }
    }

    public async Task<string?> GetValidAccessToken(User user, AppDbContext db)
    {
        if (string.IsNullOrEmpty(user.AccessToken)) return null;
        if (user.AccessToken == "dev-token") return "dev-token";

        if (user.TokenExpiresAt.HasValue &&
            DateTime.UtcNow >= user.TokenExpiresAt.Value.AddMinutes(-5))
        {
            var success = await RefreshAccessToken(user, db);
            if (!success) return null;
        }

        return user.AccessToken;
    }

    public Task<string> GetUserUrn(string accessToken)
    {
        // Decode the JWT access token to extract the 'sub' claim (member ID)
        var parts = accessToken.Split('.');
        if (parts.Length >= 2)
        {
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            switch (payload.Length % 4)
            {
                case 2: payload += "=="; break;
                case 3: payload += "="; break;
            }
            var payloadBytes = Convert.FromBase64String(payload);
            using var doc = System.Text.Json.JsonDocument.Parse(payloadBytes);
            var sub = doc.RootElement.GetProperty("sub").GetString();
            return Task.FromResult($"urn:li:person:{sub}");
        }

        throw new InvalidOperationException("Unable to extract user ID from access token");
    }

    public async Task<string> PublishTextPost(string accessToken, string authorUrn, string text)
    {
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

        var payload = new
        {
            author = authorUrn,
            lifecycleState = "PUBLISHED",
            specificContent = new
            {
                ShareContent = new
                {
                    shareCommentary = new { text },
                    shareMediaCategory = "NONE"
                }
            },
            visibility = new
            {
                MemberNetworkVisibility = "PUBLIC"
            }
        };

        // Build JSON manually for exact LinkedIn API field names
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
        var resp = await client.PostAsync($"{LinkedInApiBase}/ugcPosts", content);
        resp.EnsureSuccessStatusCode();
        var respJson = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(respJson);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public async Task<string> UploadImage(string accessToken, string authorUrn, string imagePath)
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
        var registerResp = await client.PostAsync($"{LinkedInApiBase}/assets?action=registerUpload", registerContent);
        registerResp.EnsureSuccessStatusCode();
        var registerJson = await registerResp.Content.ReadAsStringAsync();
        using var registerDoc = JsonDocument.Parse(registerJson);
        var value = registerDoc.RootElement.GetProperty("value");
        var uploadUrl = value.GetProperty("uploadMechanism")
            .GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest")
            .GetProperty("uploadUrl").GetString()!;
        var asset = value.GetProperty("asset").GetString()!;

        // Upload binary
        var imageData = await File.ReadAllBytesAsync(imagePath);
        var uploadClient = _httpFactory.CreateClient();
        uploadClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var byteContent = new ByteArrayContent(imageData);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        var uploadResp = await uploadClient.PutAsync(uploadUrl, byteContent);
        uploadResp.EnsureSuccessStatusCode();

        return asset;
    }

    public async Task<string> PublishImagePost(string accessToken, string authorUrn, string text, string imagePath)
    {
        var asset = await UploadImage(accessToken, authorUrn, imagePath);

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
        var resp = await client.PostAsync($"{LinkedInApiBase}/ugcPosts", content);
        resp.EnsureSuccessStatusCode();
        var respJson = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(respJson);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
    }

    public async Task<string> PostComment(string accessToken, string postUrn, string authorUrn, string text)
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
        var resp = await client.PostAsync($"{LinkedInApiBase}/socialActions/{Uri.EscapeDataString(postUrn)}/comments", content);
        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync();
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

    public async Task<bool> PublishPost(Post post, User user, AppDbContext db)
    {
        try
        {
            post.Status = "publishing";
            await db.SaveChangesAsync();

            // Ensure token is valid before publishing
            var accessToken = await GetValidAccessToken(user, db) ?? user.AccessToken!;

            var authorUrn = $"urn:li:person:{user.LinkedInId}";
            var plainText = StripHtml(post.Content);

            string postUrn;
            if (post.Image != null && File.Exists(post.Image.FilePath))
                postUrn = await PublishImagePost(accessToken, authorUrn, plainText, post.Image.FilePath);
            else
                postUrn = await PublishTextPost(accessToken, authorUrn, plainText);

            post.LinkedInPostUrn = postUrn;
            post.LinkedInPostId = postUrn;
            post.PublishedAt = DateTime.UtcNow;
            post.Status = "published";
            post.ErrorMessage = null;

            if (post.FirstComment != null && !string.IsNullOrEmpty(post.FirstComment.Content))
            {
                try
                {
                    var commentId = await PostComment(accessToken, postUrn, authorUrn, post.FirstComment.Content);
                    post.FirstComment.LinkedInCommentId = commentId;
                    post.FirstComment.Posted = 1;
                }
                catch (Exception ex)
                {
                    post.ErrorMessage = $"Post published but first comment failed: {ex.Message}";
                }
            }

            await db.SaveChangesAsync();
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
            await db.SaveChangesAsync();
            return false;
        }
        catch (Exception ex)
        {
            post.Status = "failed";
            post.ErrorMessage = $"Publishing failed: {ex.Message[..Math.Min(ex.Message.Length, 500)]}";
            await db.SaveChangesAsync();
            return false;
        }
    }

    public async Task<Dictionary<string, int>> FetchLinkedInAnalytics(Post post, User user, AppDbContext db)
    {
        var accessToken = await GetValidAccessToken(user, db);

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

        try
        {
            var client = _httpFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

            var resp = await client.GetAsync($"{LinkedInApiBase}/socialActions/{post.LinkedInPostUrn}");
            if (resp.IsSuccessStatusCode)
            {
                var json = await resp.Content.ReadAsStringAsync();
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
                var client = _httpFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

                var resp = await client.GetAsync($"{LinkedInApiBase}/shares/{shareUrn}/statistics");
                if (resp.IsSuccessStatusCode)
                {
                    var json = await resp.Content.ReadAsStringAsync();
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
