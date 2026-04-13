namespace LinkedPushApi.DTOs;

public class AnalyticsSummaryDto
{
    public int TotalPosts { get; set; }
    public int TotalImpressions { get; set; }
    public int TotalEngagements { get; set; }
}

public class AnalyticsPostDto
{
    public int PostId { get; set; }
    public string Title { get; set; } = "";
    public string ContentSnippet { get; set; } = "";
    public DateTime? PublishedAt { get; set; }
    public int Impressions { get; set; }
    public int Likes { get; set; }
    public int Comments { get; set; }
    public int Shares { get; set; }
    public bool HasEngagement { get; set; }
}

public class AnalyticsResponseDto
{
    public AnalyticsSummaryDto Summary { get; set; } = new();
    public List<AnalyticsPostDto> Posts { get; set; } = new();
}
