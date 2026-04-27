using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class SchedulerService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<SchedulerService> _logger;
    private static readonly string InstanceId = Guid.NewGuid().ToString("N")[..12];
    private const int MaxConcurrency = 5;

    public SchedulerService(IServiceProvider services, ILogger<SchedulerService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[Scheduler] Started (instance={InstanceId}) — checking every 60s", InstanceId);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndPublishDuePosts(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Scheduler] Error in check cycle");
            }

            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
        }

        _logger.LogInformation("[Scheduler] Stopped");
    }

    private async Task CheckAndPublishDuePosts(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var linkedInService = scope.ServiceProvider.GetRequiredService<LinkedInService>();
        var now = DateTime.UtcNow;

        // Claim due posts atomically using SELECT ... FOR UPDATE SKIP LOCKED
        // FOR UPDATE locks the selected rows so other instances cannot claim them
        // SKIP LOCKED skips rows already locked by another instance (no waiting)
        // Also recovers posts stuck in 'processing' state (>15 min) from crashed instances
        var duePosts = await db.Posts
            .FromSqlRaw(@"
                SELECT * FROM posts
                WHERE status IN ('scheduled', 'processing')
                  AND (
                    (status = 'scheduled' AND scheduled_at <= {0})
                    OR (status = 'processing' AND scheduled_at <= {1})
                  )
                  ORDER BY scheduled_at ASC
                  LIMIT 100
                  FOR UPDATE SKIP LOCKED",
                now, now.AddMinutes(-15))
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .ToListAsync(ct);

        if (duePosts.Count == 0) return;

        _logger.LogInformation("[Scheduler] Found {Count} due posts (instance={InstanceId})", duePosts.Count, InstanceId);

        // Mark as processing immediately to prevent double-publish
        foreach (var post in duePosts)
            post.Status = "processing";
        await db.SaveChangesAsync(ct);

        var semaphore = new SemaphoreSlim(MaxConcurrency);
        var tasks = duePosts.Select(post => Task.Run(async () =>
        {
            await semaphore.WaitAsync(ct);
            try
            {
                await PublishPostWithLock(post, db, linkedInService, ct);
            }
            finally
            {
                semaphore.Release();
            }
        }, ct));

        await Task.WhenAll(tasks);
    }

    private async Task PublishPostWithLock(Post post, AppDbContext db, LinkedInService linkedInService, CancellationToken ct)
    {
        using var postScope = _services.CreateScope();
        var postDb = postScope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Re-fetch in this scope's context and reload relations
        var reloaded = await postDb.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .FirstOrDefaultAsync(p => p.Id == post.Id, ct);

        if (reloaded == null) return;

        // Recover posts that were left in 'processing' state by a crashed instance
        if (reloaded.Status == "processing")
        {
            _logger.LogWarning("[Scheduler] Recovering stuck post {PostId} (was in processing state)", reloaded.Id);
            // Reset to scheduled so the normal publish flow handles it
            reloaded.Status = "scheduled";
            await postDb.SaveChangesAsync(ct);
            // Re-fetch to get fresh data after reset
            reloaded = await postDb.Posts
                .Include(p => p.FirstComment)
                .Include(p => p.Image)
                .FirstOrDefaultAsync(p => p.Id == post.Id, ct);
            if (reloaded == null || reloaded.Status != "scheduled") return;
        }

        var user = await postDb.Users.FindAsync(reloaded.UserId);
        if (user == null)
        {
            reloaded.Status = "failed";
            reloaded.ErrorMessage = "User not found";
            await postDb.SaveChangesAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;

        // LinkedIn is now a pure connector — the dev-mode short-circuit depends on the
        // absence of an active SocialConnection, not the deprecated User.AccessToken.
        var connection = await LinkedInService.GetLinkedInConnection(user, postDb, ct);

        if (connection == null
            || !string.Equals(connection.Status, "active", StringComparison.OrdinalIgnoreCase)
            || connection.AccessTokenEncrypted == null
            || connection.AccessTokenEncrypted.Length == 0)
        {
#pragma warning disable CS0618 // dev-mode sentinel still lives on the legacy column
            var isDevUser = string.Equals(user.AccessToken, "dev-token", StringComparison.Ordinal);
#pragma warning restore CS0618
            if (isDevUser)
            {
                reloaded.Status = "published";
                reloaded.LinkedInPostId = $"dev-scheduled-{reloaded.Id}";
                reloaded.LinkedInPostUrn = $"urn:li:share:dev-scheduled-{reloaded.Id}";
                reloaded.PublishedAt = DateTime.UtcNow;
                reloaded.ErrorMessage = null;
                if (reloaded.FirstComment != null)
                {
                    reloaded.FirstComment.Posted = 1;
                    reloaded.FirstComment.LinkedInCommentId = $"dev-comment-{reloaded.Id}";
                }
                await postDb.SaveChangesAsync();
                _logger.LogInformation("[Scheduler] Published post {PostId} (dev mode)", reloaded.Id);
                return;
            }

            reloaded.Status = "failed";
            reloaded.ErrorMessage = "LinkedIn not connected";
            await postDb.SaveChangesAsync();
            _logger.LogWarning("[Scheduler] No active LinkedIn connection for post {PostId}", reloaded.Id);
            return;
        }

        try
        {
            if (connection.TokenExpiresAt.HasValue && now >= connection.TokenExpiresAt.Value)
            {
                var refreshed = await linkedInService.RefreshAccessToken(connection, postDb, ct);
                if (!refreshed)
                {
                    reloaded.Status = "failed";
                    reloaded.ErrorMessage = "LinkedIn access token expired and refresh failed. Please re-authenticate.";
                    await postDb.SaveChangesAsync();
                    _logger.LogWarning("[Scheduler] Token refresh failed for post {PostId}", reloaded.Id);
                    return;
                }
            }

            var success = await linkedInService.PublishPost(reloaded, user, postDb, ct);
            if (success)
                _logger.LogInformation("[Scheduler] Published post {PostId}", reloaded.Id);
            else
                _logger.LogWarning("[Scheduler] Failed to publish post {PostId}: {Error}", reloaded.Id, reloaded.ErrorMessage);
        }
        catch (Exception ex)
        {
            reloaded.Status = "failed";
            reloaded.ErrorMessage = $"Scheduler error: {ex.Message[..Math.Min(ex.Message.Length, 500)]}";
            await postDb.SaveChangesAsync();
            _logger.LogError(ex, "[Scheduler] Error publishing post {PostId}", reloaded.Id);
        }
    }
}
