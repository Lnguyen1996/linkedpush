using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Services;
using System.Net;
using System.Threading.RateLimiting;
using System.Text.Json;
using System.Text.Json.Serialization;

// Load .env file if present (DOTNET_ENV=development or just running locally)
// This makes env vars from .env available to IConfiguration
DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

// JSON serialization: snake_case per documented contract (see CLAUDE.md).
// PropertyNameCaseInsensitive lets incoming bodies bind regardless of casing —
// this prevents silent drop of fields like `media_ids` / `scheduled_at` that
// the frontend posts in snake_case but DTOs declare as PascalCase (MediaIds,
// ScheduledAt). Without it, System.Text.Json binding is case-sensitive after
// the naming policy transform, and unknown-cased properties are ignored.
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        opts.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
        opts.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// PostgreSQL via EF Core — connection string from env (DATABASE_URL) or appsettings fallback
var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? Environment.GetEnvironmentVariable("DefaultConnection")
            ?? builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(dbUrl));

// HTTP client factory
builder.Services.AddHttpClient();

// Data Protection — used by TokenProtector to encrypt SocialConnection tokens at rest.
// Key directory is overridable via env (DATA_PROTECTION_KEYS_DIR) or config
// (DataProtection:KeysDir). In dev the default lands in <baseDir>/keys which is
// .gitignored. In production operators MUST mount a persistent volume; otherwise
// keys are regenerated on each boot and stored tokens become unreadable.
var dpKeysDir = Environment.GetEnvironmentVariable("DATA_PROTECTION_KEYS_DIR")
                ?? builder.Configuration["DataProtection:KeysDir"]
                ?? Path.Combine(AppContext.BaseDirectory, "keys");
Directory.CreateDirectory(dpKeysDir);
builder.Services.AddDataProtection()
    .SetApplicationName("LinkedPush")
    .PersistKeysToFileSystem(new DirectoryInfo(dpKeysDir));

// Services
builder.Services.AddSingleton<SessionService>();
builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton<TokenProtector>();
builder.Services.AddScoped<LinkedInService>();
builder.Services.AddScoped<IMediaStorageService, LocalMediaStorageService>();
builder.Services.AddSignalR();
builder.Services.AddSingleton<INotificationPublisher, NotificationPublisher>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddHostedService<SchedulerService>();
builder.Services.AddHostedService<TokenRefreshService>();
builder.Services.AddHostedService<OAuthStateCleanupService>();
builder.Services.AddHostedService<NotificationBackfillService>();
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<EmailNotificationService>();
builder.Services.AddHostedService<WeeklyDigestService>();

// CORS — allow both localhost dev origins and configurable frontend
var allowedOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://localhost:3000")
    .Split(',', StringSplitOptions.RemoveEmptyEntries);
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
            .WithHeaders("Content-Type", "Authorization", "X-Requested-With")
            .AllowCredentials();
    });
});

// Rate limiting — per-IP for auth endpoints, per-user for expensive operations
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    options.AddPolicy("auth-login", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: GetClientIp(ctx),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.AddPolicy("auth-callback", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: GetClientIp(ctx),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.AddPolicy("ai-generate", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"{GetClientIp(ctx)}:{ctx.User.Identity?.Name ?? ""}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.AddPolicy("media-upload", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"{GetClientIp(ctx)}:{ctx.User.Identity?.Name ?? ""}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1)
            }));
});

// Extracts the real client IP from X-Forwarded-For header when behind a proxy,
// otherwise falls back to Connection.RemoteIpAddress.
static string GetClientIp(HttpContext ctx)
{
    var forwarded = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
    if (!string.IsNullOrEmpty(forwarded))
    {
        // Take the first IP in the chain (original client)
        var ip = forwarded.Split(',')[0].Trim();
        if (IPAddress.TryParse(ip, out _))
            return ip;
    }
    return ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

var app = builder.Build();

// Apply EF Core migrations on startup — this is the M0 platform prerequisite from
// planning doc 04 §0 ("EnsureCreated → Migrate"). EnsureCreated bypasses
// __EFMigrationsHistory entirely, so any environment that used it before will be
// missing the history rows even though it has the tables. For those legacy dev DBs,
// set DATABASE_USE_ENSURE_CREATED=true once to keep the old behavior while you
// either drop the volume (`docker compose down -v`) or baseline manually
// (INSERT into __EFMigrationsHistory the rows for migrations whose schema is
// already present). New / reset dev DBs and CI/prod should leave this unset.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var useEnsureCreated = string.Equals(
        Environment.GetEnvironmentVariable("DATABASE_USE_ENSURE_CREATED"),
        "true",
        StringComparison.OrdinalIgnoreCase);

    if (useEnsureCreated)
    {
        await db.Database.EnsureCreatedAsync();
    }
    else
    {
        await db.Database.MigrateAsync();
    }

    // Phase 1: idempotent legacy-token → SocialConnection migration. Safe to run
    // on every boot — skips users that already have a SocialConnection row.
    var linkedIn = scope.ServiceProvider.GetRequiredService<LinkedInService>();
    await linkedIn.MigrateLegacyLinkedInTokens(db);
}

// Middleware pipeline
app.UseCors();
app.UseRateLimiter();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (UnauthorizedAccessException)
    {
        context.Response.StatusCode = 401;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync("""{"detail":"Not authenticated"}""");
    }
});

app.MapControllers();
app.MapHub<LinkedPushApi.Hubs.NotificationsHub>("/hubs/notifications");

// Health check
app.MapGet("/api/health", () => new { status = "ok" });

app.Run();
