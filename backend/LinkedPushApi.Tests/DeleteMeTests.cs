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
/// Tests for DELETE /api/auth/me — the user-initiated account deletion endpoint.
/// Verifies cascade behavior for rows that AppDbContext configures as Cascade
/// (Identity, SocialConnection, RefreshToken, Notification) and for rows we
/// delete explicitly because the FK is SetNull (Post, Media, AuthEvent).
/// </summary>
public class DeleteMeTests
{
    [Fact]
    public async Task DeleteMe_requires_authentication()
    {
        var dbName = Guid.NewGuid().ToString("n");
        var controller = CreateController(dbName);
        // No session cookie attached.

        var result = await controller.DeleteMe();

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Equal("Not authenticated", GetProperty(unauthorized.Value!, "detail"));
    }

    [Fact]
    public async Task DeleteMe_deletes_user_and_cascades_posts_media_identities_social_connections()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        int otherUserId;
        int postId;
        int mediaId;
        using (var db = CreateDb(dbName))
        {
            var user = new User { LinkedInId = "google-del", Name = "Del User", Email = "del@example.com" };
            var other = new User { LinkedInId = "google-other", Name = "Other", Email = "other@example.com" };
            db.Users.AddRange(user, other);
            await db.SaveChangesAsync();
            userId = user.Id;
            otherUserId = other.Id;

            db.Identities.Add(new Identity
            {
                UserId = userId,
                Provider = "google",
                ProviderUserId = "sub-123",
                Email = "del@example.com",
            });
            db.SocialConnections.Add(new SocialConnection
            {
                UserId = userId,
                Provider = "linkedin",
                ProviderUserId = "li-1",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("token"),
                Status = "active",
            });
            db.RefreshTokens.Add(new RefreshToken
            {
                ChainId = Guid.NewGuid(),
                UserId = userId,
                TokenHash = Encoding.UTF8.GetBytes("hash-1"),
                IssuedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(30),
            });
            db.AuthEvents.Add(new AuthEvent
            {
                UserId = userId,
                EventType = "login_success",
                Provider = "google",
            });

            var post = new Post
            {
                UserId = userId,
                Content = "to be deleted",
                Status = "scheduled",
                ScheduledAt = DateTime.UtcNow.AddHours(1),
            };
            db.Posts.Add(post);
            await db.SaveChangesAsync();
            postId = post.Id;

            db.Comments.Add(new Comment { PostId = postId, Content = "first" });
            db.Analytics.Add(new Analytics { PostId = postId });

            var media = new Media
            {
                UserId = userId,
                Filename = "img.jpg",
                OriginalFilename = "img.jpg",
                MimeType = "image/jpeg",
                FileSize = 3,
                Data = new byte[] { 1, 2, 3 },
            };
            db.Media.Add(media);
            await db.SaveChangesAsync();
            mediaId = media.Id;

            db.PostMedia.Add(new PostMedia { PostId = postId, MediaId = mediaId, Position = 0 });

            // Other user's data must remain untouched.
            db.Posts.Add(new Post
            {
                UserId = otherUserId,
                Content = "survivor",
                Status = "draft",
            });
            await db.SaveChangesAsync();
        }

        var result = await CallDelete(dbName, userId);
        Assert.IsType<OkObjectResult>(result);

        using var verify = CreateDb(dbName);
        Assert.Null(await verify.Users.FindAsync(userId));
        Assert.False(await verify.Identities.AnyAsync(i => i.UserId == userId));
        Assert.False(await verify.SocialConnections.AnyAsync(s => s.UserId == userId));
        Assert.False(await verify.RefreshTokens.AnyAsync(r => r.UserId == userId));
        Assert.False(await verify.AuthEvents.AnyAsync(e => e.UserId == userId));
        Assert.False(await verify.Posts.AnyAsync(p => p.UserId == userId));
        Assert.False(await verify.Media.AnyAsync(m => m.UserId == userId));
        Assert.False(await verify.Comments.AnyAsync(c => c.PostId == postId));
        Assert.False(await verify.Analytics.AnyAsync(a => a.PostId == postId));
        Assert.False(await verify.PostMedia.AnyAsync(pm => pm.PostId == postId));

        // Other user's data untouched.
        Assert.NotNull(await verify.Users.FindAsync(otherUserId));
        Assert.True(await verify.Posts.AnyAsync(p => p.UserId == otherUserId));
    }

    [Fact]
    public async Task DeleteMe_clears_auth_cookies_in_response()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var user = new User { LinkedInId = "google-ck", Name = "Cookie User" };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
        }

        var controller = CreateController(dbName);
        AttachSession(controller, userId);

        var result = await controller.DeleteMe();
        Assert.IsType<OkObjectResult>(result);

        var setCookie = controller.Response.Headers.SetCookie.ToString();
        // Delete emits Set-Cookie headers with expires in the past. Assert all
        // three cookie names appear so the browser drops them.
        Assert.Contains("session=", setCookie);
        Assert.Contains("lp_access=", setCookie);
        Assert.Contains("lp_refresh=", setCookie);
        Assert.Contains("expires=Thu, 01 Jan 1970", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeleteMe_returns_deleted_user_id()
    {
        var dbName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var user = new User { LinkedInId = "google-ret", Name = "Return User" };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
        }

        var controller = CreateController(dbName);
        AttachSession(controller, userId);

        var result = await controller.DeleteMe();
        var ok = Assert.IsType<OkObjectResult>(result);

        Assert.True((bool)GetProperty(ok.Value!, "ok")!);
        Assert.Equal(userId, (int)GetProperty(ok.Value!, "deleted_user_id")!);
    }

    // ---- harness ----

    private static async Task<IActionResult> CallDelete(string dbName, int userId)
    {
        var controller = CreateController(dbName);
        AttachSession(controller, userId);
        return await controller.DeleteMe();
    }

    private static void AttachSession(AuthController controller, int userId)
    {
        var testConfig = controller.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var token = new SessionService(testConfig, new JwtService(testConfig)).CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";
    }

    private static AuthController CreateController(string databaseName)
    {
        var values = new Dictionary<string, string?>
        {
            ["SecretKey"] = "test-secret-key-which-is-32-bytes-min",
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
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
