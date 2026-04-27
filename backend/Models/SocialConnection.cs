using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

/// <summary>
/// API integration / publishing tokens for an external provider (LinkedIn posting, future Twitter, etc.).
/// Distinct from <see cref="Identity"/>, which records login subjects. See planning doc 04 §1.3.
/// Tokens are stored encrypted-at-rest as <c>bytea</c>; never log decrypted values.
/// </summary>
[Table("social_connections")]
public class SocialConnection
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public int UserId { get; set; }

    public User? User { get; set; }

    [Column("provider")]
    [Required]
    [MaxLength(32)]
    public string Provider { get; set; } = "";

    /// <summary>Provider's account id for the integration target.</summary>
    [Column("provider_user_id")]
    [Required]
    [MaxLength(255)]
    public string ProviderUserId { get; set; } = "";

    /// <summary>
    /// Ciphertext of the OAuth access token. Encrypted via ASP.NET Core Data Protection
    /// with purpose <c>LinkedPush.Social.v1</c>. Never log this column.
    /// </summary>
    [Column("access_token_encrypted")]
    public byte[]? AccessTokenEncrypted { get; set; }

    /// <summary>
    /// Ciphertext of the OAuth refresh token. May be null for providers without refresh.
    /// </summary>
    [Column("refresh_token_encrypted")]
    public byte[]? RefreshTokenEncrypted { get; set; }

    [Column("token_expires_at")]
    public DateTime? TokenExpiresAt { get; set; }

    [Column("scopes")]
    public string? Scopes { get; set; }

    [Column("connected_at")]
    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;

    [Column("last_refreshed_at")]
    public DateTime? LastRefreshedAt { get; set; }

    /// <summary>
    /// Lifecycle state: <c>active</c>, <c>revoked</c>, <c>expired</c>, or <c>mock</c> (dev-only).
    /// See planning doc 03 §6.1 for the dev-only mock contract.
    /// </summary>
    [Column("status")]
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "active";
}
