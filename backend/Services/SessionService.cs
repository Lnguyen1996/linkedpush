using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class SessionService
{
    public sealed record SessionTokenData(int UserId, DateTimeOffset IssuedAt);

    private readonly string _secretKey;
    private readonly JwtService _jwtService;

    public SessionService(IConfiguration config, JwtService jwtService)
    {
        var secretKey = config["SecretKey"];
        if (string.IsNullOrEmpty(secretKey))
            throw new InvalidOperationException(
                "SecretKey configuration is required. Set the 'SecretKey' environment variable to a cryptographically random string (at least 32 bytes).");
        _secretKey = secretKey;
        _jwtService = jwtService;
    }

    public string CreateSessionToken(int userId)
    {
        var payload = JsonSerializer.Serialize(new
        {
            user_id = userId,
            iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
        });
        var payloadB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payload))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var sig = ComputeHmac(payloadB64);
        return $"{payloadB64}.{sig}";
    }

    public SessionTokenData? VerifySessionToken(string token)
    {
        try
        {
            var lastDot = token.LastIndexOf('.');
            if (lastDot < 0) return null;
            var payloadB64 = token[..lastDot];
            var sig = token[(lastDot + 1)..];
            var expectedSig = ComputeHmac(payloadB64);

            if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(sig),
                Encoding.UTF8.GetBytes(expectedSig)))
                return null;

            // Restore standard base64 padding
            var padded = payloadB64.Replace('-', '+').Replace('_', '/');
            switch (padded.Length % 4)
            {
                case 2: padded += "=="; break;
                case 3: padded += "="; break;
            }
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("user_id", out var uid))
                return null;

            DateTimeOffset issuedAt;
            if (doc.RootElement.TryGetProperty("iat", out var iatProp) && iatProp.ValueKind == JsonValueKind.Number)
            {
                issuedAt = DateTimeOffset.FromUnixTimeSeconds(iatProp.GetInt64());
            }
            else if (doc.RootElement.TryGetProperty("ts", out var tsProp))
            {
                if (!DateTimeOffset.TryParse(tsProp.GetString(), out var parsedTs))
                    return null;
                issuedAt = parsedTs;
            }
            else
            {
                return null; // no timestamp — treat as invalid
            }

            var age = DateTimeOffset.UtcNow - issuedAt;
            if (age > TimeSpan.FromDays(7) || age < TimeSpan.Zero)
                return null;

            return new SessionTokenData(uid.GetInt32(), issuedAt);
        }
        catch
        {
            return null;
        }
    }

    public async Task<User?> GetCurrentUser(HttpContext context, AppDbContext db)
    {
        var bearer = context.Request.Headers.Authorization.ToString();
        if (bearer.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var jwt = bearer["Bearer ".Length..].Trim();
            if (!string.IsNullOrWhiteSpace(jwt))
            {
                var jwtTokenData = _jwtService.VerifyAccessToken(jwt);
                if (jwtTokenData != null)
                {
                    var jwtUser = await db.Users.FindAsync(jwtTokenData.UserId);
                    if (jwtUser != null && !IsJwtInvalidated(jwtUser, jwtTokenData.IssuedAt))
                        return jwtUser;
                }
            }
        }

        var accessCookie = context.Request.Cookies["lp_access"];
        if (!string.IsNullOrWhiteSpace(accessCookie))
        {
            var jwtCookieData = _jwtService.VerifyAccessToken(accessCookie);
            if (jwtCookieData != null)
            {
                var jwtUser = await db.Users.FindAsync(jwtCookieData.UserId);
                if (jwtUser != null && !IsJwtInvalidated(jwtUser, jwtCookieData.IssuedAt))
                    return jwtUser;
            }
        }

        var token = context.Request.Cookies["session"];
        if (string.IsNullOrEmpty(token)) return null;
        var tokenData = VerifySessionToken(token);
        if (tokenData == null) return null;
        var user = await db.Users.FindAsync(tokenData.UserId);
        if (user == null) return null;
        if (user.SessionInvalidBefore.HasValue &&
            tokenData.IssuedAt <= new DateTimeOffset(DateTime.SpecifyKind(user.SessionInvalidBefore.Value, DateTimeKind.Utc)))
            return null;
        return user;
    }

    public async Task<User> RequireCurrentUser(HttpContext context, AppDbContext db)
    {
        var user = await GetCurrentUser(context, db);
        if (user == null)
            throw new UnauthorizedAccessException("Not authenticated");
        return user;
    }

    private static bool IsJwtInvalidated(User user, DateTimeOffset issuedAt)
    {
        if (!user.SessionInvalidBefore.HasValue) return false;
        var invalidBefore = new DateTimeOffset(DateTime.SpecifyKind(user.SessionInvalidBefore.Value, DateTimeKind.Utc));
        return issuedAt <= invalidBefore;
    }

    private string ComputeHmac(string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexStringLower(hash);
    }
}
