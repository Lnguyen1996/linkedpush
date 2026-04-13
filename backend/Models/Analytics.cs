using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("analytics")]
public class Analytics
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("post_id")]
    [Required]
    public int PostId { get; set; }

    [Column("impressions")]
    public int Impressions { get; set; } = 0;

    [Column("likes")]
    public int Likes { get; set; } = 0;

    [Column("comments")]
    public int Comments { get; set; } = 0;

    [Column("shares")]
    public int Shares { get; set; } = 0;

    [Column("engagement_rate")]
    public double EngagementRate { get; set; } = 0.0;

    [Column("fetched_at")]
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("PostId")]
    public Post Post { get; set; } = null!;
}
