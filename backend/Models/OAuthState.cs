using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

/// <summary>
/// One-shot OAuth start state. Holds CSRF / replay protection material for both the
/// legacy LinkedIn callback and the new Google/PKCE flows. See planning doc 04 §1.5.
/// Sensitive columns (<see cref="CodeVerifier"/>, <see cref="Nonce"/>) must never be logged
/// and are TTL-pruned by <see cref="LinkedPushApi.Services.OAuthStateCleanupService"/>.
/// </summary>
[Table("oauth_states")]
public class OAuthState
{
    [Key]
    [Column("state")]
    [MaxLength(128)]
    public string State { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("cli_port")]
    public int? CliPort { get; set; }

    /// <summary>
    /// Provider tag for the in-flight flow: <c>linkedin</c> (legacy default), <c>google</c>, ...
    /// Backfilled to <c>linkedin</c> for pre-migration rows; new flows always set this explicitly.
    /// </summary>
    [Column("provider")]
    [Required]
    [MaxLength(32)]
    public string Provider { get; set; } = "linkedin";

    /// <summary>
    /// PKCE verifier (RFC 7636). Required for Google; null for legacy LinkedIn rows.
    /// Sensitive — do not log.
    /// </summary>
    [Column("code_verifier")]
    [MaxLength(128)]
    public string? CodeVerifier { get; set; }

    /// <summary>
    /// OIDC nonce. Mandatory for Google login flows (planning doc 06 §2 / §2.1).
    /// Validated on callback and cleared. Sensitive — do not log.
    /// </summary>
    [Column("nonce")]
    [MaxLength(128)]
    public string? Nonce { get; set; }

    /// <summary>
    /// Post-auth redirect target (relative path or absolute URL). Application-side allowlist
    /// is mandatory before issuing a Redirect — see planning doc 06 §2 (open-redirect mitigation).
    /// </summary>
    [Column("redirect_after_login")]
    [MaxLength(2000)]
    public string? RedirectAfterLogin { get; set; }

    /// <summary>
    /// Flow intent: <c>login</c>, <c>signup</c>, <c>link_provider</c>, <c>cli_login</c>.
    /// Drives server-side validation (e.g. only <c>link_provider</c> is allowed to attach to <see cref="LinkUserId"/>).
    /// </summary>
    [Column("intent")]
    [MaxLength(32)]
    public string? Intent { get; set; }

    /// <summary>
    /// When <see cref="Intent"/> is <c>link_provider</c>, the existing user being linked.
    /// FK is <c>ON DELETE SET NULL</c> so cleanup of stale rows is forgiving.
    /// </summary>
    [Column("link_user_id")]
    public int? LinkUserId { get; set; }

    public User? LinkUser { get; set; }
}
