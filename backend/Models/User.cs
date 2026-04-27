using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("linkedin_id")]
    [MaxLength(100)]
    public string LinkedInId { get; set; } = "";

    [Column("email")]
    [MaxLength(255)]
    public string? Email { get; set; }

    [Column("name")]
    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = "";

    [Column("avatar_url")]
    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    /// <summary>
    /// DEPRECATED. LinkedIn access tokens now live on <see cref="SocialConnection"/>
    /// (provider = "linkedin"). This column is kept for the rollback window only and
    /// is no longer read or written by application code. Dev-mode fixture still sets
    /// this to <c>"dev-token"</c> as a sentinel until dev-mode is reshaped to use
    /// SocialConnection.
    /// </summary>
    [Obsolete("Use SocialConnection. Kept for rollback window; remove in next milestone.")]
    [Column("access_token")]
    [MaxLength(1000)]
    public string? AccessToken { get; set; }

    /// <summary>
    /// DEPRECATED. See <see cref="AccessToken"/>.
    /// </summary>
    [Obsolete("Use SocialConnection. Kept for rollback window; remove in next milestone.")]
    [Column("refresh_token")]
    [MaxLength(1000)]
    public string? RefreshToken { get; set; }

    /// <summary>
    /// DEPRECATED. See <see cref="AccessToken"/>.
    /// </summary>
    [Obsolete("Use SocialConnection. Kept for rollback window; remove in next milestone.")]
    [Column("token_expires_at")]
    public DateTime? TokenExpiresAt { get; set; }

    /// <summary>
    /// True once an IdP confirmed this email (Google OIDC <c>email_verified</c>, etc.).
    /// Required gate before email is trusted for any security-sensitive decision (planning doc 06 §3).
    /// </summary>
    [Column("email_verified")]
    public bool EmailVerified { get; set; }

    /// <summary>
    /// Provider that last authenticated this user: <c>google</c>, <c>linkedin</c>, ... or NULL
    /// while the column is being backfilled. Never defaulted to a specific provider in the DB
    /// (planning doc 04 §1.1) — the application sets it explicitly on every login.
    /// </summary>
    [Column("primary_login_provider")]
    [MaxLength(32)]
    public string? PrimaryLoginProvider { get; set; }

    [Column("session_invalid_before")]
    public DateTime? SessionInvalidBefore { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<Media> MediaItems { get; set; } = new List<Media>();
    public ICollection<Identity> Identities { get; set; } = new List<Identity>();
    public ICollection<SocialConnection> SocialConnections { get; set; } = new List<SocialConnection>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
