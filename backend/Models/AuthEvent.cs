using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

/// <summary>
/// Durable, queryable security/audit log row. Append-only at the application layer;
/// retention/redaction governed by ops. See planning doc 04 §1.6 / 06 §9.
/// Never put raw tokens, OAuth codes, code_verifier, or nonce values in <see cref="Metadata"/>.
/// </summary>
[Table("auth_events")]
public class AuthEvent
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    /// <summary>NULL when the event has no resolved user yet (e.g. pre-auth failure).</summary>
    [Column("user_id")]
    public int? UserId { get; set; }

    /// <summary>
    /// Stable snake_case event identifier, e.g. <c>login_success</c>, <c>refresh_issued</c>,
    /// <c>refresh_reuse_detected</c>, <c>cli_code_issued</c>, <c>integration_connect</c>.
    /// </summary>
    [Column("event_type")]
    [Required]
    [MaxLength(64)]
    public string EventType { get; set; } = "";

    /// <summary>Provider tag (<c>google</c>, <c>linkedin</c>, <c>app</c>, <c>cli</c>) or null.</summary>
    [Column("provider")]
    [MaxLength(32)]
    public string? Provider { get; set; }

    /// <summary>
    /// Stored as text for portability; the migration declares Postgres <c>inet</c>
    /// when running on Postgres for index-friendly storage.
    /// </summary>
    [Column("ip_address")]
    public string? IpAddress { get; set; }

    [Column("user_agent")]
    public string? UserAgent { get; set; }

    /// <summary>Redacted JSON metadata. Persisted as <c>jsonb</c> on Postgres.</summary>
    [Column("metadata")]
    public string? Metadata { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
