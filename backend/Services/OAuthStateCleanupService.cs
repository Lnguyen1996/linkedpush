using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;

namespace LinkedPushApi.Services;

public class OAuthStateCleanupService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<OAuthStateCleanupService> _logger;

    public OAuthStateCleanupService(IServiceProvider services, ILogger<OAuthStateCleanupService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[OAuthStateCleanup] Started — running every 10 minutes");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredStates(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OAuthStateCleanup] Error in cleanup cycle");
            }

            await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
        }
    }

    private async Task CleanupExpiredStates(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Single SQL delete — no SELECT-then-delete, avoids holding locks
        var cutoff = DateTime.UtcNow.AddMinutes(-10);
        var deleted = await db.Database.ExecuteSqlRawAsync(
            "DELETE FROM oauth_states WHERE created_at < {0}",
            new object[] { cutoff });

        if (deleted > 0)
            _logger.LogInformation("[OAuthStateCleanup] Removed {Count} expired OAuth state(s)", deleted);
    }
}