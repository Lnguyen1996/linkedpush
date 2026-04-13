using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class SessionService
{
    private readonly string _secretKey;

    public SessionService(IConfiguration config)
    {
        _secretKey = config["SecretKey"] ?? "dev-secret-key-change-in-production";
    }

    public string CreateSessionToken(int userId)
    {
        var payload = JsonSerializer.Serialize(new { user_id = userId, ts = DateTime.UtcNow.ToString("o") });
        var payloadB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payload))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var sig = ComputeHmac(payloadB64);
        return $"{payloadB64}.{sig}";
    }

    public int? VerifySessionToken(string token)
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
            if (doc.RootElement.TryGetProperty("user_id", out var uid))
                return uid.GetInt32();
            return null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<User?> GetCurrentUser(HttpContext context, AppDbContext db)
    {
        var token = context.Request.Cookies["session"];
        if (string.IsNullOrEmpty(token)) return null;
        var userId = VerifySessionToken(token);
        if (userId == null) return null;
        return await db.Users.FindAsync(userId.Value);
    }

    public async Task<User> RequireCurrentUser(HttpContext context, AppDbContext db)
    {
        var user = await GetCurrentUser(context, db);
        if (user == null)
            throw new UnauthorizedAccessException("Not authenticated");
        return user;
    }

    private string ComputeHmac(string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexStringLower(hash);
    }
}
