using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;

namespace LinkedPushApi.Services;

public class TokenRefreshService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<TokenRefreshService> _logger;
    private readonly IConfiguration _config;

    public TokenRefreshService(IServiceProvider services, ILogger<TokenRefreshService> logger, IConfiguration config)
    {
        _services = services;
        _logger = logger;
        _config = config;
    }

    private bool DevMode => (_config["DevMode"] ?? "true").Equals("true", StringComparison.OrdinalIgnoreCase);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (DevMode)
        {
            _logger.LogInformation("[TokenRefresh] Skipped — running in dev mode");
            return;
        }

        _logger.LogInformation("[TokenRefresh] Started — checking token expiry every 30 minutes");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RefreshExpiringTokens(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TokenRefresh] Error in refresh cycle");
            }

            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }

    private async Task RefreshExpiringTokens(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var linkedInService = scope.ServiceProvider.GetRequiredService<LinkedInService>();

        var cutoff = DateTime.UtcNow.AddHours(1);

        var users = await db.Users
            .Where(u => u.RefreshToken != null
                && u.AccessToken != null
                && u.AccessToken != "dev-token"
                && u.TokenExpiresAt != null
                && u.TokenExpiresAt <= cutoff)
            .ToListAsync(ct);

        if (users.Count == 0) return;

        _logger.LogInformation("[TokenRefresh] Found {Count} user(s) with tokens expiring within 1 hour", users.Count);

        foreach (var user in users)
        {
            var success = await linkedInService.RefreshAccessToken(user, db, ct);
            if (success)
                _logger.LogInformation("[TokenRefresh] Refreshed token for user {UserId} (expires {Expiry})", user.Id, user.TokenExpiresAt);
            else
                _logger.LogWarning("[TokenRefresh] Failed to refresh token for user {UserId} — user needs to re-authenticate", user.Id);
        }
    }
}
