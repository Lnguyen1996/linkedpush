using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class NotificationBackfillService : IHostedService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<NotificationBackfillService> _logger;
    private static bool _executed;
    private static readonly object _lock = new();

    public NotificationBackfillService(IServiceProvider services, ILogger<NotificationBackfillService> logger)
    {
        _services = services;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Wait for schema migration to complete before running the one-time backfill.
        // This avoids querying the notifications table before EnsureCreated/Migrate has
        // created it (EnsureCreated runs after hosted services start).
        await Task.Delay(5000, cancellationToken);

        lock (_lock)
        {
            if (_executed) return;
            _executed = true;
        }

        await BackfillAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task BackfillAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("NotificationBackfillService: starting one-time backfill");

        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow.AddDays(-30);

        var failedPosts = await db.Posts
            .AsNoTracking()
            .Where(p => p.UserId != null && p.Status == "failed" && p.UpdatedAt >= cutoff)
            .Select(p => new { p.Id, p.UserId, p.Title, p.ErrorMessage, p.UpdatedAt })
            .ToListAsync(cancellationToken);

        var scheduledPosts = await db.Posts
            .AsNoTracking()
            .Where(p => p.UserId != null && p.Status == "scheduled" && p.ScheduledAt != null && p.ScheduledAt >= cutoff)
            .Select(p => new { p.Id, p.UserId, p.Title, p.ScheduledAt })
            .ToListAsync(cancellationToken);

        var notifications = new List<Notification>();

        foreach (var p in failedPosts)
        {
            var err = string.IsNullOrWhiteSpace(p.ErrorMessage) ? "Publish failed." : p.ErrorMessage.Length > 240 ? p.ErrorMessage[..239] + "…" : p.ErrorMessage;
            notifications.Add(new Notification
            {
                UserId = p.UserId!.Value,
                Kind = "post_failed",
                Title = string.IsNullOrWhiteSpace(p.Title) ? "Post failed to publish" : p.Title,
                Body = err,
                PostId = p.Id,
                Severity = "error",
                CreatedAt = p.UpdatedAt,
            });
        }

        foreach (var p in scheduledPosts)
        {
            notifications.Add(new Notification
            {
                UserId = p.UserId!.Value,
                Kind = "post_scheduled",
                Title = string.IsNullOrWhiteSpace(p.Title) ? "Scheduled post" : p.Title,
                Body = $"Publishing {p.ScheduledAt:MMM d, yyyy} at {p.ScheduledAt:h:mm tt} UTC",
                PostId = p.Id,
                Severity = "info",
                CreatedAt = p.ScheduledAt!.Value,
            });
        }

        if (notifications.Count > 0)
        {
            var existingKeys = await db.Notifications
                .AsNoTracking()
                .Select(n => new { n.UserId, n.Kind, n.PostId, n.CreatedAt })
                .ToListAsync(cancellationToken);

            var existingKeySet = existingKeys
                .Select(k => $"{k.UserId}|{k.Kind}|{k.PostId}|{k.CreatedAt.Ticks / 600000000}")
                .ToHashSet();

            var toInsert = notifications
                .Where(n => !existingKeySet.Contains($"{n.UserId}|{n.Kind}|{n.PostId}|{n.CreatedAt.Ticks / 600000000}"))
                .ToList();

            if (toInsert.Count > 0)
            {
                await db.Notifications.AddRangeAsync(toInsert, cancellationToken);
                await db.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("NotificationBackfillService: inserted {Count} notifications", toInsert.Count);
            }
            else
            {
                _logger.LogInformation("NotificationBackfillService: no new notifications to insert");
            }
        }
        else
        {
            _logger.LogInformation("NotificationBackfillService: no posts found for backfill");
        }
    }
}