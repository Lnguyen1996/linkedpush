using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("posts")]
public class Post
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("user_id")]
    public int? UserId { get; set; }

    [Column("title")]
    [MaxLength(255)]
    public string? Title { get; set; }

    [Column("content")]
    [Required]
    public string Content { get; set; } = "";

    [Column("status")]
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "draft";

    [Column("scheduled_at")]
    public DateTime? ScheduledAt { get; set; }

    [Column("timezone")]
    [MaxLength(50)]
    public string? Timezone { get; set; } = "UTC";

    [Column("published_at")]
    public DateTime? PublishedAt { get; set; }

    [Column("linkedin_post_id")]
    [MaxLength(255)]
    public string? LinkedInPostId { get; set; }

    [Column("linkedin_post_urn")]
    [MaxLength(255)]
    public string? LinkedInPostUrn { get; set; }

    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    [Column("image_id")]
    public int? ImageId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("ImageId")]
    public Media? Image { get; set; }

    public Comment? FirstComment { get; set; }
    public Analytics? Analytics { get; set; }
}
