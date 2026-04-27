using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class WeeklyDigestService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<WeeklyDigestService> _log;
    private readonly Dictionary<int, DateTime> _lastDigestRun = new();

    public WeeklyDigestService(IServiceProvider sp, ILogger<WeeklyDigestService> log)
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
                await ProcessDigests(stoppingToken);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error processing weekly digests");
            }
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task ProcessDigests(CancellationToken stoppingToken)
    {
        using var scope = _sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var appUrl = AppConfig.Get(config, "App:Url", "APP_URL", "https://app.linkedpush.com");

        if (!AppConfig.EmailEnabled(config))
        {
            _log.LogDebug("Email sending disabled, skipping weekly digest processing");
            return;
        }

        var now = DateTime.UtcNow;
        var usersWithDigestEnabled = await db.NotificationPreferences
            .Where(p => p.EmailEnabled && p.WeeklyDigestEmail)
            .Include(p => p.User)
            .ToListAsync(stoppingToken);

        foreach (var prefs in usersWithDigestEnabled)
        {
            if (stoppingToken.IsCancellationRequested) break;

            var user = prefs.User;
            if (user == null) continue;

            if (!TryGetDigestSchedule(prefs, now, out var shouldSend, out var lastRun))
                continue;

            if (!shouldSend) continue;

            _lastDigestRun[user.Id] = lastRun;

            var posts = await db.Posts
                .Where(p => p.UserId == user.Id
                    && p.CreatedAt >= lastRun
                    && p.CreatedAt <= now)
                .OrderByDescending(p => p.CreatedAt)
                .Take(20)
                .ToListAsync(stoppingToken);

            if (posts.Count == 0) continue;

            var postsData = posts
                .Select(p => (
                    title: p.Title ?? "Untitled",
                    status: p.Status,
                    scheduledAt: p.ScheduledAt))
                .ToList();

            var html = EmailTemplates.WeeklyDigest(
                user.Name ?? "there",
                postsData,
                appUrl);

            try
            {
                await emailSender.SendAsync(
                    user.Email ?? "",
                    "Your LinkedPush Weekly Summary",
                    html);
                _log.LogInformation("Weekly digest sent to {Email}", user.Email);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed to send weekly digest to {Email}", user.Email);
            }
        }
    }

    private bool TryGetDigestSchedule(UserNotificationPreference prefs, DateTime now, out bool shouldSend, out DateTime lastRun)
    {
        shouldSend = false;
        lastRun = DateTime.MinValue;

        var digestDay = prefs.WeeklyDigestDay?.ToLowerInvariant().Trim() ?? "monday";
        var digestTime = prefs.DigestTimeOfDay ?? "09:00";

        if (!TimeSpan.TryParse(digestTime, out var timeOfDay))
            timeOfDay = TimeSpan.FromHours(9);

        var dayMatches = digestDay switch
        {
            "sunday" => now.DayOfWeek == DayOfWeek.Sunday,
            "monday" => now.DayOfWeek == DayOfWeek.Monday,
            "tuesday" => now.DayOfWeek == DayOfWeek.Tuesday,
            "wednesday" => now.DayOfWeek == DayOfWeek.Wednesday,
            "thursday" => now.DayOfWeek == DayOfWeek.Thursday,
            "friday" => now.DayOfWeek == DayOfWeek.Friday,
            "saturday" => now.DayOfWeek == DayOfWeek.Saturday,
            _ => false,
        };

        var currentMinute = now.TimeOfDay;
        var targetMinute = timeOfDay;

        if (!dayMatches || currentMinute < targetMinute || currentMinute > targetMinute.Add(TimeSpan.FromMinutes(30)))
            return false;

        if (_lastDigestRun.TryGetValue(prefs.UserId, out lastRun))
        {
            if (lastRun.Date >= now.Date) return false;
        }

        lastRun = now.AddDays(-7);
        shouldSend = true;
        return true;
    }
}