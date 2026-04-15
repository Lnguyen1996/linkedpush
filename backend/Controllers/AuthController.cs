using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
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
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public AuthController(AppDbContext db, SessionService session, IConfiguration config, IHttpClientFactory httpFactory)
    {
        _db = db;
        _session = session;
        _config = config;
        _httpFactory = httpFactory;
    }

    private bool DevMode => (_config["DevMode"] ?? "true").Equals("true", StringComparison.OrdinalIgnoreCase);
    private string ClientId => _config["LinkedIn:ClientId"] ?? "";
    private string ClientSecret => _config["LinkedIn:ClientSecret"] ?? "";
    private string RedirectUri => _config["LinkedIn:RedirectUri"] ?? "http://localhost:5173/auth/callback";
    private string FrontendUrl => _config["FrontendUrl"] ?? "http://localhost:5173";
    private string? CookieDomain => _config["CookieDomain"];

    [HttpGet("login")]
    public async Task<IActionResult> Login([FromQuery] int? cli_port = null)
    {
        if (string.IsNullOrEmpty(ClientId))
            return StatusCode(500, new { detail = "LinkedIn OAuth is not configured. Set LinkedIn:ClientId and LinkedIn:ClientSecret in appsettings.json." });

        var cutoff = DateTime.UtcNow.AddMinutes(-10);
        var expiredStates = await _db.OAuthStates
            .Where(o => o.CreatedAt < cutoff)
            .ToListAsync();
        if (expiredStates.Count > 0)
        {
            _db.OAuthStates.RemoveRange(expiredStates);
            await _db.SaveChangesAsync();
        }

        var state = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        _db.OAuthStates.Add(new OAuthState
        {
            State = state,
            CreatedAt = DateTime.UtcNow,
            CliPort = cli_port,
        });
        await _db.SaveChangesAsync();

        var query = $"response_type=code&client_id={ClientId}&redirect_uri={Uri.EscapeDataString(RedirectUri)}&scope={Uri.EscapeDataString("openid profile email w_member_social")}&state={state}&prompt=login";
        return Ok(new { redirect_url = $"https://www.linkedin.com/oauth/v2/authorization?{query}" });
    }

    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string? code = null, [FromQuery] string? state = null, [FromQuery] string? error = null, [FromQuery] string? error_description = null)
    {
        if (!string.IsNullOrEmpty(error))
            return Redirect($"{FrontendUrl}/login?error={Uri.EscapeDataString(error_description ?? error)}");

        if (string.IsNullOrEmpty(code))
            return BadRequest(new { detail = "Missing authorization code" });
        int? cliPort = null;
        OAuthState? stateInfo = null;
        if (!string.IsNullOrEmpty(ClientId) && !string.IsNullOrEmpty(state))
        {
            stateInfo = await _db.OAuthStates
                .FirstOrDefaultAsync(o => o.State == state);
            if (stateInfo == null || stateInfo.CreatedAt < DateTime.UtcNow.AddMinutes(-10))
                return BadRequest(new { detail = "Invalid or expired state parameter" });
            cliPort = stateInfo.CliPort;
        }

        // Exchange code for tokens
        var client = _httpFactory.CreateClient();
        var tokenContent = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = RedirectUri,
            ["client_id"] = ClientId,
            ["client_secret"] = ClientSecret,
        });

        var tokenResp = await client.PostAsync("https://www.linkedin.com/oauth/v2/accessToken", tokenContent);
        if (!tokenResp.IsSuccessStatusCode)
            return BadRequest(new { detail = "Failed to exchange code for token" });

        if (stateInfo != null)
        {
            _db.OAuthStates.Remove(stateInfo);
            await _db.SaveChangesAsync();
        }

        var tokenJson = await tokenResp.Content.ReadAsStringAsync();
        using var tokenDoc = JsonDocument.Parse(tokenJson);
        var tokenRoot = tokenDoc.RootElement;
        var accessToken = tokenRoot.GetProperty("access_token").GetString()!;
        var refreshToken = tokenRoot.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = tokenRoot.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
        var tokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);

        // Extract user profile from id_token (OIDC) or access token JWT
        var linkedInId = "";
        var name = "LinkedIn User";
        string? email = null;
        string? avatarUrl = null;

        // Step 1: Try id_token first (returned when openid scope is granted)
        var idToken = tokenRoot.TryGetProperty("id_token", out var idt) ? idt.GetString() : null;
        var tokenToDecode = idToken ?? accessToken;

        try
        {
            var parts = tokenToDecode.Split('.');
            if (parts.Length >= 2)
            {
                var payload = parts[1].Replace('-', '+').Replace('_', '/');
                switch (payload.Length % 4)
                {
                    case 2: payload += "=="; break;
                    case 3: payload += "="; break;
                }
                var payloadBytes = Convert.FromBase64String(payload);
                using var jwtDoc = JsonDocument.Parse(payloadBytes);
                var jwt = jwtDoc.RootElement;
                linkedInId = jwt.TryGetProperty("sub", out var sub) ? sub.GetString() ?? "" : "";
                var jwtName = jwt.TryGetProperty("name", out var n) ? n.GetString() : null;
                if (!string.IsNullOrEmpty(jwtName)) name = jwtName;
                email = jwt.TryGetProperty("email", out var em) ? em.GetString() : null;
                avatarUrl = jwt.TryGetProperty("picture", out var pic) ? pic.GetString() : null;
            }
        }
        catch
        {
            // JWT decoding failed — will try API fallback
        }

        // Step 2: Always try /v2/me API for profile info (works with w_member_social scope)
        // Use a fresh HttpClient to avoid header contamination from the token exchange
        try
        {
            var profileClient = _httpFactory.CreateClient();
            profileClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");
            var profileResp = await profileClient.GetAsync("https://api.linkedin.com/v2/me");
            var profileBody = await profileResp.Content.ReadAsStringAsync();
            Console.WriteLine($"[Auth] /v2/me status={profileResp.StatusCode} body={profileBody[..Math.Min(500, profileBody.Length)]}");

            if (profileResp.IsSuccessStatusCode)
            {
                using var profileDoc = JsonDocument.Parse(profileBody);
                var profile = profileDoc.RootElement;

                // Extract LinkedIn member ID
                var profileId = profile.TryGetProperty("id", out var pid) ? pid.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(profileId))
                    linkedInId = profileId;

                // Extract name from localizedFirstName + localizedLastName
                var firstName = profile.TryGetProperty("localizedFirstName", out var fn) ? fn.GetString() : null;
                var lastName = profile.TryGetProperty("localizedLastName", out var ln) ? ln.GetString() : null;
                var fullName = $"{firstName} {lastName}".Trim();
                if (!string.IsNullOrEmpty(fullName))
                    name = fullName;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Auth] /v2/me failed: {ex.Message}");
        }

        // Fallback: if we still don't have an ID, hash the token
        if (string.IsNullOrEmpty(linkedInId))
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            var hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(accessToken));
            linkedInId = Convert.ToHexString(hash)[..16].ToLower();
        }

        // Upsert user
        var user = await _db.Users.FirstOrDefaultAsync(u => u.LinkedInId == linkedInId);
        if (user != null)
        {
            user.Name = name;
            user.Email = email;
            user.AvatarUrl = avatarUrl;
            user.AccessToken = accessToken;
            user.RefreshToken = refreshToken ?? user.RefreshToken;
            user.TokenExpiresAt = tokenExpiresAt;
            user.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            user = new User
            {
                LinkedInId = linkedInId,
                Name = name,
                Email = email,
                AvatarUrl = avatarUrl,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                TokenExpiresAt = tokenExpiresAt,
            };
            _db.Users.Add(user);
        }

        await _db.SaveChangesAsync();

        var sessionToken = _session.CreateSessionToken(user.Id);
        var cookieOpts = new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromDays(7),
        };
        if (!string.IsNullOrEmpty(CookieDomain))
            cookieOpts.Domain = CookieDomain;
        Response.Cookies.Append("session", sessionToken, cookieOpts);

        if (cliPort.HasValue)
            return Redirect($"http://localhost:{cliPort.Value}/cli-callback?session={Uri.EscapeDataString(sessionToken)}");

        return Redirect($"{FrontendUrl}/app");
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
                AccessToken = "dev-token",
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }

        var sessionToken = _session.CreateSessionToken(user.Id);
        var cookieOpts = new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromDays(7),
        };
        if (!string.IsNullOrEmpty(CookieDomain))
            cookieOpts.Domain = CookieDomain;
        Response.Cookies.Append("session", sessionToken, cookieOpts);
        return Redirect($"{FrontendUrl}/app");
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        return Ok(new
        {
            id = user.Id,
            name = user.Name,
            email = user.Email,
            avatar_url = user.AvatarUrl,
            has_linkedin_token = !string.IsNullOrEmpty(user.AccessToken) && user.AccessToken != "dev-token",
        });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("session");
        return Ok(new { ok = true });
    }
}
