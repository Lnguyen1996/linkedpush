using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("comments")]
public class Comment
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("post_id")]
    [Required]
    public int PostId { get; set; }

    [Column("content")]
    [Required]
    public string Content { get; set; } = "";

    [Column("linkedin_comment_id")]
    [MaxLength(255)]
    public string? LinkedInCommentId { get; set; }

    [Column("posted")]
    public int Posted { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("PostId")]
    public Post Post { get; set; } = null!;
}
