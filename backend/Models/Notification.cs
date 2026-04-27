using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("notifications")]
public class Notification
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("user_id")]
    public int UserId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("kind")]
    public string Kind { get; set; } = "";

    [Required]
    [MaxLength(255)]
    [Column("title")]
    public string Title { get; set; } = "";

    [Column("body")]
    public string? Body { get; set; }

    [Column("post_id")]
    public int? PostId { get; set; }

    [Required]
    [MaxLength(20)]
    [Column("severity")]
    public string Severity { get; set; } = "info"; // "info" | "warning" | "error"

    [Column("read_at")]
    public DateTime? ReadAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("UserId")]
    public User User { get; set; } = null!;

    [ForeignKey("PostId")]
    public Post? Post { get; set; }
}