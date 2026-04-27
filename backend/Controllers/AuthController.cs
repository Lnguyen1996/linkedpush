using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;
using LinkedPushApi.Services;

namespace LinkedPushApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SessionService _session;
    private readonly JwtService _jwt;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly TokenProtector _tokenProtector;
    private readonly ILogger<AuthController>? _logger;

    public AuthController(
        AppDbContext db,
        SessionService session,
        JwtService jwt,
        IConfiguration config,
        IHttpClientFactory httpFactory,
        TokenProtector tokenProtector,
        ILogger<AuthController>? logger = null)
    {
        _db = db;
        _session = session;
        _jwt = jwt;
        _config = config;
        _httpFactory = httpFactory;
        _tokenProtector = tokenProtector;
        _logger = logger;
    }

    private bool DevMode => AppConfig.GetBool(_config, "DevMode", "DEV_MODE", fallback: false);
    private string GoogleClientId => AppConfig.Get(_config, "Google:ClientId", "GOOGLE_CLIENT_ID");
    private string GoogleClientSecret => AppConfig.Get(_config, "Google:ClientSecret", "GOOGLE_CLIENT_SECRET");
    private string GoogleRedirectUri => AppConfig.Get(_config, "Google:RedirectUri", "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback");
    private string LinkedInClientId => AppConfig.Get(_config, "LinkedIn:ClientId", "LINKEDIN_CLIENT_ID");
    private string LinkedInClientSecret => AppConfig.Get(_config, "LinkedIn:ClientSecret", "LINKEDIN_CLIENT_SECRET");
    private string LinkedInRedirectUri => AppConfig.Get(_config, "LinkedIn:RedirectUri", "LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/auth/linkedin/callback");
    private string FrontendUrl => AppConfig.Get(_config, "FrontendUrl", "FRONTEND_URL", "http://localhost:5173");
    private string? CookieDomain => AppConfig.Get(_config, "CookieDomain", "COOKIE_DOMAIN");
    private bool GoogleOAuthEnabled => !string.IsNullOrEmpty(GoogleClientId) && !string.IsNullOrEmpty(GoogleClientSecret);
    private bool LinkedInOAuthEnabled => !string.IsNullOrEmpty(LinkedInClientId) && !string.IsNullOrEmpty(LinkedInClientSecret);

    [HttpGet("login")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> Login([FromQuery] int? cli_port = null)
    {
        if (!GoogleOAuthEnabled)
        {
            if (DevMode)
                return Ok(new { redirect_url = "/api/auth/dev-login" });

            return StatusCode(500, new { detail = "Google OAuth is not configured. Set Google:ClientId and Google:ClientSecret in appsettings.json." });
        }

        var state = CreateRandomUrlToken(32);
        var nonce = CreateRandomUrlToken(24);
        _db.OAuthStates.Add(new OAuthState
        {
            State = state,
            CreatedAt = DateTime.UtcNow,
            CliPort = cli_port,
            Provider = "google",
            Nonce = nonce,
            Intent = "login",
        });
        await _db.SaveChangesAsync();

        var query =
            $"response_type=code&client_id={Uri.EscapeDataString(GoogleClientId)}" +
            $"&redirect_uri={Uri.EscapeDataString(GoogleRedirectUri)}" +
            $"&scope={Uri.EscapeDataString("openid email profile")}" +
            $"&state={Uri.EscapeDataString(state)}" +
            $"&nonce={Uri.EscapeDataString(nonce)}" +
            "&access_type=offline&prompt=consent";
        return Ok(new { redirect_url = $"https://accounts.google.com/o/oauth2/v2/auth?{query}" });
    }

    [HttpGet("google/login")]
    [EnableRateLimiting("auth-login")]
    public Task<IActionResult> GoogleLogin([FromQuery] int? cli_port = null) => Login(cli_port);

    [HttpGet("callback")]
    [EnableRateLimiting("auth-callback")]
    public async Task<IActionResult> Callback([FromQuery] string? code = null, [FromQuery] string? state = null, [FromQuery] string? error = null, [FromQuery] string? error_description = null)
    {
        // NOTE: The LinkedIn Developer Portal only allows a single redirect URI
        // per app and it is historically set to the generic `/api/auth/callback`
        // path used by Google. To avoid forcing users to re-register their
        // LinkedIn OAuth app with a different URI, this endpoint dispatches to
        // the LinkedIn handler based on the Provider stored on the OAuthState
        // row. Google is the default provider and the path below unchanged for
        // backwards compatibility.
        if (!string.IsNullOrEmpty(error))
        {
            // The error branch runs before state lookup because OAuth providers
            // sometimes omit `state` in error redirects. Default to the login
            // page redirect which is the Google-style error UX; LinkedIn-link
            // errors currently bubble up through the same surface and the user
            // can retry from Settings.
            return Redirect($"{FrontendUrl}/login?error={Uri.EscapeDataString(error_description ?? error)}");
        }

        if (string.IsNullOrWhiteSpace(state))
            return BadRequest(new { detail = "Missing state parameter" });

        if (string.IsNullOrEmpty(code))
            return BadRequest(new { detail = "Missing authorization code" });

        var stateInfo = await _db.OAuthStates.FirstOrDefaultAsync(o => o.State == state);
        if (stateInfo == null || stateInfo.CreatedAt < DateTime.UtcNow.AddMinutes(-10))
            return BadRequest(new { detail = "Invalid or expired state parameter" });

        // Dispatch on the provider recorded when the state was issued. This is
        // the fix for the "blank page after LinkedIn connect" bug: previously
        // every state that wasn't `google` fell through to a generic error.
        if (string.Equals(stateInfo.Provider, "linkedin", StringComparison.OrdinalIgnoreCase))
            return await HandleLinkedInCallback(code, stateInfo);

        if (!string.Equals(stateInfo.Provider, "google", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { detail = "Unknown provider in state" });

        if (!GoogleOAuthEnabled)
            return StatusCode(500, new { detail = "Google OAuth is not configured." });

        int? cliPort = stateInfo.CliPort;

        var client = _httpFactory.CreateClient();
        var tokenContent = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = GoogleRedirectUri,
            ["client_id"] = GoogleClientId,
            ["client_secret"] = GoogleClientSecret,
        });

        var tokenResp = await client.PostAsync("https://oauth2.googleapis.com/token", tokenContent);
        if (!tokenResp.IsSuccessStatusCode)
            return BadRequest(new { detail = "Failed to exchange code for token" });

        var tokenJson = await tokenResp.Content.ReadAsStringAsync();
        using var tokenDoc = JsonDocument.Parse(tokenJson);
        var tokenRoot = tokenDoc.RootElement;
        var accessToken = tokenRoot.GetProperty("access_token").GetString()!;
        var idToken = tokenRoot.TryGetProperty("id_token", out var idTokenNode) ? idTokenNode.GetString() : null;
        if (string.IsNullOrWhiteSpace(idToken))
            return BadRequest(new { detail = "Missing id_token from Google response" });

        var tokenInfo = await ValidateGoogleIdToken(idToken);
        if (tokenInfo == null)
            return BadRequest(new { detail = "Invalid Google id_token" });

        var payload = DecodeJwtPayload(idToken);
        if (payload == null)
            return BadRequest(new { detail = "Failed to decode id_token payload" });

        var googleSub = payload.Sub ?? tokenInfo.Sub;
        var email = NormalizeEmail(payload.Email);
        var emailVerified = payload.EmailVerified;
        var nonce = payload.Nonce;
        var name = payload.Name;
        var avatarUrl = payload.Picture;

        if (string.IsNullOrWhiteSpace(googleSub))
            return BadRequest(new { detail = "Google response missing subject" });
        if (!string.IsNullOrWhiteSpace(stateInfo.Nonce) && !string.Equals(stateInfo.Nonce, nonce, StringComparison.Ordinal))
            return BadRequest(new { detail = "Invalid Google nonce" });

        var identity = await _db.Identities
            .Include(i => i.User)
            .FirstOrDefaultAsync(i => i.Provider == "google" && i.ProviderUserId == googleSub);
        User user;
        if (identity?.User != null)
        {
            user = identity.User;
            identity.Email = email;
            identity.LastLoginAt = DateTime.UtcNow;
        }
        else
        {
            var existingUser = emailVerified && email != null
                ? await _db.Users.FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == email)
                : null;

            if (existingUser != null)
            {
                user = existingUser;
            }
            else
            {
                user = new User
                {
                    LinkedInId = $"google-{googleSub}",
                    Name = string.IsNullOrWhiteSpace(name) ? "Google User" : name!,
                    Email = email,
                    AvatarUrl = avatarUrl,
                    EmailVerified = emailVerified,
                    PrimaryLoginProvider = "google",
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();
            }

            identity = new Identity
            {
                UserId = user.Id,
                Provider = "google",
                ProviderUserId = googleSub!,
                Email = email,
                LastLoginAt = DateTime.UtcNow,
            };
            _db.Identities.Add(identity);
        }

        user.Name = string.IsNullOrWhiteSpace(name) ? user.Name : name!;
        user.Email = email ?? user.Email;
        user.AvatarUrl = avatarUrl ?? user.AvatarUrl;
        user.EmailVerified = emailVerified || user.EmailVerified;
        user.PrimaryLoginProvider = "google";
        user.UpdatedAt = DateTime.UtcNow;
        _db.AuthEvents.Add(new AuthEvent
        {
            UserId = user.Id,
            EventType = "login_success",
            Provider = "google",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
        });
        _db.OAuthStates.Remove(stateInfo);
        await _db.SaveChangesAsync();

        await IssueAuthCookies(user);

        if (cliPort.HasValue)
            return Redirect($"http://localhost:{cliPort.Value}/cli-callback?ok=1");

        return Redirect($"{FrontendUrl}/app");
    }

    private static string? NormalizeEmail(string? email)
    {
        var trimmed = email?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed.ToLowerInvariant();
    }

    [HttpGet("linkedin/login")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> LinkedInLogin()
    {
        var user = await _session.GetCurrentUser(HttpContext, _db);
        if (user == null) return Unauthorized(new { detail = "Not authenticated" });

        if (!LinkedInOAuthEnabled)
            return StatusCode(500, new { detail = "LinkedIn OAuth is not configured." });

        var state = CreateRandomUrlToken(32);
        _db.OAuthStates.Add(new OAuthState
        {
            State = state,
            CreatedAt = DateTime.UtcNow,
            Provider = "linkedin",
            Intent = "link_provider",
            LinkUserId = user.Id,
        });
        await _db.SaveChangesAsync();

        var query =
            $"response_type=code&client_id={Uri.EscapeDataString(LinkedInClientId)}" +
            $"&redirect_uri={Uri.EscapeDataString(LinkedInRedirectUri)}" +
            $"&scope={Uri.EscapeDataString("openid profile email w_member_social")}" +
            $"&state={Uri.EscapeDataString(state)}&prompt=consent";
        return Ok(new { redirect_url = $"https://www.linkedin.com/oauth/v2/authorization?{query}" });
    }

    [HttpGet("linkedin/callback")]
    [EnableRateLimiting("auth-callback")]
    public async Task<IActionResult> LinkedInCallback([FromQuery] string? code = null, [FromQuery] string? state = null, [FromQuery] string? error = null, [FromQuery] string? error_description = null)
    {
        // This route is retained alongside /api/auth/callback so that apps
        // registered with the LinkedIn-specific redirect URI keep working. The
        // generic /api/auth/callback handler also accepts LinkedIn state via
        // state-based dispatch.
        if (!string.IsNullOrEmpty(error))
            return Redirect($"{FrontendUrl}/app?linkedin_error={Uri.EscapeDataString(error_description ?? error)}");
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            return BadRequest(new { detail = "Missing authorization code or state" });

        var stateInfo = await _db.OAuthStates.FirstOrDefaultAsync(o => o.State == state);
        if (stateInfo == null || stateInfo.CreatedAt < DateTime.UtcNow.AddMinutes(-10))
            return BadRequest(new { detail = "Invalid or expired state parameter" });
        if (!string.Equals(stateInfo.Provider, "linkedin", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { detail = "Invalid state provider" });

        return await HandleLinkedInCallback(code, stateInfo);
    }

    // Shared LinkedIn OAuth completion path. Assumes the caller has already
    // looked up and validated that `stateInfo.Provider == "linkedin"` and that
    // the state row is non-expired. Both /api/auth/callback (generic) and
    // /api/auth/linkedin/callback (specific) feed into this helper.
    private async Task<IActionResult> HandleLinkedInCallback(string code, OAuthState stateInfo)
    {
        if (!LinkedInOAuthEnabled)
            return StatusCode(500, new { detail = "LinkedIn OAuth is not configured." });

        if (!string.Equals(stateInfo.Intent, "link_provider", StringComparison.OrdinalIgnoreCase) || !stateInfo.LinkUserId.HasValue)
            return BadRequest(new { detail = "Invalid LinkedIn link intent" });

        var user = await _db.Users.FindAsync(stateInfo.LinkUserId.Value);
        if (user == null) return BadRequest(new { detail = "User not found for LinkedIn link flow" });

        var client = _httpFactory.CreateClient();
        var tokenContent = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = LinkedInRedirectUri,
            ["client_id"] = LinkedInClientId,
            ["client_secret"] = LinkedInClientSecret,
        });
        var tokenResp = await client.PostAsync("https://www.linkedin.com/oauth/v2/accessToken", tokenContent);
        if (!tokenResp.IsSuccessStatusCode)
            return BadRequest(new { detail = "Failed to exchange code for token" });

        var tokenJson = await tokenResp.Content.ReadAsStringAsync();
        using var tokenDoc = JsonDocument.Parse(tokenJson);
        var tokenRoot = tokenDoc.RootElement;
        var accessToken = tokenRoot.GetProperty("access_token").GetString()!;
        var refreshToken = tokenRoot.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = tokenRoot.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
        var tokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
        var decoded = DecodeJwtPayload(tokenRoot.TryGetProperty("id_token", out var idt) ? idt.GetString() : accessToken);
        var linkedInId = decoded?.Sub;

        if (string.IsNullOrWhiteSpace(linkedInId))
        {
            using var sha = SHA256.Create();
            linkedInId = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(accessToken)))[..16].ToLowerInvariant();
        }

        var social = await _db.SocialConnections.FirstOrDefaultAsync(s =>
            s.UserId == user.Id && s.Provider == "linkedin");
        if (social == null)
        {
            social = new SocialConnection
            {
                UserId = user.Id,
                Provider = "linkedin",
                ProviderUserId = linkedInId!,
            };
            _db.SocialConnections.Add(social);
        }

        social.ProviderUserId = linkedInId!;
        social.AccessTokenEncrypted = _tokenProtector.Protect(accessToken);
        social.RefreshTokenEncrypted = _tokenProtector.Protect(refreshToken);
        // Security audit log: confirm we persisted an encrypted payload. Log only
        // length + first-byte magic (Data Protection payloads start with 0x09) to
        // help operators verify encryption-at-rest without leaking any token bits.
        if (social.AccessTokenEncrypted != null && social.AccessTokenEncrypted.Length > 0)
        {
            _logger?.LogInformation(
                "[LinkedIn connect] persisted encrypted access token: len={Len} firstByte=0x{FirstByte:x2}",
                social.AccessTokenEncrypted.Length,
                social.AccessTokenEncrypted[0]);
        }
        social.TokenExpiresAt = tokenExpiresAt;
        social.Status = "active";
        social.LastRefreshedAt = DateTime.UtcNow;
        // Record the scopes we actually requested so /api/auth/me can surface them
        // without having to re-derive from the LinkedIn docs later.
        social.Scopes = "openid profile email w_member_social";
        // NOTE: legacy User.AccessToken / RefreshToken / TokenExpiresAt dual-write
        // intentionally removed. SocialConnection is now the single source of truth
        // for LinkedIn tokens (planning doc 04 §1.3).
        user.UpdatedAt = DateTime.UtcNow;
        _db.AuthEvents.Add(new AuthEvent
        {
            UserId = user.Id,
            EventType = "integration_connect",
            Provider = "linkedin",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
        });

        _db.OAuthStates.Remove(stateInfo);
        await _db.SaveChangesAsync();
        return Redirect($"{FrontendUrl}/app?linkedin_connected=1");
    }

    [HttpGet("dev-confirm")]
    public IActionResult DevConfirm()
    {
        if (!DevMode) return NotFound(new { detail = "Not found" });

        var html = """
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Sign in · LinkedPush (dev)</title>
            <style>
              body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
                background:#0a0a0a; color:#fff; font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
              .card { width:100%; max-width:380px; border:1px solid rgba(255,255,255,0.1);
                background:rgba(255,255,255,0.02); border-radius:16px; padding:32px; text-align:center; }
              .logo { width:40px; height:40px; margin:0 auto 20px; border-radius:10px;
                background:linear-gradient(135deg,#A78BFA 0%,#7C3AED 50%,#5B21B6 100%);
                display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; }
              h1 { margin:0 0 8px; font-size:20px; font-weight:600; letter-spacing:-0.01em; }
              p  { margin:0 0 24px; color:rgba(255,255,255,0.55); font-size:13px; }
              form { margin:0; }
              button { width:100%; height:40px; border:0; border-radius:6px; background:#7C3AED;
                color:#fff; font-weight:500; font-size:14px; cursor:pointer; }
              button:hover { background:#6D28D9; }
              .badge { display:inline-block; margin-top:16px; padding:2px 8px; border-radius:9999px;
                border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.5); font-size:11px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="logo">LP</div>
              <h1>Continue to LinkedPush</h1>
              <p>You're signing in as the local development user. This screen only appears in dev mode.</p>
              <form method="post" action="/api/auth/dev-login">
                <button type="submit">Continue as Dev User</button>
              </form>
              <div class="badge">dev mode</div>
            </div>
          </body>
        </html>
        """;

        return Content(html, "text/html; charset=utf-8");
    }

    [HttpGet("dev-login")]
    public IActionResult DevLoginGet() =>
        DevMode ? Redirect("/api/auth/dev-confirm") : NotFound(new { detail = "Not found" });

    [HttpPost("dev-login")]
    public async Task<IActionResult> DevLogin()
    {
        if (!DevMode)
            return NotFound(new { detail = "Not found" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.LinkedInId == "dev-user");
        if (user == null)
        {
            user = new User
            {
                LinkedInId = "dev-user",
                Name = "Dev User",
                Email = "dev@linkedpush.local",
                AvatarUrl = null,
#pragma warning disable CS0618 // dev-mode sentinel still written to the legacy column
                AccessToken = "dev-token",
#pragma warning restore CS0618
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }

        await IssueAuthCookies(user);
        return Redirect($"{FrontendUrl}/app");
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var linkedIn = await _db.SocialConnections
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == user.Id && s.Provider == "linkedin");

        // `has_linkedin_token` preserves the legacy shape for existing frontend callers;
        // `linkedin_connection` is the new richer payload new callers should prefer.
        var hasActiveLinkedIn = linkedIn != null
            && string.Equals(linkedIn.Status, "active", StringComparison.OrdinalIgnoreCase)
            && linkedIn.AccessTokenEncrypted != null
            && linkedIn.AccessTokenEncrypted.Length > 0;

        object? connectionPayload = linkedIn == null
            ? null
            : new
            {
                status = linkedIn.Status,
                expires_at = linkedIn.TokenExpiresAt,
                scopes = linkedIn.Scopes,
            };

        return Ok(new
        {
            id = user.Id,
            name = user.Name,
            email = user.Email,
            avatar_url = user.AvatarUrl,
            primary_login_provider = user.PrimaryLoginProvider,
            has_linkedin_token = hasActiveLinkedIn,
            linkedin_connection = connectionPayload,
        });
    }

    [HttpGet("avatar")]
    public async Task<IActionResult> Avatar(CancellationToken ct = default)
    {
        var user = await _session.GetCurrentUser(HttpContext, _db);
        if (user == null) return Unauthorized(new { detail = "Not authenticated" });
        if (string.IsNullOrWhiteSpace(user.AvatarUrl))
            return NotFound(new { detail = "No avatar configured" });

        if (!Uri.TryCreate(user.AvatarUrl, UriKind.Absolute, out var avatarUri) ||
            (avatarUri.Scheme != Uri.UriSchemeHttps && avatarUri.Scheme != Uri.UriSchemeHttp))
            return BadRequest(new { detail = "Invalid avatar URL" });

        var client = _httpFactory.CreateClient();
        using var response = await client.GetAsync(avatarUri, ct);
        if (!response.IsSuccessStatusCode)
            return NotFound(new { detail = "Avatar unavailable" });

        var contentType = response.Content.Headers.ContentType?.MediaType;
        if (string.IsNullOrWhiteSpace(contentType) || !contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            contentType = "image/jpeg";

        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        Response.Headers.CacheControl = "private, max-age=3600";
        return File(bytes, contentType);
    }

    [HttpDelete("me")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> DeleteMe(CancellationToken ct = default)
    {
        var user = await _session.GetCurrentUser(HttpContext, _db);
        if (user == null) return Unauthorized(new { detail = "Not authenticated" });

        var userId = user.Id;

        // Security A3: stamp SessionInvalidBefore BEFORE the transaction begins
        // so any in-flight JWT (Bearer or lp_access cookie) issued before this
        // moment cannot authenticate, even if the user row somehow survives the
        // transaction or is later recreated with the same id. SessionService
        // checks this on every request for all three auth paths.
        user.SessionInvalidBefore = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        // Pre-compute counts for the audit log line. These must be captured BEFORE
        // the delete because the rows themselves will be gone afterward. We log
        // via ILogger (not AuthEvent) because AuthEvent.UserId is SetNull on
        // delete — the row would survive but lose the link, and we'd rather have
        // a durable app-log line than a dangling event row.
        var scheduledPostsCancelled = await _db.Posts
            .CountAsync(p => p.UserId == userId && p.Status == "scheduled", ct);
        var mediaDeleted = await _db.Media
            .CountAsync(m => m.UserId == userId, ct);

        // Wrap in a transaction so a partial failure doesn't leave the user's
        // data half-deleted. The InMemory provider used by tests doesn't support
        // transactions and throws on BeginTransactionAsync, so only open one
        // when the active provider is relational (Postgres in prod).
        var useTransaction = _db.Database.IsRelational();
        var tx = useTransaction ? await _db.Database.BeginTransactionAsync(ct) : null;

        // Delete in dependency order. AppDbContext declares:
        //   User → Identity        : Cascade  (handled by DB on user delete)
        //   User → SocialConnection: Cascade  (handled by DB on user delete)
        //   User → RefreshToken    : Cascade  (handled by DB on user delete)
        //   User → Notification    : Cascade  (handled by DB on user delete)
        //   User → NotificationPreference: Cascade (handled by DB on user delete)
        //   User → Post            : SetNull  (MUST delete explicitly to avoid orphans)
        //   User → Media           : SetNull  (MUST delete explicitly to avoid orphans)
        //   User → AuthEvent       : SetNull  (explicit delete so audit rows don't dangle)
        //   OAuthState.LinkUserId  : SetNull  (OK to leave — rows just lose the link)
        //   Post → Comment         : Cascade  (auto)
        //   Post → Analytics       : Cascade  (auto)
        //   Post → PostMedia       : Cascade  (auto)
        // We also explicitly load posts and media so the InMemory provider (used
        // by tests) honors the cascades — it relies on tracked entity fixup
        // rather than DB-level cascade rules.
        var posts = await _db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Analytics)
            .Include(p => p.PostMedia)
            .Where(p => p.UserId == userId)
            .ToListAsync(ct);
        if (posts.Count > 0) _db.Posts.RemoveRange(posts);

        var media = await _db.Media.Where(m => m.UserId == userId).ToListAsync(ct);
        if (media.Count > 0) _db.Media.RemoveRange(media);

        var authEvents = await _db.AuthEvents.Where(e => e.UserId == userId).ToListAsync(ct);
        if (authEvents.Count > 0) _db.AuthEvents.RemoveRange(authEvents);

        // Explicitly delete OAuthState rows linked to this user. Schema says
        // SetNull, but leaving stale rows around serves no purpose post-deletion.
        var oauthStates = await _db.OAuthStates.Where(o => o.LinkUserId == userId).ToListAsync(ct);
        if (oauthStates.Count > 0) _db.OAuthStates.RemoveRange(oauthStates);

        // The following are DB-level Cascade from User, but we remove them
        // explicitly so the behavior is deterministic across providers (the
        // InMemory provider used by tests doesn't enforce cascade rules unless
        // navigation dependents are tracked).
        var identities = await _db.Identities.Where(i => i.UserId == userId).ToListAsync(ct);
        if (identities.Count > 0) _db.Identities.RemoveRange(identities);

        var socialConnections = await _db.SocialConnections.Where(s => s.UserId == userId).ToListAsync(ct);
        if (socialConnections.Count > 0) _db.SocialConnections.RemoveRange(socialConnections);

        var refreshTokens = await _db.RefreshTokens.Where(r => r.UserId == userId).ToListAsync(ct);
        if (refreshTokens.Count > 0) _db.RefreshTokens.RemoveRange(refreshTokens);

        var notifications = await _db.Notifications.Where(n => n.UserId == userId).ToListAsync(ct);
        if (notifications.Count > 0) _db.Notifications.RemoveRange(notifications);

        var notifPref = await _db.NotificationPreferences.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (notifPref != null) _db.NotificationPreferences.Remove(notifPref);

        _db.Users.Remove(user);

        await _db.SaveChangesAsync(ct);
        if (tx != null)
        {
            await tx.CommitAsync(ct);
            await tx.DisposeAsync();
        }

        _logger?.LogInformation(
            "[account_deleted] user_id={UserId} scheduled_posts_cancelled={Scheduled} media_deleted={Media}",
            userId, scheduledPostsCancelled, mediaDeleted);

        // Clear every auth cookie the app issues so the browser drops state
        // immediately. Matches the Logout() pattern so the frontend can react
        // the same way (redirect to /login).
        Response.Cookies.Delete("session", BuildSessionCookieOptions(includeLifetime: false));
        Response.Cookies.Delete("lp_access", BuildAccessCookieOptions());
        Response.Cookies.Delete("lp_refresh", BuildRefreshCookieOptions());

        return Ok(new { ok = true, deleted_user_id = userId });
    }

    [HttpPost("linkedin/disconnect")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> LinkedInDisconnect()
    {
        var user = await _session.GetCurrentUser(HttpContext, _db);
        if (user == null) return Unauthorized(new { detail = "Not authenticated" });

        int cancelledPosts = 0;

        var connection = await _db.SocialConnections
            .FirstOrDefaultAsync(s => s.UserId == user.Id && s.Provider == "linkedin");
        if (connection != null)
        {
            // Keep the row for audit / reconnect UX — flip status and clear the
            // encrypted token blobs so a revoked connection can never be used.
            connection.Status = "revoked";
            connection.AccessTokenEncrypted = null;
            connection.RefreshTokenEncrypted = null;

            // Proactively fail any future scheduled/processing posts — the
            // scheduler would have failed them silently once their time came.
            // Surface the cause now so post_failed notifications fire and the
            // user can reconnect + reschedule.
            var now = DateTime.UtcNow;
            var duePosts = await _db.Posts
                .Where(p => p.UserId == user.Id
                            && (p.Status == "scheduled" || p.Status == "processing")
                            && (p.ScheduledAt == null || p.ScheduledAt >= now))
                .ToListAsync();
            foreach (var p in duePosts)
            {
                p.Status = "failed";
                p.ErrorMessage = "LinkedIn disconnected — reconnect and reschedule to publish.";
                p.UpdatedAt = now;
            }
            cancelledPosts = duePosts.Count;

            _db.AuthEvents.Add(new AuthEvent
            {
                UserId = user.Id,
                EventType = "integration_disconnect",
                Provider = "linkedin",
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Request.Headers.UserAgent.ToString(),
                Metadata = JsonSerializer.Serialize(new { cancelled_posts = cancelledPosts }),
            });
            await _db.SaveChangesAsync();
        }
        return Ok(new { ok = true, cancelled_posts = cancelledPosts });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var refreshRaw = Request.Cookies["lp_refresh"];
        if (string.IsNullOrWhiteSpace(refreshRaw))
            return Unauthorized(new { detail = "Missing refresh token" });

        var tokenHash = _jwt.HashRefreshToken(refreshRaw);
        var existing = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == tokenHash);
        if (existing == null || existing.ExpiresAt <= DateTime.UtcNow)
            return Unauthorized(new { detail = "Invalid refresh token" });

        if (existing.RevokedAt.HasValue || existing.ReplacedById.HasValue)
        {
            var chainTokens = await _db.RefreshTokens.Where(r => r.ChainId == existing.ChainId).ToListAsync();
            foreach (var token in chainTokens.Where(t => !t.RevokedAt.HasValue))
                token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Unauthorized(new { detail = "Refresh token reuse detected" });
        }

        var user = await _db.Users.FindAsync(existing.UserId);
        if (user == null) return Unauthorized(new { detail = "User not found" });

        var replacementRaw = _jwt.CreateRefreshToken();
        var replacement = new RefreshToken
        {
            ChainId = existing.ChainId,
            UserId = existing.UserId,
            TokenHash = _jwt.HashRefreshToken(replacementRaw),
            IssuedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(_jwt.RefreshTokenLifetime),
            UserAgent = Request.Headers.UserAgent.ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
        };
        _db.RefreshTokens.Add(replacement);
        await _db.SaveChangesAsync();

        existing.RevokedAt = DateTime.UtcNow;
        existing.ReplacedById = replacement.Id;
        _db.AuthEvents.Add(new AuthEvent
        {
            UserId = user.Id,
            EventType = "refresh_issued",
            Provider = "app",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
        });
        await _db.SaveChangesAsync();

        var accessToken = _jwt.CreateAccessToken(user.Id);
        Response.Cookies.Append("lp_access", accessToken, BuildAccessCookieOptions());
        Response.Cookies.Append("lp_refresh", replacementRaw, BuildRefreshCookieOptions());
        return Ok(new { ok = true });
    }

    [HttpPost("logout")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> Logout()
    {
        var user = await _session.GetCurrentUser(HttpContext, _db);
        if (user != null)
        {
            user.SessionInvalidBefore = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            var userRefreshTokens = await _db.RefreshTokens
                .Where(r => r.UserId == user.Id && !r.RevokedAt.HasValue)
                .ToListAsync();
            foreach (var token in userRefreshTokens)
                token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        Response.Cookies.Delete("session", BuildSessionCookieOptions(includeLifetime: false));
        Response.Cookies.Delete("lp_access", BuildAccessCookieOptions());
        Response.Cookies.Delete("lp_refresh", BuildRefreshCookieOptions());
        return Ok(new { ok = true });
    }

    private bool ShouldUseSecureCookies() =>
        AppConfig.GetBool(_config, "Cookie:Secure", "COOKIE_SECURE", fallback: !DevMode);

    private CookieOptions BuildSessionCookieOptions(bool includeLifetime)
    {
        var options = new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = ShouldUseSecureCookies(),
            Path = "/",
        };

        if (includeLifetime)
            options.MaxAge = TimeSpan.FromDays(7);

        if (!string.IsNullOrEmpty(CookieDomain))
            options.Domain = CookieDomain;

        return options;
    }

    private CookieOptions BuildAccessCookieOptions()
    {
        var options = BuildSessionCookieOptions(includeLifetime: false);
        options.MaxAge = _jwt.AccessTokenLifetime;
        return options;
    }

    private CookieOptions BuildRefreshCookieOptions()
    {
        var options = BuildSessionCookieOptions(includeLifetime: false);
        options.MaxAge = _jwt.RefreshTokenLifetime;
        return options;
    }

    private async Task IssueAuthCookies(User user)
    {
        var accessToken = _jwt.CreateAccessToken(user.Id);
        var refreshRaw = _jwt.CreateRefreshToken();
        var refresh = new RefreshToken
        {
            ChainId = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = _jwt.HashRefreshToken(refreshRaw),
            IssuedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(_jwt.RefreshTokenLifetime),
            UserAgent = Request.Headers.UserAgent.ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
        };
        _db.RefreshTokens.Add(refresh);
        await _db.SaveChangesAsync();

        Response.Cookies.Append("lp_access", accessToken, BuildAccessCookieOptions());
        Response.Cookies.Append("lp_refresh", refreshRaw, BuildRefreshCookieOptions());

        var sessionToken = _session.CreateSessionToken(user.Id);
        Response.Cookies.Append("session", sessionToken, BuildSessionCookieOptions(includeLifetime: true));
    }

    private static string CreateRandomUrlToken(int bytes) =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(bytes))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

    private static string? ReadString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;

    private static JwtPayload? DecodeJwtPayload(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var parts = token.Split('.');
        if (parts.Length < 2) return null;
        try
        {
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            while (payload.Length % 4 != 0) payload += "=";
            var payloadBytes = Convert.FromBase64String(payload);
            using var jwtDoc = JsonDocument.Parse(payloadBytes);
            var root = jwtDoc.RootElement;
            var sub = ReadString(root, "sub");
            var email = ReadString(root, "email");
            // email_verified is published as a JSON boolean in real id_tokens but
            // Google's /tokeninfo echoes a string. Accept both forms.
            var emailVerified = false;
            if (root.TryGetProperty("email_verified", out var ev))
            {
                emailVerified = ev.ValueKind switch
                {
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.String => string.Equals(ev.GetString(), "true", StringComparison.OrdinalIgnoreCase),
                    _ => false,
                };
            }
            var name = ReadString(root, "name");
            var picture = ReadString(root, "picture");
            var nonce = ReadString(root, "nonce");
            return new JwtPayload(sub, email, emailVerified, name, picture, nonce);
        }
        catch
        {
            return null;
        }
    }

    private sealed record JwtPayload(string? Sub, string? Email, bool EmailVerified, string? Name, string? Picture, string? Nonce);

    private sealed record GoogleTokenInfo(string Sub);

    private async Task<GoogleTokenInfo?> ValidateGoogleIdToken(string idToken)
    {
        var client = _httpFactory.CreateClient();
        var tokenInfoResp = await client.GetAsync($"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}");
        if (!tokenInfoResp.IsSuccessStatusCode)
            return null;

        var body = await tokenInfoResp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var aud = root.TryGetProperty("aud", out var audNode) ? audNode.GetString() : null;
        var iss = root.TryGetProperty("iss", out var issNode) ? issNode.GetString() : null;
        var expRaw = root.TryGetProperty("exp", out var expNode) ? expNode.GetString() : null;
        var sub = root.TryGetProperty("sub", out var subNode) ? subNode.GetString() : null;
        if (string.IsNullOrWhiteSpace(sub))
            return null;
        if (!string.Equals(aud, GoogleClientId, StringComparison.Ordinal))
            return null;
        if (!string.Equals(iss, "accounts.google.com", StringComparison.Ordinal) &&
            !string.Equals(iss, "https://accounts.google.com", StringComparison.Ordinal))
            return null;
        if (!long.TryParse(expRaw, out var expUnix) || DateTimeOffset.FromUnixTimeSeconds(expUnix) <= DateTimeOffset.UtcNow)
            return null;

        return new GoogleTokenInfo(sub);
    }
}
