namespace LinkedPushApi.DTOs;

public class NotificationItemDto
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Body { get; set; }
    public int? PostId { get; set; }
    public DateTime OccurredAt { get; set; }
    public string Severity { get; set; } = "info";
}
