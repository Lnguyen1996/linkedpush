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

            var jitterMinutes = Random.Shared.NextDouble() * 6 - 3; // ±30 min jitter
            await Task.Delay(TimeSpan.FromMinutes(30) + TimeSpan.FromMinutes(jitterMinutes), stoppingToken);
        }
    }

    private async Task RefreshExpiringTokens(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var linkedInService = scope.ServiceProvider.GetRequiredService<LinkedInService>();

        var cutoff = DateTime.UtcNow.AddDays(7);

        // Token source is now SocialConnection (planning doc 04 §1.3). The partial
        // index `IX_social_connections_token_expires_active` serves this query.
        var connections = await db.SocialConnections
            .Where(sc => sc.Provider == "linkedin"
                && sc.Status == "active"
                && sc.RefreshTokenEncrypted != null
                && sc.TokenExpiresAt != null
                && sc.TokenExpiresAt <= cutoff)
            .ToListAsync(ct);

        if (connections.Count == 0) return;

        _logger.LogInformation("[TokenRefresh] Found {Count} SocialConnection(s) with tokens expiring within 7 days", connections.Count);

        foreach (var connection in connections)
        {
            var outcome = await linkedInService.RefreshAccessTokenV2(connection, db, ct);
            if (outcome == LinkedInService.RefreshOutcome.Success || outcome == LinkedInService.RefreshOutcome.AlreadyFresh)
            {
                _logger.LogInformation("[TokenRefresh] Refreshed token for user {UserId} (expires {Expiry})", connection.UserId, connection.TokenExpiresAt);
            }
            else if (outcome == LinkedInService.RefreshOutcome.Terminal)
            {
                _logger.LogWarning("[TokenRefresh] Token for user {UserId} is now expired", connection.UserId);
            }
        }
    }
}