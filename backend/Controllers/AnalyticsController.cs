using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.DTOs;
using LinkedPushApi.Models;
using LinkedPushApi.Services;

namespace LinkedPushApi.Controllers;

[ApiController]
[NonController]
[Route("api/analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SessionService _session;
    private readonly LinkedInService _linkedIn;

    public AnalyticsController(AppDbContext db, SessionService session, LinkedInService linkedIn)
    {
        _db = db;
        _session = session;
        _linkedIn = linkedIn;
    }

    [HttpGet("")]
    public async Task<IActionResult> GetAnalytics()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        var publishedPosts = await _db.Posts
            .Where(p => p.UserId == user.Id && p.Status == "published")
            .OrderByDescending(p => p.PublishedAt)
            .ToListAsync();

        var postIds = publishedPosts.Select(p => p.Id).ToList();
        var analyticsMap = await _db.Analytics
            .Where(a => postIds.Contains(a.PostId))
            .ToDictionaryAsync(a => a.PostId);

        int totalImpressions = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
        var results = new List<AnalyticsPostDto>();

        foreach (var post in publishedPosts)
        {
            analyticsMap.TryGetValue(post.Id, out var analytics);
            var hasEngagement = analytics != null && (
                analytics.Impressions > 0 || analytics.Likes > 0 ||
                analytics.Comments > 0 || analytics.Shares > 0);

            var snippet = LinkedInService.StripHtml(post.Content ?? "");
            if (snippet.Length > 80) snippet = snippet[..80] + "...";

            results.Add(new AnalyticsPostDto
            {
                PostId = post.Id,
                Title = post.Title ?? "",
                ContentSnippet = snippet,
                PublishedAt = post.PublishedAt,
                Impressions = analytics?.Impressions ?? 0,
                Likes = analytics?.Likes ?? 0,
                Comments = analytics?.Comments ?? 0,
                Shares = analytics?.Shares ?? 0,
                HasEngagement = hasEngagement,
            });

            if (analytics != null)
            {
                totalImpressions += analytics.Impressions;
                totalLikes += analytics.Likes;
                totalComments += analytics.Comments;
                totalShares += analytics.Shares;
            }
        }

        return Ok(new AnalyticsResponseDto
        {
            Summary = new AnalyticsSummaryDto
            {
                TotalPosts = publishedPosts.Count,
                TotalImpressions = totalImpressions,
                TotalEngagements = totalLikes + totalComments + totalShares,
            },
            Posts = results,
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshAnalytics(CancellationToken ct)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        var publishedPosts = await _db.Posts
            .Where(p => p.UserId == user.Id && p.Status == "published")
            .ToListAsync(ct);

        int refreshed = 0;
        foreach (var post in publishedPosts)
        {
            var stats = await _linkedIn.FetchLinkedInAnalytics(post, user, _db, ct);

            var analytics = await _db.Analytics.FirstOrDefaultAsync(a => a.PostId == post.Id);
            if (analytics != null)
            {
                analytics.Impressions = stats["impressions"];
                analytics.Likes = stats["likes"];
                analytics.Comments = stats["comments"];
                analytics.Shares = stats["shares"];
                analytics.FetchedAt = DateTime.UtcNow;
            }
            else
            {
                analytics = new Analytics
                {
                    PostId = post.Id,
                    Impressions = stats["impressions"],
                    Likes = stats["likes"],
                    Comments = stats["comments"],
                    Shares = stats["shares"],
                };
                _db.Analytics.Add(analytics);
            }
            refreshed++;
        }

        await _db.SaveChangesAsync();
        return Ok(new { refreshed });
    }
}
