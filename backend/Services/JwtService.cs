using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace LinkedPushApi.Services;

public class JwtService
{
    public sealed record AccessTokenData(int UserId, DateTimeOffset IssuedAt);

    private readonly string _issuer;
    private readonly string _audience;
    private readonly TimeSpan _accessTokenLifetime;
    private readonly TimeSpan _refreshTokenLifetime;
    private readonly byte[] _jwtKey;
    private readonly JwtSecurityTokenHandler _handler = new();

    public JwtService(IConfiguration config)
    {
        _issuer = AppConfig.Get(config, "Jwt:Issuer", "JWT_ISSUER", "linkedpush");
        _audience = AppConfig.Get(config, "Jwt:Audience", "JWT_AUDIENCE", "linkedpush-web");
        _accessTokenLifetime = TimeSpan.FromMinutes(ParseInt(config, "Jwt:AccessMinutes", "JWT_ACCESS_MINUTES", 15));
        _refreshTokenLifetime = TimeSpan.FromDays(ParseInt(config, "Jwt:RefreshDays", "JWT_REFRESH_DAYS", 30));

        var key = AppConfig.Get(config, "Jwt:Key", "JWT_KEY", AppConfig.Get(config, "SecretKey", "SECRET_KEY"));
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("JWT signing key is required and must be at least 32 characters.");

        _jwtKey = Encoding.UTF8.GetBytes(key);
    }

    public TimeSpan AccessTokenLifetime => _accessTokenLifetime;
    public TimeSpan RefreshTokenLifetime => _refreshTokenLifetime;

    public string CreateAccessToken(int userId)
    {
        var now = DateTime.UtcNow;
        var credentials = new SigningCredentials(new SymmetricSecurityKey(_jwtKey), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            },
            notBefore: now,
            expires: now.Add(_accessTokenLifetime),
            signingCredentials: credentials);

        return _handler.WriteToken(token);
    }

    public AccessTokenData? VerifyAccessToken(string token)
    {
        try
        {
            var parameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(_jwtKey),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
            };

            var principal = _handler.ValidateToken(token, parameters, out var validatedToken);
            if (validatedToken is not JwtSecurityToken jwt || jwt.Header.Alg != SecurityAlgorithms.HmacSha256)
                return null;

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            var iat = principal.FindFirst(JwtRegisteredClaimNames.Iat)?.Value;
            if (!int.TryParse(sub, out var userId))
                return null;

            var issuedAt = DateTimeOffset.UtcNow;
            if (long.TryParse(iat, out var iatUnix))
                issuedAt = DateTimeOffset.FromUnixTimeSeconds(iatUnix);

            return new AccessTokenData(userId, issuedAt);
        }
        catch
        {
            return null;
        }
    }

    public string CreateRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    public byte[] HashRefreshToken(string rawToken)
    {
        using var sha = SHA256.Create();
        return sha.ComputeHash(Encoding.UTF8.GetBytes(rawToken));
    }

    private static int ParseInt(IConfiguration config, string key, string envKey, int fallback)
    {
        var raw = AppConfig.Get(config, key, envKey, fallback.ToString());
        return int.TryParse(raw, out var value) && value > 0 ? value : fallback;
    }
}
