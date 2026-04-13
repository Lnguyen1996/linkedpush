using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("media")]
public class Media
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("user_id")]
    public int? UserId { get; set; }

    [Column("filename")]
    [Required]
    [MaxLength(255)]
    public string Filename { get; set; } = "";

    [Column("original_filename")]
    [Required]
    [MaxLength(255)]
    public string OriginalFilename { get; set; } = "";

    [Column("file_path")]
    [MaxLength(500)]
    public string? FilePath { get; set; }

    [Column("data")]
    [Required]
    public byte[] Data { get; set; } = Array.Empty<byte>();

    [Column("file_size")]
    [Required]
    public int FileSize { get; set; }

    [Column("mime_type")]
    [Required]
    [MaxLength(100)]
    public string MimeType { get; set; } = "";

    [Column("width")]
    public int? Width { get; set; }

    [Column("height")]
    public int? Height { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
