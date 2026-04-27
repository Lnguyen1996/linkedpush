using System.Net;
using System.Reflection;
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

public class NotificationsControllerTests
{
    [Fact]
    public async Task GetStored_returns_empty_when_no_notifications()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.Users.Add(new User { Id = 1, LinkedInId = "li-auth", Name = "Auth User" });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 1);

        var result = await controller.GetStored();

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<StoredNotificationsResponse>(ok.Value);
        Assert.Empty(response.Items);
        Assert.Equal(0, response.TotalCount);
        Assert.Equal(1, response.Page);
    }

    [Fact]
    public async Task GetStored_returns_notifications_paginated()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            var user = new User { Id = 10, LinkedInId = "li-notif", Name = "Notif User" };
            db.Users.Add(user);
            for (int i = 0; i < 25; i++)
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = 10,
                    Kind = "post_failed",
                    Title = $"Failed post {i}",
                    Severity = "error",
                    CreatedAt = DateTime.UtcNow.AddHours(-i),
                });
            }
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 10);

        var result = await controller.GetStored(page: 1, pageSize: 10);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<StoredNotificationsResponse>(ok.Value);
        Assert.Equal(10, response.Items.Count);
        Assert.Equal(25, response.TotalCount);
        Assert.Equal(1, response.Page);
        Assert.Equal(10, response.PageSize);
    }

    [Fact]
    public async Task MarkRead_sets_ReadAt_and_returns_ok()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        Guid notifId;
        using (var db = CreateDb(databaseName))
        {
            var user = new User { Id = 20, LinkedInId = "li-read", Name = "Read User" };
            db.Users.Add(user);
            var notif = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = 20,
                Kind = "post_failed",
                Title = "Test",
                Severity = "error",
            };
            db.Notifications.Add(notif);
            notifId = notif.Id;
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 20);

        var result = await controller.MarkRead(notifId);

        Assert.IsType<OkObjectResult>(result);

        using var verifyDb = CreateDb(databaseName);
        var updated = await verifyDb.Notifications.FindAsync(notifId);
        Assert.NotNull(updated);
        Assert.NotNull(updated!.ReadAt);
    }

    [Fact]
    public async Task MarkRead_returns_not_found_for_other_users_notification()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        Guid notifId;
        using (var db = CreateDb(databaseName))
        {
            var user1 = new User { Id = 30, LinkedInId = "li-u30", Name = "User 30" };
            var user2 = new User { Id = 31, LinkedInId = "li-u31", Name = "User 31" };
            db.Users.AddRange(user1, user2);
            var notif = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = 30,
                Kind = "post_failed",
                Title = "Not yours",
                Severity = "error",
            };
            db.Notifications.Add(notif);
            notifId = notif.Id;
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 31); // user 31 tries to read user 30's notification

        var result = await controller.MarkRead(notifId);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task MarkAllRead_marks_all_unread_and_returns_count()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            var user = new User { Id = 40, LinkedInId = "li-all", Name = "All User" };
            db.Users.Add(user);
            for (int i = 0; i < 5; i++)
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = 40,
                    Kind = "post_failed",
                    Title = $"Unread {i}",
                    Severity = "error",
                    ReadAt = null,
                });
            }
            // one already read
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = 40,
                Kind = "post_failed",
                Title = "Already read",
                Severity = "error",
                ReadAt = DateTime.UtcNow.AddHours(-1),
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 40);

        var result = await controller.MarkAllRead();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        var responseType = ok.Value.GetType();
        var markedProp = responseType.GetProperty("marked");
        Assert.NotNull(markedProp);
        var markedCount = (int)markedProp.GetValue(ok.Value)!;
        Assert.Equal(5, markedCount);

        using var verifyDb = CreateDb(databaseName);
        var unread = await verifyDb.Notifications.Where(n => n.UserId == 40 && n.ReadAt == null).CountAsync();
        Assert.Equal(0, unread);
    }

    [Fact]
    public async Task GetPreferences_returns_defaults_when_none_set()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.Users.Add(new User { Id = 50, LinkedInId = "li-pref", Name = "Pref User" });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 50);

        var result = await controller.GetPreferences();

        var ok = Assert.IsType<OkObjectResult>(result);
        var prefs = Assert.IsType<PreferencesResponse>(ok.Value);
        Assert.False(prefs.EmailEnabled);
        Assert.False(prefs.PostPublishedEmail);
        Assert.True(prefs.PostFailedEmail);
        Assert.True(prefs.WeeklyDigestEmail);
        Assert.Equal("monday", prefs.WeeklyDigestDay);
        Assert.Equal("09:00", prefs.DigestTimeOfDay);
    }

    [Fact]
    public async Task GetPreferences_returns_existing_preferences()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.Users.Add(new User { Id = 60, LinkedInId = "li-pref2", Name = "Pref User 2" });
            db.NotificationPreferences.Add(new UserNotificationPreference
            {
                UserId = 60,
                EmailEnabled = true,
                PostPublishedEmail = true,
                PostFailedEmail = false,
                WeeklyDigestEmail = false,
                WeeklyDigestDay = "friday",
                DigestTimeOfDay = "14:00",
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 60);

        var result = await controller.GetPreferences();

        var ok = Assert.IsType<OkObjectResult>(result);
        var prefs = Assert.IsType<PreferencesResponse>(ok.Value);
        Assert.True(prefs.EmailEnabled);
        Assert.True(prefs.PostPublishedEmail);
        Assert.False(prefs.PostFailedEmail);
        Assert.False(prefs.WeeklyDigestEmail);
        Assert.Equal("friday", prefs.WeeklyDigestDay);
        Assert.Equal("14:00", prefs.DigestTimeOfDay);
    }

    [Fact]
    public async Task UpdatePreferences_creates_new_preferences()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.Users.Add(new User { Id = 70, LinkedInId = "li-upd", Name = "Update User" });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 70);

        var req = new UpdatePreferencesRequest
        {
            EmailEnabled = true,
            PostPublishedEmail = true,
            PostFailedEmail = true,
            WeeklyDigestEmail = false,
            WeeklyDigestDay = "tuesday",
            DigestTimeOfDay = "08:30",
        };

        var result = await controller.UpdatePreferences(req);

        var ok = Assert.IsType<OkObjectResult>(result);
        var prefs = Assert.IsType<PreferencesResponse>(ok.Value);
        Assert.True(prefs.EmailEnabled);
        Assert.True(prefs.PostPublishedEmail);
        Assert.True(prefs.PostFailedEmail);
        Assert.False(prefs.WeeklyDigestEmail);
        Assert.Equal("tuesday", prefs.WeeklyDigestDay);
        Assert.Equal("08:30", prefs.DigestTimeOfDay);

        using var verifyDb = CreateDb(databaseName);
        var saved = await verifyDb.NotificationPreferences.FirstOrDefaultAsync(p => p.UserId == 70);
        Assert.NotNull(saved);
        Assert.True(saved!.EmailEnabled);
    }

    [Fact]
    public async Task UpdatePreferences_updates_existing_preferences()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.Users.Add(new User { Id = 80, LinkedInId = "li-upd2", Name = "Update User 2" });
            db.NotificationPreferences.Add(new UserNotificationPreference
            {
                UserId = 80,
                EmailEnabled = false,
                PostPublishedEmail = false,
                PostFailedEmail = true,
                WeeklyDigestEmail = true,
                WeeklyDigestDay = "monday",
                DigestTimeOfDay = "09:00",
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        SetUserSession(controller, userId: 80);

        var req = new UpdatePreferencesRequest
        {
            EmailEnabled = true,
            PostPublishedEmail = false,
            PostFailedEmail = false,
            WeeklyDigestEmail = true,
            WeeklyDigestDay = "wednesday",
            DigestTimeOfDay = "17:00",
        };

        var result = await controller.UpdatePreferences(req);

        var ok = Assert.IsType<OkObjectResult>(result);
        var prefs = Assert.IsType<PreferencesResponse>(ok.Value);
        Assert.True(prefs.EmailEnabled);
        Assert.False(prefs.PostPublishedEmail);
        Assert.False(prefs.PostFailedEmail);
        Assert.True(prefs.WeeklyDigestEmail);
        Assert.Equal("wednesday", prefs.WeeklyDigestDay);
        Assert.Equal("17:00", prefs.DigestTimeOfDay);
    }

    private static NotificationsController CreateController(string databaseName)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SecretKey"] = "test-secret-key-which-is-32-bytes-min",
                ["Jwt:Key"] = "test-jwt-secret-32-bytes-minimum-length",
                ["Jwt:Issuer"] = "linkedpush",
                ["Jwt:Audience"] = "linkedpush-web",
                ["FrontendUrl"] = "http://localhost:5173",
            })
            .Build();

        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options);
        db.Database.EnsureCreated();

        var sessionService = new SessionService(config, new JwtService(config));
        var notificationService = new NotificationService(new TestNotificationPublisher());
        var controller = new NotificationsController(db, sessionService, notificationService);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        controller.HttpContext.RequestServices = new ServiceCollection()
            .AddSingleton<IConfiguration>(config)
            .BuildServiceProvider();
        return controller;
    }

    private static void SetUserSession(NotificationsController controller, int userId)
    {
        var config = controller.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var jwtService = new JwtService(config);
        var sessionService = new SessionService(config, jwtService);

        // Try session cookie first
        var token = sessionService.CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";

        // Also set Bearer token header for GetCurrentUser's JWT path
        var accessToken = jwtService.CreateAccessToken(userId);
        controller.HttpContext.Request.Headers.Authorization = $"Bearer {accessToken}";
    }

    private static AppDbContext CreateDb(string databaseName)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options);
        db.Database.EnsureCreated();
        return db;
    }
}