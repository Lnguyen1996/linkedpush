using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.DTOs;
using LinkedPushApi.Services;

namespace LinkedPushApi.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private const int MaxItems = 20;
    private readonly AppDbContext _db;
    private readonly SessionService _session;

    public NotificationsController(AppDbContext db, SessionService session)
    {
        _db = db;
        _session = session;
    }

    [HttpGet("")]
    public async Task<IActionResult> List()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var now = DateTime.UtcNow;
        var scheduledWindowEnd = now.AddHours(48);
        var tokenWarnEnd = now.AddDays(7);

        var failedPosts = await _db.Posts
            .AsNoTracking()
            .Where(p => p.UserId == user.Id && p.Status == "failed")
            .OrderByDescending(p => p.UpdatedAt)
            .Take(15)
            .Select(p => new { p.Id, p.Title, p.ErrorMessage, p.UpdatedAt })
            .ToListAsync();

        var scheduledSoon = await _db.Posts
            .AsNoTracking()
            .Where(p =>
                p.UserId == user.Id
                && p.Status == "scheduled"
                && p.ScheduledAt != null
                && p.ScheduledAt > now
                && p.ScheduledAt <= scheduledWindowEnd)
            .OrderBy(p => p.ScheduledAt)
            .Take(15)
            .Select(p => new { p.Id, p.Title, p.ScheduledAt })
            .ToListAsync();

        var items = new List<NotificationItemDto>();

        foreach (var f in failedPosts)
        {
            var err = string.IsNullOrWhiteSpace(f.ErrorMessage) ? "Publish failed." : Truncate(f.ErrorMessage!, 240);
            items.Add(new NotificationItemDto
            {
                Id = $"post_failed:{f.Id}",
                Kind = "publish_failed",
                Title = string.IsNullOrWhiteSpace(f.Title) ? "Post failed to publish" : f.Title!,
                Body = err,
                PostId = f.Id,
                OccurredAt = NormalizeUtc(f.UpdatedAt),
                Severity = "error",
            });
        }

        foreach (var s in scheduledSoon)
        {
            var at = NormalizeUtc(s.ScheduledAt!.Value);
            items.Add(new NotificationItemDto
            {
                Id = $"post_soon:{s.Id}",
                Kind = "scheduled_soon",
                Title = string.IsNullOrWhiteSpace(s.Title) ? "Scheduled post" : s.Title!,
                Body = $"Publishing at {at:o} (UTC).",
                PostId = s.Id,
                OccurredAt = at,
                Severity = "info",
            });
        }

        if (!string.IsNullOrEmpty(user.AccessToken)
            && user.AccessToken != "dev-token"
            && user.TokenExpiresAt.HasValue)
        {
            var exp = NormalizeUtc(user.TokenExpiresAt.Value);
            if (exp > now && exp <= tokenWarnEnd)
            {
                items.Add(new NotificationItemDto
                {
                    Id = "token_expiry",
                    Kind = "linkedin_token_expiring",
                    Title = "LinkedIn connection expiring",
                    Body = $"Reconnect before {exp:o} (UTC) to keep publishing.",
                    PostId = null,
                    OccurredAt = exp,
                    Severity = "warning",
                });
            }
        }

        return Ok(new { items = items.Take(MaxItems).ToList() });
    }

    private static string Truncate(string s, int max)
    {
        if (s.Length <= max) return s;
        return s[..(max - 1)] + "…";
    }

    private static DateTime NormalizeUtc(DateTime dt)
    {
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
        };
    }
}
