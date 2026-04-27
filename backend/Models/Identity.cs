using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

/// <summary>
/// External identity provider subject (e.g. Google sub, LinkedIn member id) bound to a LinkedPush user.
/// One user can own multiple identities (Google + LinkedIn). See planning doc 04 §1.2.
/// </summary>
[Table("identities")]
public class Identity
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public int UserId { get; set; }

    public User? User { get; set; }

    /// <summary>Provider name: <c>google</c>, <c>linkedin</c>, ...</summary>
    [Column("provider")]
    [Required]
    [MaxLength(32)]
    public string Provider { get; set; } = "";

    /// <summary>Stable provider subject (Google <c>sub</c>, LinkedIn member id, etc.).</summary>
    [Column("provider_user_id")]
    [Required]
    [MaxLength(255)]
    public string ProviderUserId { get; set; } = "";

    /// <summary>Snapshot of email at link / last login. Identity emails may change at the IdP.</summary>
    [Column("email")]
    [MaxLength(255)]
    public string? Email { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_login_at")]
    public DateTime? LastLoginAt { get; set; }
}
