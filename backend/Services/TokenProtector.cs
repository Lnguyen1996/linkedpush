using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;

namespace LinkedPushApi.Services;

/// <summary>
/// Thin wrapper around ASP.NET Core Data Protection for encrypting SocialConnection
/// access and refresh tokens at rest. Purpose string is versioned so we can rotate
/// keys or scheme in the future without breaking legacy rows.
///
/// Legacy plaintext handling: prior to this wrapper, tokens were stored as raw
/// UTF-8 bytes. <see cref="Unprotect"/> detects a <see cref="CryptographicException"/>
/// from the DP API, logs once, and returns the plaintext interpretation so existing
/// rows keep working. The next write to that row re-encrypts the value.
/// </summary>
public class TokenProtector
{
    private readonly IDataProtector _protector;
    private readonly ILogger<TokenProtector> _logger;

    public TokenProtector(IDataProtectionProvider provider, ILogger<TokenProtector> logger)
    {
        _protector = provider.CreateProtector("LinkedPush.SocialConnection.Token.v1");
        _logger = logger;
    }

    /// <summary>
    /// Encrypts a plaintext token. Returns null for null/empty input.
    /// </summary>
    public byte[]? Protect(string? plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return null;
        var inputBytes = Encoding.UTF8.GetBytes(plaintext);
        return _protector.Protect(inputBytes);
    }

    /// <summary>
    /// Decrypts ciphertext. Returns null for null/empty input. If decryption
    /// raises <see cref="CryptographicException"/> the ciphertext is assumed to
    /// be a legacy plaintext row (prior to Data Protection rollout) and the
    /// UTF-8 interpretation is returned. Caller will re-encrypt on next write.
    /// </summary>
    public string? Unprotect(byte[]? ciphertext)
    {
        if (ciphertext == null || ciphertext.Length == 0) return null;
        try
        {
            var plain = _protector.Unprotect(ciphertext);
            return Encoding.UTF8.GetString(plain);
        }
        catch (CryptographicException)
        {
            _logger.LogInformation(
                "[TokenProtector] Found plaintext token, will re-encrypt on next write");
            return Encoding.UTF8.GetString(ciphertext);
        }
    }
}
