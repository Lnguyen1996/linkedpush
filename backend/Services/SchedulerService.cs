using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class SchedulerService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<SchedulerService> _logger;

    public SchedulerService(IServiceProvider services, ILogger<SchedulerService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[Scheduler] Started — checking for due posts every 60 seconds");

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

        var duePosts = await db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .Where(p => p.Status == "scheduled" && p.ScheduledAt <= now)
            .ToListAsync();

        foreach (var post in duePosts)
        {
            var user = await db.Users.FindAsync(post.UserId);
            if (user == null)
            {
                post.Status = "failed";
                post.ErrorMessage = "User not found";
                await db.SaveChangesAsync();
                continue;
            }

            if (string.IsNullOrEmpty(user.AccessToken) || user.AccessToken == "dev-token")
            {
                post.Status = "published";
                post.LinkedInPostId = $"dev-scheduled-{post.Id}";
                post.LinkedInPostUrn = $"urn:li:share:dev-scheduled-{post.Id}";
                post.PublishedAt = DateTime.UtcNow;
                post.ErrorMessage = null;
                if (post.FirstComment != null)
                {
                    post.FirstComment.Posted = 1;
                    post.FirstComment.LinkedInCommentId = $"dev-comment-{post.Id}";
                }
                await db.SaveChangesAsync();
                _logger.LogInformation("[Scheduler] Published post {PostId} (dev mode)", post.Id);
                continue;
            }

            try
            {
                if (user.TokenExpiresAt.HasValue && now >= user.TokenExpiresAt.Value)
                {
                    var refreshed = await linkedInService.RefreshAccessToken(user, db, ct);
                    if (!refreshed)
                    {
                        post.Status = "failed";
                        post.ErrorMessage = "LinkedIn access token expired and refresh failed. Please re-authenticate.";
                        await db.SaveChangesAsync();
                        _logger.LogWarning("[Scheduler] Token refresh failed for post {PostId}", post.Id);
                        continue;
                    }
                }

                var success = await linkedInService.PublishPost(post, user, db, ct);
                if (success)
                    _logger.LogInformation("[Scheduler] Published post {PostId}", post.Id);
                else
                    _logger.LogWarning("[Scheduler] Failed to publish post {PostId}: {Error}", post.Id, post.ErrorMessage);
            }
            catch (Exception ex)
            {
                post.Status = "failed";
                post.ErrorMessage = $"Scheduler error: {ex.Message[..Math.Min(ex.Message.Length, 500)]}";
                await db.SaveChangesAsync();
                _logger.LogError(ex, "[Scheduler] Error publishing post {PostId}", post.Id);
            }
        }
    }
}
