using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging.Abstractions;
using LinkedPushApi.Services;
using Xunit;

namespace LinkedPushApi.Tests;

public class TokenProtectorTests
{
    private static TokenProtector Create() =>
        new TokenProtector(
            DataProtectionProvider.Create("LinkedPush.Tests"),
            NullLogger<TokenProtector>.Instance);

    [Fact]
    public void TokenProtector_roundtrips_protect_and_unprotect()
    {
        var protector = Create();
        var original = "li-access-token-abc-123";

        var protectedBytes = protector.Protect(original);
        Assert.NotNull(protectedBytes);
        // Ciphertext should NOT be a UTF-8 encoding of the plaintext.
        Assert.NotEqual(Encoding.UTF8.GetBytes(original), protectedBytes);

        var recovered = protector.Unprotect(protectedBytes);
        Assert.Equal(original, recovered);
    }

    [Fact]
    public void TokenProtector_returns_null_for_null_input()
    {
        var protector = Create();

        Assert.Null(protector.Protect(null));
        Assert.Null(protector.Protect(""));
        Assert.Null(protector.Unprotect(null));
        Assert.Null(protector.Unprotect(Array.Empty<byte>()));
    }

    [Fact]
    public void TokenProtector_Unprotect_falls_back_to_plaintext_for_legacy_rows()
    {
        // Simulate a legacy row written before Data Protection rollout — raw UTF-8
        // bytes in the access_token_encrypted column. Unprotect() must still return
        // the original string so GetValidAccessToken keeps working while rows heal
        // lazily on their next write.
        var protector = Create();
        var legacy = "legacy-plaintext-token";
        var legacyBytes = Encoding.UTF8.GetBytes(legacy);

        var result = protector.Unprotect(legacyBytes);

        Assert.Equal(legacy, result);
    }
}
