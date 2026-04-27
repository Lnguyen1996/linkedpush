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

public class StoredNotificationDto
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Body { get; set; }
    public int? PostId { get; set; }
    public string Severity { get; set; } = "info";
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime OccurredAt => CreatedAt;
}

public class StoredNotificationsResponse
{
    public List<StoredNotificationDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class UpdatePreferencesRequest
{
    public bool EmailEnabled { get; set; }
    public bool PostPublishedEmail { get; set; }
    public bool PostFailedEmail { get; set; }
    public bool WeeklyDigestEmail { get; set; }
    public string? WeeklyDigestDay { get; set; }
    public string? DigestTimeOfDay { get; set; }
}

public class PreferencesResponse
{
    public bool EmailEnabled { get; set; }
    public bool PostPublishedEmail { get; set; }
    public bool PostFailedEmail { get; set; }
    public bool WeeklyDigestEmail { get; set; }
    public string WeeklyDigestDay { get; set; } = "monday";
    public string DigestTimeOfDay { get; set; } = "09:00";
}
