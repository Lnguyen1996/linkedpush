namespace LinkedPushApi.DTOs;

public class MediaResponseDto
{
    public int Id { get; set; }
    public string Filename { get; set; } = "";
    public string OriginalFilename { get; set; } = "";
    public string Url { get; set; } = "";
    public int FileSize { get; set; }
    public string MimeType { get; set; } = "";
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string MediaType { get; set; } = "image";
    public int? Duration { get; set; }
    public DateTime? CreatedAt { get; set; }
}
