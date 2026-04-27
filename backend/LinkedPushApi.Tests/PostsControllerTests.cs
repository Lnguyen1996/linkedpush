using System.Net.Http;
using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using LinkedPushApi.Controllers;
using LinkedPushApi.Data;
using LinkedPushApi.DTOs;
using LinkedPushApi.Models;
using LinkedPushApi.Services;
using Xunit;

namespace LinkedPushApi.Tests;

/// <summary>
/// Regression: saving a scheduled post from the Compose page sent
/// <c>scheduled_at = "2026-04-24T09:00:00"</c> (no offset). System.Text.Json
/// deserialized that into a <see cref="DateTime"/> with
/// <see cref="DateTimeKind.Unspecified"/>, and Npgsql refused to write it to
/// the <c>timestamptz</c> column with:
///
///   "Cannot write DateTime with Kind=Unspecified to PostgreSQL type
///    'timestamp with time zone', only UTC is supported"
///
/// resulting in a 500 and a "Failed to save post" toast in the UI. The
/// controller now normalizes the incoming DateTime to UTC kind before saving.
/// </summary>
public class PostsControllerTests
{
    [Fact]
    public async Task CreatePost_normalizes_unspecified_scheduled_at_to_utc()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "pc-create", Name = "PC" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
        }

        var controller = CreateController(dbName, userId);

        // Simulate exactly what the frontend sends: a local wall-clock time
        // with no offset. System.Text.Json binds this with Kind=Unspecified.
        var wallClock = new DateTime(2026, 4, 24, 9, 0, 0, DateTimeKind.Unspecified);

        var result = await controller.CreatePost(
            new PostCreateDto
            {
                Content = "debug test",
                Status = "scheduled",
                ScheduledAt = wallClock,
                Timezone = "UTC",
            },
            CancellationToken.None);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, obj.StatusCode);

        using var verify = CreateDb(dbName);
        var saved = await verify.Posts.SingleAsync(p => p.UserId == userId);
        Assert.NotNull(saved.ScheduledAt);
        // Must be Utc kind — this is what Npgsql requires for timestamptz.
        Assert.Equal(DateTimeKind.Utc, saved.ScheduledAt!.Value.Kind);
        Assert.Equal(wallClock.Ticks, saved.ScheduledAt!.Value.Ticks);
    }

    [Fact]
    public async Task UpdatePost_normalizes_unspecified_scheduled_at_to_utc()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        int postId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "pc-update", Name = "PC2" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            var p = new Post
            {
                UserId = userId,
                Content = "hi",
                Status = "draft",
            };
            db.Posts.Add(p);
            await db.SaveChangesAsync();
            postId = p.Id;
        }

        var controller = CreateController(dbName, userId);

        var wallClock = new DateTime(2026, 5, 1, 14, 30, 0, DateTimeKind.Unspecified);
        var result = await controller.UpdatePost(
            postId,
            new PostUpdateDto
            {
                Status = "scheduled",
                ScheduledAt = wallClock,
                Timezone = "UTC",
            },
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);

        using var verify = CreateDb(dbName);
        var saved = await verify.Posts.SingleAsync(p => p.Id == postId);
        Assert.NotNull(saved.ScheduledAt);
        Assert.Equal(DateTimeKind.Utc, saved.ScheduledAt!.Value.Kind);
    }

    [Fact]
    public async Task CreatePost_preserves_utc_scheduled_at_unchanged()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "pc-utc", Name = "PC3" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
        }

        var controller = CreateController(dbName, userId);
        var utc = new DateTime(2026, 6, 10, 12, 0, 0, DateTimeKind.Utc);

        var result = await controller.CreatePost(
            new PostCreateDto
            {
                Content = "utc case",
                Status = "scheduled",
                ScheduledAt = utc,
                Timezone = "UTC",
            },
            CancellationToken.None);

        Assert.IsType<ObjectResult>(result);

        using var verify = CreateDb(dbName);
        var saved = await verify.Posts.SingleAsync(p => p.UserId == userId);
        Assert.Equal(DateTimeKind.Utc, saved.ScheduledAt!.Value.Kind);
        Assert.Equal(utc.Ticks, saved.ScheduledAt!.Value.Ticks);
    }

    // ---- harness ----

    private static PostsController CreateController(string databaseName, int userId)
    {
        var values = new Dictionary<string, string?>
        {
            ["SecretKey"] = "test-secret-key-which-is-32-bytes-min",
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
            ["LinkedIn:ClientId"] = "linkedin-client-id",
            ["LinkedIn:ClientSecret"] = "linkedin-client-secret",
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName).Options);
        db.Database.EnsureCreated();
        var jwt = new JwtService(config);
        var session = new SessionService(config, jwt);
        var protector = new TokenProtector(
            DataProtectionProvider.Create("LinkedPush.Tests"),
            NullLogger<TokenProtector>.Instance);
        var linkedIn = new LinkedInService(
            config,
            new StubHttpClientFactory(),
            NullLogger<LinkedInService>.Instance,
            protector);
        var controller = new PostsController(db, session, linkedIn);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        controller.HttpContext.RequestServices = new ServiceCollection()
            .AddSingleton<IConfiguration>(config)
            .BuildServiceProvider();
        var token = session.CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";
        return controller;
    }

    private static AppDbContext CreateDb(string databaseName)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName).Options);
        db.Database.EnsureCreated();
        return db;
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            new HttpClient(new StubMessageHandler()) { BaseAddress = new Uri("http://localhost") };
    }

    private sealed class StubMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.BadRequest)
            {
                Content = new StringContent("{}"),
            });
    }
}
