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
    private const string LinkedInRestBase = "https://api.linkedin.com/rest";
    private const string LinkedInVersion = "202511";
    private const string LinkedInTokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";

    private static async Task EnsureSuccessWithBody(HttpResponseMessage resp, string step, CancellationToken ct)
    {
        if (resp.IsSuccessStatusCode) return;
        string body = "";
        try { body = await resp.Content.ReadAsStringAsync(ct); } catch { }
        var trimmed = body.Length > 800 ? body.Substring(0, 800) + "..." : body;
        throw new HttpRequestException(
            $"[{step}] LinkedIn {(int)resp.StatusCode} {resp.ReasonPhrase}: {trimmed}",
            null,
            resp.StatusCode);
    }

    // LinkedIn REST Posts API requires escaping these chars in `commentary`.
    private static string EscapeCommentary(string text)
    {
        var sb = new StringBuilder(text.Length);
        foreach (var ch in text)
        {
            if ("|{}@[]()<>#*_~\\".IndexOf(ch) >= 0) sb.Append('\\');
            sb.Append(ch);
        }
        return sb.ToString();
    }

    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<LinkedInService> _logger;
    private readonly TokenProtector _protector;
    private readonly INotificationService? _notificationService;

    public LinkedInService(IConfiguration config, IHttpClientFactory httpFactory, ILogger<LinkedInService> logger, TokenProtector protector, INotificationService? notificationService = null)
    {
        _config = config;
        _httpFactory = httpFactory;
        _logger = logger;
        _protector = protector;
        _notificationService = notificationService;
    }

    private static byte[] GetMediaBytes(Media m)
    {
        if (m.Data != null && m.Data.Length > 0) return m.Data;
        if (!string.IsNullOrEmpty(m.FilePath) && File.Exists(m.FilePath))
            return File.ReadAllBytes(m.FilePath);
        return Array.Empty<byte>();
    }

    // Token storage on SocialConnection is encrypted-at-rest via ASP.NET Core Data
    // Protection (see TokenProtector, purpose "LinkedPush.SocialConnection.Token.v1").
    // DecodeToken transparently handles legacy plaintext rows written before the
    // encryption rollout — the next write will re-encrypt.
    private string? DecodeToken(byte[]? blob) => _protector.Unprotect(blob);
    private byte[]? EncodeToken(string? token) => _protector.Protect(token);

    /// <summary>
    /// Loads the user's active LinkedIn SocialConnection, if any.
    /// </summary>
    public static Task<SocialConnection?> GetLinkedInConnection(User user, AppDbContext db, CancellationToken ct = default)
        => db.SocialConnections.FirstOrDefaultAsync(
            s => s.UserId == user.Id && s.Provider == "linkedin", ct);

    /// <summary>
    /// Outcome of a LinkedIn refresh attempt. Used by <see cref="RefreshAccessTokenV2"/>
    /// to distinguish permanent failures (caller should stop retrying) from transient
    /// failures (caller should back off and retry later) and from no-op dedupe hits.
    /// </summary>
    public enum RefreshOutcome
    {
        /// <summary>Refresh completed and the SC was updated with a new access token.</summary>
        Success,
        /// <summary>Another worker refreshed this SC within the last 30 seconds — token is still fresh.</summary>
        AlreadyFresh,
        /// <summary>HTTP 429 / 5xx / network error / timeout. SC state unchanged.</summary>
        Transient,
        /// <summary>HTTP 400 invalid_grant/invalid_request or 401. SC marked expired; caller should not retry.</summary>
        Terminal,
    }

    /// <summary>
    /// Refreshes the LinkedIn access token on a SocialConnection with error classification,
    /// dedupe (30-second LastRefreshedAt window to handle the TokenRefreshService +
    /// SchedulerService race), and AuthEvent emission. Persists SC changes on Success
    /// (new token) and Terminal (status → expired).
    /// </summary>
    /// <remarks>
    /// Dedupe relies on eventual consistency via <see cref="SocialConnection.LastRefreshedAt"/>
    /// — no distributed lock. Two workers racing within the same 30-second window can still
    /// both POST to LinkedIn, but the loser will just return <see cref="RefreshOutcome.AlreadyFresh"/>
    /// on its second call after reloading the row.
    /// </remarks>
    public async Task<RefreshOutcome> RefreshAccessTokenV2(SocialConnection connection, AppDbContext db, CancellationToken ct = default)
    {
        // 1. In-memory dedupe: if the caller passed a connection that another worker
        //    just refreshed (LastRefreshedAt within 30s, still active, access token present),
        //    skip the network roundtrip entirely.
        if (connection.LastRefreshedAt.HasValue
            && DateTime.UtcNow - connection.LastRefreshedAt.Value < TimeSpan.FromSeconds(30)
            && string.Equals(connection.Status, "active", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(DecodeToken(connection.AccessTokenEncrypted)))
        {
            return RefreshOutcome.AlreadyFresh;
        }

        // 2. Reload from DB to catch another worker's just-written update.
        try { await db.Entry(connection).ReloadAsync(ct); } catch { /* detached / inmemory — ignore */ }

        // Re-check after reload.
        if (connection.LastRefreshedAt.HasValue
            && DateTime.UtcNow - connection.LastRefreshedAt.Value < TimeSpan.FromSeconds(30)
            && string.Equals(connection.Status, "active", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(DecodeToken(connection.AccessTokenEncrypted)))
        {
            return RefreshOutcome.AlreadyFresh;
        }

        // If another worker already marked it terminal, don't keep pounding LinkedIn.
        if (!string.Equals(connection.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            return RefreshOutcome.Terminal;
        }

        var refreshToken = DecodeToken(connection.RefreshTokenEncrypted);
        if (string.IsNullOrEmpty(refreshToken))
        {
            // No refresh token to exchange — permanent for this SC.
            connection.Status = "expired";
            connection.AccessTokenEncrypted = null;
            await EmitAuthEvent(db, connection.UserId, "token_refresh_failed", "no_refresh_token", ct);
            try { await db.SaveChangesAsync(ct); } catch { }
            return RefreshOutcome.Terminal;
        }

        HttpResponseMessage? resp = null;
        string body = "";
        try
        {
            var client = _httpFactory.CreateClient();
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = refreshToken,
                ["client_id"] = AppConfig.Get(_config, "LinkedIn:ClientId", "LINKEDIN_CLIENT_ID"),
                ["client_secret"] = AppConfig.Get(_config, "LinkedIn:ClientSecret", "LINKEDIN_CLIENT_SECRET"),
            });

            resp = await client.PostAsync(LinkedInTokenUrl, content, ct);
            try { body = await resp.Content.ReadAsStringAsync(ct); } catch { body = ""; }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            // Timeout / cancellation not tied to our CT — transient.
            _logger.LogWarning(ex, "LinkedIn token refresh timed out for SC {ScId}", connection.Id);
            return RefreshOutcome.Transient;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "LinkedIn token refresh network error for SC {ScId}", connection.Id);
            return RefreshOutcome.Transient;
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex, "LinkedIn token refresh I/O error for SC {ScId}", connection.Id);
            return RefreshOutcome.Transient;
        }

        // Classify HTTP response.
        int status = (int)resp.StatusCode;

        if (resp.IsSuccessStatusCode)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                if (!root.TryGetProperty("access_token", out var atProp) || atProp.ValueKind == JsonValueKind.Null)
                {
                    _logger.LogWarning("LinkedIn token refresh: 2xx but no access_token in body for SC {ScId}", connection.Id);
                    // Treat missing access_token in a 2xx as terminal — the server gave us nothing usable.
                    connection.Status = "expired";
                    connection.AccessTokenEncrypted = null;
                    await EmitAuthEvent(db, connection.UserId, "token_refresh_failed", "missing_access_token", ct);
                    try { await db.SaveChangesAsync(ct); } catch { }
                    return RefreshOutcome.Terminal;
                }
                connection.AccessTokenEncrypted = EncodeToken(atProp.GetString()!);
                if (root.TryGetProperty("refresh_token", out var rt) && rt.ValueKind == JsonValueKind.String)
                    connection.RefreshTokenEncrypted = EncodeToken(rt.GetString());
                var expiresIn = root.TryGetProperty("expires_in", out var ei) && ei.ValueKind == JsonValueKind.Number
                    ? ei.GetInt32() : 3600;
                connection.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
                connection.LastRefreshedAt = DateTime.UtcNow;
                connection.Status = "active";
                await EmitAuthEvent(db, connection.UserId, "token_refresh", "ok", ct);
                await db.SaveChangesAsync(ct);
                return RefreshOutcome.Success;
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "LinkedIn token refresh: 2xx but unparseable body for SC {ScId}", connection.Id);
                return RefreshOutcome.Transient;
            }
        }

        // Permanent failures: 401, or 400 with invalid_grant/invalid_request marker.
        bool is401 = status == 401;
        bool is400Terminal = status == 400
            && (body.Contains("invalid_grant", StringComparison.OrdinalIgnoreCase)
                || body.Contains("invalid_request", StringComparison.OrdinalIgnoreCase));

        if (is401 || is400Terminal)
        {
            var reason = is401 ? "http_401"
                : (body.Contains("invalid_grant", StringComparison.OrdinalIgnoreCase) ? "invalid_grant" : "invalid_request");
            _logger.LogWarning(
                "LinkedIn token refresh PERMANENT failure for SC {ScId}: {Status} reason={Reason}",
                connection.Id, status, reason);
            connection.Status = "expired";
            connection.AccessTokenEncrypted = null;
            // Keep RefreshTokenEncrypted for audit/debug — not strictly needed, but allows
            // ops to inspect whether LinkedIn rotated the refresh token before revoking.
            await EmitAuthEvent(db, connection.UserId, "token_refresh_failed", reason, ct);
            try { await db.SaveChangesAsync(ct); } catch (Exception saveEx) {
                _logger.LogError(saveEx, "Failed to persist terminal-refresh state for SC {ScId}", connection.Id);
            }
            return RefreshOutcome.Terminal;
        }

        // Everything else — 429, 5xx, unexpected 4xx — treat as transient. SC untouched.
        _logger.LogWarning(
            "LinkedIn token refresh TRANSIENT failure for SC {ScId}: {Status}",
            connection.Id, status);
        return RefreshOutcome.Transient;
    }

    /// <summary>
    /// Legacy boolean wrapper around <see cref="RefreshAccessTokenV2"/> — kept so existing
    /// call sites in <c>TokenRefreshService</c> and <c>SchedulerService</c> keep compiling.
    /// Maps <c>Success | AlreadyFresh → true</c>, <c>Terminal | Transient → false</c>.
    /// Prefer <see cref="RefreshAccessTokenV2"/> directly for new code — it distinguishes
    /// transient failures (retry OK) from terminal ones (SC is now <c>expired</c>).
    /// </summary>
    public async Task<bool> RefreshAccessToken(SocialConnection connection, AppDbContext db, CancellationToken ct = default)
    {
        var outcome = await RefreshAccessTokenV2(connection, db, ct);
        return outcome == RefreshOutcome.Success || outcome == RefreshOutcome.AlreadyFresh;
    }

    private async Task EmitAuthEvent(AppDbContext db, int userId, string eventType, string? reason, CancellationToken ct)
    {
        try
        {
            db.AuthEvents.Add(new AuthEvent
            {
                UserId = userId,
                EventType = eventType,
                Provider = "linkedin",
                Metadata = reason == null ? null : JsonSerializer.Serialize(new { reason }),
                CreatedAt = DateTime.UtcNow,
            });
            // Don't SaveChanges here — callers SaveChanges alongside the SC update so the
            // event + state transition land atomically.
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            // Audit log failure should never break the refresh flow.
            _logger.LogWarning(ex, "Failed to stage AuthEvent {EventType} for user {UserId}", eventType, userId);
        }
    }

    /// <summary>
    /// Returns a usable LinkedIn access token for the SocialConnection, refreshing it
    /// if it is within 5 minutes of expiry. Returns null when no token is available or
    /// refresh fails (caller decides how to surface the failure).
    /// </summary>
    public async Task<string?> GetValidAccessToken(SocialConnection connection, AppDbContext db, CancellationToken ct = default)
    {
        if (!string.Equals(connection.Status, "active", StringComparison.OrdinalIgnoreCase))
            return null;
        var accessToken = DecodeToken(connection.AccessTokenEncrypted);
        if (string.IsNullOrEmpty(accessToken)) return null;

        if (connection.TokenExpiresAt.HasValue &&
            DateTime.UtcNow >= connection.TokenExpiresAt.Value.AddMinutes(-5))
        {
            var success = await RefreshAccessToken(connection, db, ct);
            if (!success) return null;
            accessToken = DecodeToken(connection.AccessTokenEncrypted);
        }

        return accessToken;
    }

    /// <summary>
    /// Legacy overload — loads the user's active LinkedIn SocialConnection and delegates.
    /// Returns null if the user has no LinkedIn connection. Kept so existing scheduler /
    /// analytics call sites do not need to load the connection themselves.
    /// </summary>
    public async Task<string?> GetValidAccessToken(User user, AppDbContext db, CancellationToken ct = default)
    {
        var connection = await GetLinkedInConnection(user, db, ct);
        if (connection == null) return null;
        return await GetValidAccessToken(connection, db, ct);
    }

    /// <summary>
    /// Legacy overload for <see cref="TokenRefreshService"/>. Loads the user's active
    /// LinkedIn SocialConnection and refreshes it.
    /// </summary>
    public async Task<bool> RefreshAccessToken(User user, AppDbContext db, CancellationToken ct = default)
    {
        var connection = await GetLinkedInConnection(user, db, ct);
        if (connection == null) return false;
        return await RefreshAccessToken(connection, db, ct);
    }

    /// <summary>
    /// Idempotent startup migration. For each user with a legacy LinkedIn access token
    /// on the <c>users</c> table and no matching <see cref="SocialConnection"/>, creates
    /// a new row populated from the legacy columns. Never overwrites an existing
    /// SocialConnection and never clears the legacy columns (that happens in a later
    /// milestone after the rollback window closes).
    /// </summary>
    public async Task<int> MigrateLegacyLinkedInTokens(AppDbContext db, CancellationToken ct = default)
    {
#pragma warning disable CS0618 // intentional read of deprecated fields during migration
        var legacyUsers = await db.Users
            .Where(u => u.AccessToken != null
                && u.AccessToken != ""
                && u.AccessToken != "dev-token")
            .ToListAsync(ct);

        if (legacyUsers.Count == 0)
        {
            _logger.LogInformation("[LinkedInMigration] No legacy LinkedIn tokens to migrate");
            return 0;
        }

        var userIds = legacyUsers.Select(u => u.Id).ToList();
        var existing = await db.SocialConnections
            .Where(s => s.Provider == "linkedin" && userIds.Contains(s.UserId))
            .Select(s => s.UserId)
            .ToListAsync(ct);
        var existingSet = new HashSet<int>(existing);

        int migrated = 0;
        foreach (var user in legacyUsers)
        {
            if (existingSet.Contains(user.Id)) continue;

            // Only treat User.LinkedInId as a real LinkedIn sub when it is NOT a
            // google-* marker and NOT the dev sentinel. Otherwise fall back to a
            // deterministic hash of the access token so the unique (provider, provider_user_id)
            // index still holds.
            string providerUserId;
            if (!string.IsNullOrWhiteSpace(user.LinkedInId)
                && !user.LinkedInId.StartsWith("google-", StringComparison.Ordinal)
                && !string.Equals(user.LinkedInId, "dev-user", StringComparison.Ordinal))
            {
                providerUserId = user.LinkedInId;
            }
            else
            {
                using var sha = System.Security.Cryptography.SHA256.Create();
                providerUserId = Convert
                    .ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(user.AccessToken!)))
                    [..16]
                    .ToLowerInvariant();
            }

            db.SocialConnections.Add(new SocialConnection
            {
                UserId = user.Id,
                Provider = "linkedin",
                ProviderUserId = providerUserId,
                AccessTokenEncrypted = EncodeToken(user.AccessToken),
                RefreshTokenEncrypted = EncodeToken(user.RefreshToken),
                TokenExpiresAt = user.TokenExpiresAt,
                Scopes = "w_member_social r_basicprofile r_emailaddress",
                Status = "active",
                ConnectedAt = DateTime.UtcNow,
                LastRefreshedAt = DateTime.UtcNow,
            });
            migrated++;
        }
