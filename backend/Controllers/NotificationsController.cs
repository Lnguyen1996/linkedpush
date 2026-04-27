using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.DTOs;
using LinkedPushApi.Models;
using LinkedPushApi.Services;

namespace LinkedPushApi.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private const int MaxItems = 20;
    private readonly AppDbContext _db;
    private readonly SessionService _session;
    private readonly INotificationService _notificationService;

    public NotificationsController(AppDbContext db, SessionService session, INotificationService notificationService)
    {
        _db = db;
        _session = session;
        _notificationService = notificationService;
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
                Kind = "post_failed",
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
                Kind = "post_scheduled",
                Title = string.IsNullOrWhiteSpace(s.Title) ? "Scheduled post" : s.Title!,
                Body = $"Publishing {at:MMM d, yyyy} at {at:h:mm tt} UTC",
                PostId = s.Id,
                OccurredAt = at,
                Severity = "info",
            });
        }

        var linkedIn = await _db.SocialConnections
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == user.Id && s.Provider == "linkedin");
        if (linkedIn != null)
        {
            var isExpiredStatus = string.Equals(linkedIn.Status, "expired", StringComparison.OrdinalIgnoreCase);
            var isActive = string.Equals(linkedIn.Status, "active", StringComparison.OrdinalIgnoreCase);
            var isPastExpiry = isActive
                && linkedIn.TokenExpiresAt.HasValue
                && NormalizeUtc(linkedIn.TokenExpiresAt.Value) <= now;

            if (isExpiredStatus || isPastExpiry)
            {
                var occurredAt = linkedIn.TokenExpiresAt.HasValue
                    ? NormalizeUtc(linkedIn.TokenExpiresAt.Value)
                    : now;
                items.Add(new NotificationItemDto
                {
                    Id = $"linkedin_expired:{linkedIn.Id}",
                    Kind = "linkedin_token_expired",
                    Title = "LinkedIn access expired",
                    Body = "Reconnect your LinkedIn account in Settings to resume publishing.",
                    PostId = null,
                    OccurredAt = occurredAt,
                    Severity = "error",
                });
            }
            else if (isActive && linkedIn.TokenExpiresAt.HasValue)
            {
                var exp = NormalizeUtc(linkedIn.TokenExpiresAt.Value);
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
        }

        // Persist each computed notification to the DB so we build up history.
        // Use kind+postId (for post notifications) or kind+id suffix to avoid duplicates.
        foreach (var item in items)
        {
            var isDuplicate = await _db.Notifications.AnyAsync(n =>
                n.UserId == user.Id &&
                n.Kind == item.Kind &&
                n.PostId == item.PostId &&
                n.CreatedAt > now.AddMinutes(-5));

            if (!isDuplicate)
            {
                _db.Notifications.Add(new Notification
                {
                    UserId = user.Id,
                    Kind = item.Kind,
                    Title = item.Title,
                    Body = item.Body,
                    PostId = item.PostId,
                    Severity = item.Severity,
                    CreatedAt = item.OccurredAt,
                });
            }
        }
        await _db.SaveChangesAsync();

        return Ok(new { items = items.Take(MaxItems).ToList() });
    }

    [HttpGet("stored")]
    public async Task<IActionResult> GetStored([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == user.Id)
            .OrderByDescending(n => n.CreatedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new StoredNotificationDto
            {
                Id = n.Id,
                Kind = n.Kind,
                Title = n.Title,
                Body = n.Body,
                PostId = n.PostId,
                Severity = n.Severity,
                ReadAt = n.ReadAt,
                CreatedAt = n.CreatedAt,
            })
            .ToListAsync();

        return Ok(new StoredNotificationsResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == user.Id);

        if (notification == null)
            return NotFound(new { detail = "Notification not found" });

        notification.ReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var now = DateTime.UtcNow;

        var unread = await _db.Notifications
            .Where(n => n.UserId == user.Id && n.ReadAt == null)
            .ToListAsync();

        foreach (var n in unread)
            n.ReadAt = now;
        await _db.SaveChangesAsync();

        return Ok(new { marked = unread.Count });
    }

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        var prefs = await _db.NotificationPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == user.Id);

        if (prefs == null)
        {
            return Ok(new PreferencesResponse
            {
                EmailEnabled = false,
                PostPublishedEmail = false,
                PostFailedEmail = true,
                WeeklyDigestEmail = true,
                WeeklyDigestDay = "monday",
                DigestTimeOfDay = "09:00",
            });
        }

        return Ok(new PreferencesResponse
        {
            EmailEnabled = prefs.EmailEnabled,
            PostPublishedEmail = prefs.PostPublishedEmail,
            PostFailedEmail = prefs.PostFailedEmail,
            WeeklyDigestEmail = prefs.WeeklyDigestEmail,
            WeeklyDigestDay = prefs.WeeklyDigestDay,
            DigestTimeOfDay = prefs.DigestTimeOfDay,
        });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdatePreferencesRequest req)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        var prefs = await _db.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == user.Id);

        if (prefs == null)
        {
            prefs = new UserNotificationPreference { UserId = user.Id };
            _db.NotificationPreferences.Add(prefs);
        }

        prefs.EmailEnabled = req.EmailEnabled;
        prefs.PostPublishedEmail = req.PostPublishedEmail;
        prefs.PostFailedEmail = req.PostFailedEmail;
        prefs.WeeklyDigestEmail = req.WeeklyDigestEmail;
        prefs.WeeklyDigestDay = req.WeeklyDigestDay ?? "monday";
        prefs.DigestTimeOfDay = req.DigestTimeOfDay ?? "09:00";

        await _db.SaveChangesAsync();

        return Ok(new PreferencesResponse
        {
            EmailEnabled = prefs.EmailEnabled,
            PostPublishedEmail = prefs.PostPublishedEmail,
            PostFailedEmail = prefs.PostFailedEmail,
            WeeklyDigestEmail = prefs.WeeklyDigestEmail,
            WeeklyDigestDay = prefs.WeeklyDigestDay,
            DigestTimeOfDay = prefs.DigestTimeOfDay,
        });
    }

    [HttpPost("test")]
    public async Task<IActionResult> SendTestNotification()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        await _notificationService.PublishToUser(user.Id, "test", "Test notification", "This is a test notification from LinkedPush", null, "info");
        return Ok(new { ok = true });
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