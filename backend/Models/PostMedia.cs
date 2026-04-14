using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("post_media")]
public class PostMedia
{
    [Column("post_id")]
    public int PostId { get; set; }

    [Column("media_id")]
    public int MediaId { get; set; }

    [Column("position")]
    public int Position { get; set; }

    [ForeignKey("PostId")]
    public Post Post { get; set; } = null!;

    [ForeignKey("MediaId")]
    public Media Media { get; set; } = null!;
}
