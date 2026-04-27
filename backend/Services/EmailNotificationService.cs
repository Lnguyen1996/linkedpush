using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class EmailNotificationService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<EmailNotificationService> _log;

    public EmailNotificationService(IServiceProvider sp, ILogger<EmailNotificationService> log)
    {
        _sp = sp;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessEmailNotifications(stoppingToken);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error processing email notifications");
            }
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task ProcessEmailNotifications(CancellationToken stoppingToken)
    {
        using var scope = _sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var appUrl = AppConfig.Get(config, "App:Url", "APP_URL", "https://app.linkedpush.com");

        if (!AppConfig.EmailEnabled(config))
        {
            _log.LogDebug("Email sending disabled, skipping email notification processing");
            return;
        }

        var cutoff = DateTime.UtcNow.AddHours(-24);
        var notifications = await db.Notifications
            .Include(n => n.User)
            .Where(n => n.Kind == "post_failed"
                && n.Severity == "error"
                && n.CreatedAt >= cutoff
                && db.NotificationPreferences.Any(p => p.UserId == n.UserId && p.EmailEnabled))
            .ToListAsync(stoppingToken);

        foreach (var notification in notifications)
        {
            if (stoppingToken.IsCancellationRequested) break;

            var prefs = await db.NotificationPreferences
                .FirstOrDefaultAsync(p => p.UserId == notification.UserId, stoppingToken);

            if (prefs == null || !prefs.EmailEnabled || !prefs.PostFailedEmail)
                continue;

            var user = notification.User;
            var post = notification.PostId.HasValue
                ? await db.Posts.FindAsync(new object[] { notification.PostId.Value }, stoppingToken)
                : null;

            var html = EmailTemplates.PostFailed(
                user?.Name ?? "there",
                post?.Title ?? notification.Title ?? "Your post",
                notification.Body,
                appUrl);

            try
            {
                await emailSender.SendAsync(
                    user?.Email ?? "",
                    "Post Failed to Publish",
                    html);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed to send post_failed email to {Email}", user?.Email);
            }
        }
    }
}