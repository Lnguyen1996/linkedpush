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

    [Column("access_token")]
    [MaxLength(1000)]
    public string? AccessToken { get; set; }

    [Column("refresh_token")]
    [MaxLength(1000)]
    public string? RefreshToken { get; set; }

    [Column("token_expires_at")]
    public DateTime? TokenExpiresAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<Media> MediaItems { get; set; } = new List<Media>();
}
