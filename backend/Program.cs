using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.Services;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// JSON serialization: use camelCase and snake_case support
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// PostgreSQL via EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// HTTP client factory
builder.Services.AddHttpClient();

// Services
builder.Services.AddSingleton<SessionService>();
builder.Services.AddScoped<LinkedInService>();
builder.Services.AddHostedService<SchedulerService>();
builder.Services.AddHostedService<TokenRefreshService>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Ensure database is created and uploads directory exists
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS oauth_states (
            state character varying(128) PRIMARY KEY,
            created_at timestamp with time zone NOT NULL,
            cli_port integer NULL
        )
        """);
    await db.Database.ExecuteSqlRawAsync("""
        CREATE INDEX IF NOT EXISTS ix_oauth_states_created_at
        ON oauth_states (created_at)
        """);
}

// Middleware pipeline
app.UseCors();

// Auth error handling middleware
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

// Health check
app.MapGet("/api/health", () => new { status = "ok" });

app.Run();
