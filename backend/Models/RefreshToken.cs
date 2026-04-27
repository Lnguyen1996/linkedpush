using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

/// <summary>
/// Opaque refresh token persisted as a hash. Supports rotation via <see cref="ReplacedById"/>
/// and full-chain revocation via <see cref="ChainId"/> (planning doc 04 §1.4 + 06 §4).
/// Never store the raw token; the cookie holds the only plaintext copy.
/// </summary>
[Table("refresh_tokens")]
public class RefreshToken
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    /// <summary>
    /// Stable family id for the entire rotation chain. New row on every rotation reuses
    /// the same chain_id, so a single UPDATE … WHERE chain_id = :c revokes the whole family
    /// when reuse is detected (mandatory per E1 §2.3 / E6 §4.2).
    /// </summary>
    [Column("chain_id")]
    public Guid ChainId { get; set; }

    [Column("user_id")]
    public int UserId { get; set; }

    public User? User { get; set; }

    /// <summary>SHA-256 (32 bytes) of the raw token, optionally peppered server-side.</summary>
    [Column("token_hash")]
    public byte[] TokenHash { get; set; } = Array.Empty<byte>();

    [Column("issued_at")]
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("revoked_at")]
    public DateTime? RevokedAt { get; set; }

    /// <summary>Self-FK pointing to the row that superseded this one in a rotation chain.</summary>
    [Column("replaced_by_id")]
    public long? ReplacedById { get; set; }

    public RefreshToken? ReplacedBy { get; set; }

    [Column("user_agent")]
    public string? UserAgent { get; set; }

    /// <summary>
    /// Stored as text for cross-environment portability; the migration declares Postgres
    /// <c>inet</c> when running on Postgres so the planner can use it.
    /// </summary>
    [Column("ip_address")]
    public string? IpAddress { get; set; }
}