#pragma warning restore CS0618

        if (migrated > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        _logger.LogInformation(
            "[LinkedInMigration] Migrated {Migrated}/{Total} user(s) to SocialConnection",
            migrated, legacyUsers.Count);
        return migrated;
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

    public async Task<(string assetUrn, bool processingComplete)> UploadVideo(string accessToken, string authorUrn, byte[] videoData, CancellationToken ct = default)
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
                        return (asset, true);
                }
            }
        }

        // Return asset even if polling times out — LinkedIn may still process it.
        // Log as warning so operators can monitor.
        _logger.LogWarning("Video processing poll timed out for asset {Asset}. " +
            "LinkedIn may still be processing it in the background. " +
            "The post will be published without the video attachment.", asset);
        return (asset, false);
    }

    public async Task<string> PublishVideoPost(string accessToken, string authorUrn, string text, Media videoMedia, CancellationToken ct = default)
    {
        var videoData = GetMediaBytes(videoMedia);
        var (asset, videoReady) = await UploadVideo(accessToken, authorUrn, videoData, ct);
        if (!videoReady)
        {
            _logger.LogWarning("Video upload completed but LinkedIn still processing. Post will show without video attachment.");
        }

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

    // Documents use LinkedIn's versioned REST API. The legacy /v2/assets+ugcPosts flow
    // with the `feedshare-document` recipe was retired and returns 403 for current apps.
    public async Task<(string documentUrn, string title)> UploadDocument(string accessToken, string authorUrn, Media documentMedia, CancellationToken ct = default)
    {
        var documentData = GetMediaBytes(documentMedia);
        var title = string.IsNullOrWhiteSpace(documentMedia.OriginalFilename)
            ? "document.pdf"
            : documentMedia.OriginalFilename!;

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");
        client.DefaultRequestHeaders.Add("LinkedIn-Version", LinkedInVersion);

        var initPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["initializeUploadRequest"] = new Dictionary<string, object>
            {
                ["owner"] = authorUrn
            }
        });

        var initContent = new StringContent(initPayload, Encoding.UTF8, "application/json");
        var initResp = await client.PostAsync($"{LinkedInRestBase}/documents?action=initializeUpload", initContent, ct);
        await EnsureSuccessWithBody(initResp, "documents.initializeUpload", ct);

        var initJson = await initResp.Content.ReadAsStringAsync(ct);
        using var initDoc = JsonDocument.Parse(initJson);
        var value = initDoc.RootElement.GetProperty("value");
        var uploadUrl = value.GetProperty("uploadUrl").GetString()!;
        var documentUrn = value.GetProperty("document").GetString()!;

        // Upload binary (single-part). LinkedIn returns 201 with no body.
        var uploadClient = _httpFactory.CreateClient();
        uploadClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        uploadClient.Timeout = TimeSpan.FromMinutes(5);
        var byteContent = new ByteArrayContent(documentData);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        var uploadResp = await uploadClient.PutAsync(uploadUrl, byteContent, ct);
        await EnsureSuccessWithBody(uploadResp, "documents.uploadBinary", ct);

        return (documentUrn, title);
    }

    public async Task<string> PublishDocumentPost(string accessToken, string authorUrn, string text, Media documentMedia, CancellationToken ct = default)
    {
        var (documentUrn, title) = await UploadDocument(accessToken, authorUrn, documentMedia, ct);

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");
        client.DefaultRequestHeaders.Add("LinkedIn-Version", LinkedInVersion);

        var jsonPayload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["author"] = authorUrn,
            ["commentary"] = EscapeCommentary(text),
            ["visibility"] = "PUBLIC",
            ["distribution"] = new Dictionary<string, object>
            {
                ["feedDistribution"] = "MAIN_FEED",
                ["targetEntities"] = Array.Empty<object>(),
                ["thirdPartyDistributionChannels"] = Array.Empty<object>()
            },
            ["content"] = new Dictionary<string, object>
            {
                ["media"] = new Dictionary<string, object>
                {
                    ["id"] = documentUrn,
                    ["title"] = title
                }
            },
            ["lifecycleState"] = "PUBLISHED",
            ["isReshareDisabledByAuthor"] = false
        });

        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInRestBase}/posts", content, ct);
        await EnsureSuccessWithBody(resp, "posts.create(document)", ct);

        // REST Posts API returns the post URN in the x-restli-id header.
        if (resp.Headers.TryGetValues("x-restli-id", out var ids))
        {
            var postUrn = ids.FirstOrDefault();
            if (!string.IsNullOrEmpty(postUrn)) return postUrn;
        }
        // Fallback: some responses include the URN in the body.
        var respJson = await resp.Content.ReadAsStringAsync(ct);
        if (!string.IsNullOrWhiteSpace(respJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(respJson);
                if (doc.RootElement.TryGetProperty("id", out var idEl))
                    return idEl.GetString() ?? "";
            }
            catch { }
        }
        return "";
    }

    public async Task<string> PostComment(string accessToken, string postUrn, string authorUrn, string text, CancellationToken ct = default)
    {
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("LinkedIn-Version", LinkedInVersion);

        var payload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["actor"] = authorUrn,
            ["object"] = postUrn,
            ["message"] = new Dictionary<string, string> { ["text"] = text }
        });

        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"{LinkedInRestBase}/comments", content, ct);
        await EnsureSuccessWithBody(resp, "comments.create", ct);

        if (resp.Headers.TryGetValues("x-restli-id", out var ids))
        {
            var commentId = ids.FirstOrDefault();
            if (!string.IsNullOrEmpty(commentId)) return commentId;
        }
        var json = await resp.Content.ReadAsStringAsync(ct);
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("id", out var id))
                    return id.GetString() ?? "";
            }
            catch { }
        }
        return "";
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

    // PublishPost orchestrates the full LinkedIn publish flow.
    // API routing:
    //   - ugcPosts (image/video/text) → LinkedInApiBase = https://api.linkedin.com/v2
    //   - posts (documents)         → LinkedInRestBase = https://api.linkedin.com/rest
    //   - socialActions/comments    → LinkedInRestBase (LinkedInVersion = 202511)
    // This split reflects LinkedIn's API evolution — ugcPosts is legacy, posts is current.
    public async Task<bool> PublishPost(Post post, User user, AppDbContext db, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        try
        {
            post.Status = "publishing";
            await db.SaveChangesAsync(ct);

            // LinkedIn is now a pure connector — load the SocialConnection and bail
            // cleanly if the user hasn't connected (or revoked) their integration.
            var connection = await GetLinkedInConnection(user, db, ct);
            if (connection == null
                || !string.Equals(connection.Status, "active", StringComparison.OrdinalIgnoreCase))
            {
                post.Status = "failed";
                post.ErrorMessage = "LinkedIn not connected";
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            if (_notificationService != null)
                await _notificationService.NotifyPostFailed(post, user);
            return false;
        }

            var accessToken = await GetValidAccessToken(connection, db, ct);
            if (accessToken == null)
            {
                post.Status = "failed";
                post.ErrorMessage = "LinkedIn access token is missing or refresh failed. Please re-authenticate.";
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                if (_notificationService != null)
                    await _notificationService.NotifyPostFailed(post, user);
                return false;
            }

            // Prefer the SocialConnection's provider_user_id (the real LinkedIn sub)
            // over the legacy User.LinkedInId column, which now holds google-* markers.
            var authorUrn = $"urn:li:person:{connection.ProviderUserId}";
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
                _logger.LogInformation("Post {PostId}: waiting 3s before posting first comment", post.Id);
                await Task.Delay(3000, ct);
                string? commentId = null;
                Exception? lastEx = null;
                const int maxAttempts = 2;
                for (int attempt = 1; attempt <= maxAttempts; attempt++)
                {
                    try
                    {
                        _logger.LogInformation("Post {PostId}: posting first comment (attempt {Attempt}/{MaxAttempts})", post.Id, attempt, maxAttempts);
                        commentId = await PostComment(accessToken, postUrn, authorUrn, post.FirstComment.Content, ct);
                        break;
                    }
                    catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound && attempt < maxAttempts)
                    {
                        _logger.LogWarning(ex, "Post {PostId}: comment attempt {Attempt} got 404, retrying in 5s", post.Id, attempt);
                        lastEx = ex;
                        await Task.Delay(5000, ct);
                    }
                    catch (Exception ex)
                    {
                        lastEx = ex;
                        break;
                    }
                }
                if (!string.IsNullOrEmpty(commentId))
                {
                    _logger.LogInformation("Post {PostId}: first comment posted successfully ({CommentId})", post.Id, commentId);
                    post.FirstComment.LinkedInCommentId = commentId;
                    post.FirstComment.Posted = 1;
                }
                else if (lastEx != null)
                {
                    _logger.LogError(lastEx, "Post {PostId}: first comment failed", post.Id);
                    post.ErrorMessage = $"Post published but first comment failed: {lastEx.Message}";
                }
            }

            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            if (_notificationService != null)
                await _notificationService.NotifyPostPublished(post, user);
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
            await transaction.RollbackAsync(ct);
            if (_notificationService != null)
                await _notificationService.NotifyPostFailed(post, user);
            return false;
        }
        catch (OperationCanceledException ex) when (ex.CancellationToken != ct)
        {
            post.Status = "scheduled";
            post.ErrorMessage = "Publish operation timed out. Will retry on next scheduler cycle.";
            await db.SaveChangesAsync(ct);
            await transaction.RollbackAsync(ct);
            return false;
        }
        catch (Exception ex) when (ex is not OutOfMemoryException && ex is not StackOverflowException)
        {
            post.Status = "failed";
            post.ErrorMessage = $"Publishing failed: {ex.Message[..Math.Min(ex.Message.Length, 500)]}";
            await db.SaveChangesAsync(ct);
            await transaction.RollbackAsync(ct);
            if (_notificationService != null)
                await _notificationService.NotifyPostFailed(post, user);
            return false;
        }
    }

    public async Task<Dictionary<string, int>> FetchLinkedInAnalytics(Post post, User user, AppDbContext db, CancellationToken ct = default)
    {
        var connection = await GetLinkedInConnection(user, db, ct);
        var accessToken = connection == null
            ? null
            : await GetValidAccessToken(connection, db, ct);

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
            _logger.LogWarning(ex, "Analytics socialActions fetch failed for post {PostId}", post.Id);
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
            _logger.LogWarning(ex, "Analytics share statistics fetch failed for post {PostId}", post.Id);
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
