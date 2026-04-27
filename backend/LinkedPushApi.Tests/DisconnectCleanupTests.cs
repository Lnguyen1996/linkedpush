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
using LinkedPushApi.Models;
using LinkedPushApi.Services;
using Xunit;

namespace LinkedPushApi.Tests;

/// <summary>
/// Tests for the "disconnect cleans up scheduled posts" behavior. Before this
/// change, revoking the SocialConnection left future scheduled posts alone and
/// the scheduler failed them silently; now we mark them failed immediately so
/// the existing post_failed notifications fire.
/// </summary>
public class DisconnectCleanupTests
{
    [Fact]
    public async Task Disconnect_marks_future_scheduled_posts_as_failed()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "google-dc-fut", Name = "DCFut" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            db.SocialConnections.Add(ActiveLinkedInConnection(userId));
            db.Posts.AddRange(
                new Post
                {
                    UserId = userId,
                    Content = "future",
                    Status = "scheduled",
                    ScheduledAt = DateTime.UtcNow.AddHours(3),
                },
                new Post
                {
                    UserId = userId,
                    Content = "processing",
                    Status = "processing",
                    ScheduledAt = DateTime.UtcNow.AddMinutes(10),
                },
                new Post
                {
                    UserId = userId,
                    Content = "no-date",
                    Status = "scheduled",
                    ScheduledAt = null,
                });
            await db.SaveChangesAsync();
        }

        var result = await CallDisconnect(dbName, userId);
        Assert.IsType<OkObjectResult>(result);

        using var verify = CreateDb(dbName);
        var failed = await verify.Posts.Where(p => p.UserId == userId).ToListAsync();
        Assert.Equal(3, failed.Count);
        Assert.All(failed, p =>
        {
            Assert.Equal("failed", p.Status);
            Assert.Equal(
                "LinkedIn disconnected — reconnect and reschedule to publish.",
                p.ErrorMessage);
        });
    }

    [Fact]
    public async Task Disconnect_does_not_touch_published_posts()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "google-dc-pub", Name = "DCPub" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            db.SocialConnections.Add(ActiveLinkedInConnection(userId));
            db.Posts.Add(new Post
            {
                UserId = userId,
                Content = "already live",
                Status = "published",
                ScheduledAt = DateTime.UtcNow.AddHours(-1),
                PublishedAt = DateTime.UtcNow.AddHours(-1),
                LinkedInPostUrn = "urn:li:share:999",
            });
            await db.SaveChangesAsync();
        }

        await CallDisconnect(dbName, userId);

        using var verify = CreateDb(dbName);
        var post = await verify.Posts.SingleAsync(p => p.UserId == userId);
        Assert.Equal("published", post.Status);
        Assert.Null(post.ErrorMessage);
    }

    [Fact]
    public async Task Disconnect_does_not_touch_draft_posts()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "google-dc-draft", Name = "DCDraft" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            db.SocialConnections.Add(ActiveLinkedInConnection(userId));
            db.Posts.Add(new Post
            {
                UserId = userId,
                Content = "draft",
                Status = "draft",
                ScheduledAt = null,
            });
            await db.SaveChangesAsync();
        }

        await CallDisconnect(dbName, userId);

        using var verify = CreateDb(dbName);
        var post = await verify.Posts.SingleAsync(p => p.UserId == userId);
        Assert.Equal("draft", post.Status);
        Assert.Null(post.ErrorMessage);
    }

    [Fact]
    public async Task Disconnect_returns_cancelled_posts_count_in_response()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "google-dc-count", Name = "DCCount" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            db.SocialConnections.Add(ActiveLinkedInConnection(userId));
            db.Posts.AddRange(
                new Post { UserId = userId, Content = "a", Status = "scheduled", ScheduledAt = DateTime.UtcNow.AddHours(1) },
                new Post { UserId = userId, Content = "b", Status = "scheduled", ScheduledAt = DateTime.UtcNow.AddHours(2) },
                // Past scheduled — should NOT be counted (already missed).
                new Post { UserId = userId, Content = "past", Status = "scheduled", ScheduledAt = DateTime.UtcNow.AddHours(-1) },
                // Unrelated draft.
                new Post { UserId = userId, Content = "c", Status = "draft" });
            await db.SaveChangesAsync();
        }

        var result = await CallDisconnect(dbName, userId);
        var ok = Assert.IsType<OkObjectResult>(result);

        var okProp = (bool)GetProperty(ok.Value!, "ok")!;
        var count = (int)GetProperty(ok.Value!, "cancelled_posts")!;
        Assert.True(okProp);
        Assert.Equal(2, count);

        using var verify = CreateDb(dbName);
        // Metadata on the AuthEvent must include the same count.
        var evt = await verify.AuthEvents
            .Where(e => e.UserId == userId && e.EventType == "integration_disconnect")
            .OrderByDescending(e => e.Id)
            .FirstAsync();
        Assert.NotNull(evt.Metadata);
        Assert.Contains("\"cancelled_posts\":2", evt.Metadata!);
    }

    [Fact]
    public async Task Disconnect_is_idempotent_when_no_scheduled_posts_exist()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var u = new User { LinkedInId = "google-dc-idem", Name = "DCIdem" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            db.SocialConnections.Add(ActiveLinkedInConnection(userId));
            // Only drafts + published — nothing to fail.
            db.Posts.AddRange(
                new Post { UserId = userId, Content = "d", Status = "draft" },
                new Post { UserId = userId, Content = "p", Status = "published", PublishedAt = DateTime.UtcNow.AddDays(-1) });
            await db.SaveChangesAsync();
        }

        var first = await CallDisconnect(dbName, userId);
        var firstOk = Assert.IsType<OkObjectResult>(first);
        Assert.Equal(0, (int)GetProperty(firstOk.Value!, "cancelled_posts")!);

        var second = await CallDisconnect(dbName, userId);
        var secondOk = Assert.IsType<OkObjectResult>(second);
        Assert.Equal(0, (int)GetProperty(secondOk.Value!, "cancelled_posts")!);

        using var verify = CreateDb(dbName);
        var draft = await verify.Posts.FirstAsync(p => p.Status == "draft");
        var pub = await verify.Posts.FirstAsync(p => p.Status == "published");
        Assert.Equal("draft", draft.Status);
        Assert.Equal("published", pub.Status);
    }

    // ---- harness ----

    private static SocialConnection ActiveLinkedInConnection(int userId) =>
        new SocialConnection
        {
            UserId = userId,
            Provider = "linkedin",
            ProviderUserId = "li-dc",
            AccessTokenEncrypted = Encoding.UTF8.GetBytes("token"),
            RefreshTokenEncrypted = Encoding.UTF8.GetBytes("refresh"),
            TokenExpiresAt = DateTime.UtcNow.AddHours(1),
            Status = "active",
        };

    private static async Task<IActionResult> CallDisconnect(string dbName, int userId)
    {
        var controller = CreateController(dbName);
        var testConfig = controller.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var token = new SessionService(testConfig, new JwtService(testConfig)).CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";
        return await controller.LinkedInDisconnect();
    }

    private static AuthController CreateController(string databaseName)
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
        var controller = new AuthController(db, session, jwt, config, new StubHttpClientFactory(), protector);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        controller.HttpContext.RequestServices = new ServiceCollection()
            .AddSingleton<IConfiguration>(config)
            .BuildServiceProvider();
        return controller;
    }

    private static AppDbContext CreateDb(string databaseName)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName).Options);
        db.Database.EnsureCreated();
        return db;
    }

    private static object? GetProperty(object value, string propertyName)
    {
        var p = value.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(p);
        return p!.GetValue(value);
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
