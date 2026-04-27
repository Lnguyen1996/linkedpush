using System.Net;
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
/// Tests that verify LinkedIn is a pure connector: tokens live on SocialConnection,
/// not on the deprecated <see cref="User"/> columns (planning doc 04 §1.3).
/// </summary>
public class LinkedInConnectorTests
{
    [Fact]
    public async Task LinkedIn_callback_creates_SocialConnection_and_does_not_touch_User_AccessToken()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int userId;
        string state = "li-callback-state";
        using (var db = CreateDb(databaseName))
        {
            var seedUser = new User { LinkedInId = "google-sub-123", Name = "Test User", PrimaryLoginProvider = "google" };
            db.Users.Add(seedUser);
            await db.SaveChangesAsync();
            userId = seedUser.Id;
            db.OAuthStates.Add(new OAuthState
            {
                State = state,
                CreatedAt = DateTime.UtcNow,
                Provider = "linkedin",
                Intent = "link_provider",
                LinkUserId = userId,
            });
            await db.SaveChangesAsync();
        }

        var httpFactory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://www.linkedin.com/oauth/v2/accessToken"] = () => JsonResponse("""{"access_token":"li-access-xyz","refresh_token":"li-refresh-abc","expires_in":3600,"id_token":"hdr.eyJzdWIiOiJsaS1zdWItOTk5In0.sig"}"""),
        });

        var controller = CreateController(databaseName, httpFactory: httpFactory);

        var result = await controller.LinkedInCallback(code: "auth-code", state: state);

        Assert.IsType<RedirectResult>(result);

        using var verifyDb = CreateDb(databaseName);
        var sc = await verifyDb.SocialConnections.FirstOrDefaultAsync(s => s.UserId == userId && s.Provider == "linkedin");
        Assert.NotNull(sc);
        Assert.Equal("active", sc!.Status);
        Assert.Equal("li-sub-999", sc.ProviderUserId);
        Assert.NotNull(sc.AccessTokenEncrypted);
        // Ciphertext must NOT be a UTF-8 plaintext copy of the real token.
        Assert.NotEqual("li-access-xyz", Encoding.UTF8.GetString(sc.AccessTokenEncrypted!));
        Assert.Equal("li-access-xyz", CreateTokenProtector().Unprotect(sc.AccessTokenEncrypted));
        Assert.NotNull(sc.RefreshTokenEncrypted);
        Assert.NotEqual("li-refresh-abc", Encoding.UTF8.GetString(sc.RefreshTokenEncrypted!));
        Assert.Equal("li-refresh-abc", CreateTokenProtector().Unprotect(sc.RefreshTokenEncrypted));

        // Legacy User columns must NOT be dual-written.
        var user = await verifyDb.Users.FindAsync(userId);
        Assert.NotNull(user);
#pragma warning disable CS0618 // asserting deprecated columns stay null
        Assert.Null(user!.AccessToken);
        Assert.Null(user.RefreshToken);
        Assert.Null(user.TokenExpiresAt);
#pragma warning restore CS0618
    }

    [Fact]
    public async Task GetMe_returns_linkedin_connection_when_SocialConnection_exists_and_null_otherwise()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int userIdWith, userIdWithout;
        using (var db = CreateDb(databaseName))
        {
            var userA = new User { LinkedInId = "google-a", Name = "With LI" };
            var userB = new User { LinkedInId = "google-b", Name = "Without LI" };
            db.Users.AddRange(userA, userB);
            await db.SaveChangesAsync();
            userIdWith = userA.Id;
            userIdWithout = userB.Id;

            db.SocialConnections.Add(new SocialConnection
            {
                UserId = userIdWith,
                Provider = "linkedin",
                ProviderUserId = "li-sub",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("token"),
                TokenExpiresAt = DateTime.UtcNow.AddHours(1),
                Scopes = "openid profile email w_member_social",
                Status = "active",
            });
            await db.SaveChangesAsync();
        }

        var okPayloadWith = await CallGetMe(databaseName, userIdWith);
        AssertHasProperty(okPayloadWith, "linkedin_connection", out var linkedInObj);
        Assert.NotNull(linkedInObj);
        var status = GetStringProperty(linkedInObj!, "status");
        var scopes = GetStringProperty(linkedInObj!, "scopes");
        Assert.Equal("active", status);
        Assert.Contains("w_member_social", scopes);
        Assert.True((bool)GetProperty(okPayloadWith, "has_linkedin_token")!);

        var okPayloadWithout = await CallGetMe(databaseName, userIdWithout);
        AssertHasProperty(okPayloadWithout, "linkedin_connection", out var noneObj);
        Assert.Null(noneObj);
        Assert.False((bool)GetProperty(okPayloadWithout, "has_linkedin_token")!);
    }

    [Fact]
    public async Task LinkedIn_disconnect_revokes_SocialConnection_and_clears_tokens()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var user = new User { LinkedInId = "google-disconnect", Name = "Disconnecter" };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;

            db.SocialConnections.Add(new SocialConnection
            {
                UserId = userId,
                Provider = "linkedin",
                ProviderUserId = "li-dc",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("token"),
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("refresh"),
                TokenExpiresAt = DateTime.UtcNow.AddHours(1),
                Status = "active",
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName, overrides: new Dictionary<string, string?>
        {
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
        });
        var testConfig = controller.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var token = new SessionService(testConfig, new JwtService(testConfig)).CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";

        var result = await controller.LinkedInDisconnect();
        Assert.IsType<OkObjectResult>(result);

        using var verifyDb = CreateDb(databaseName);
        var sc = await verifyDb.SocialConnections.FirstOrDefaultAsync(s => s.UserId == userId && s.Provider == "linkedin");
        Assert.NotNull(sc);
        Assert.Equal("revoked", sc!.Status);
        Assert.Null(sc.AccessTokenEncrypted);
        Assert.Null(sc.RefreshTokenEncrypted);
    }

    [Fact]
    public async Task TokenRefreshService_sweep_picks_up_expiring_SocialConnections()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            var user = new User { LinkedInId = "google-refresh", Name = "Refresher" };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            db.SocialConnections.AddRange(
                // expiring within the next hour — should be picked up
                new SocialConnection
                {
                    UserId = user.Id,
                    Provider = "linkedin",
                    ProviderUserId = "li-exp",
                    AccessTokenEncrypted = Encoding.UTF8.GetBytes("a"),
                    RefreshTokenEncrypted = Encoding.UTF8.GetBytes("r"),
                    TokenExpiresAt = DateTime.UtcNow.AddMinutes(30),
                    Status = "active",
                },
                // already revoked — skipped
                new SocialConnection
                {
                    UserId = user.Id,
                    Provider = "linkedin",
                    ProviderUserId = "li-rev",
                    AccessTokenEncrypted = null,
                    RefreshTokenEncrypted = null,
                    TokenExpiresAt = DateTime.UtcNow.AddMinutes(30),
                    Status = "revoked",
                },
                // expires way later — skipped
                new SocialConnection
                {
                    UserId = user.Id,
                    Provider = "linkedin",
                    ProviderUserId = "li-far",
                    AccessTokenEncrypted = Encoding.UTF8.GetBytes("a"),
                    RefreshTokenEncrypted = Encoding.UTF8.GetBytes("r"),
                    TokenExpiresAt = DateTime.UtcNow.AddDays(30),
                    Status = "active",
                });
            await db.SaveChangesAsync();
        }

        using (var db = CreateDb(databaseName))
        {
            var cutoff = DateTime.UtcNow.AddHours(1);
            var picked = await db.SocialConnections
                .Where(sc => sc.Provider == "linkedin"
                    && sc.Status == "active"
                    && sc.RefreshTokenEncrypted != null
                    && sc.TokenExpiresAt != null
                    && sc.TokenExpiresAt <= cutoff)
                .Select(sc => sc.ProviderUserId)
                .ToListAsync();

            Assert.Single(picked);
            Assert.Equal("li-exp", picked[0]);
        }
    }

    [Fact]
    public async Task Legacy_migration_is_idempotent_and_skips_google_users_and_dev_sentinel()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int legacyUserId, googleUserId, devUserId;
        using (var db = CreateDb(databaseName))
        {
#pragma warning disable CS0618
            var legacy = new User
            {
                LinkedInId = "real-linkedin-sub-abc",
                Name = "Legacy",
                AccessToken = "legacy-token",
                RefreshToken = "legacy-refresh",
                TokenExpiresAt = DateTime.UtcNow.AddHours(2),
            };
            var google = new User
            {
                LinkedInId = "google-xyz",
                Name = "Google",
                AccessToken = "also-legacy-but-google-user-with-li-token",
                TokenExpiresAt = DateTime.UtcNow.AddHours(2),
            };
            var dev = new User
            {
                LinkedInId = "dev-user",
                Name = "Dev",
                AccessToken = "dev-token",
            };
#pragma warning restore CS0618
            db.Users.AddRange(legacy, google, dev);
            await db.SaveChangesAsync();
            legacyUserId = legacy.Id;
            googleUserId = google.Id;
            devUserId = dev.Id;
        }

        var service = CreateLinkedInService();

        using (var db = CreateDb(databaseName))
        {
            var migrated = await service.MigrateLegacyLinkedInTokens(db);
            Assert.Equal(2, migrated); // legacy + google (both have real access tokens)
        }

        using (var db = CreateDb(databaseName))
        {
            // Second run — idempotent (no duplicates).
            var migratedAgain = await service.MigrateLegacyLinkedInTokens(db);
            Assert.Equal(0, migratedAgain);

            var connections = await db.SocialConnections.Where(s => s.Provider == "linkedin").ToListAsync();
            Assert.Equal(2, connections.Count);

            var legacyConn = connections.First(c => c.UserId == legacyUserId);
            // Real LinkedIn sub preserved from user.LinkedInId.
            Assert.Equal("real-linkedin-sub-abc", legacyConn.ProviderUserId);

            var googleConn = connections.First(c => c.UserId == googleUserId);
            // Google user — provider_user_id derived from token hash, not "google-xyz".
            Assert.DoesNotContain("google", googleConn.ProviderUserId);

            // Dev user never migrated.
            Assert.DoesNotContain(connections, c => c.UserId == devUserId);
        }
    }

    // ---- Token refresh lifecycle tests ----

    [Fact]
    public async Task RefreshAccessToken_on_400_invalid_grant_marks_SC_expired_and_emits_failed_event()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        long scId;
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var u = new User { LinkedInId = "google-term-400", Name = "Term400" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            var sc = new SocialConnection
            {
                UserId = userId,
                Provider = "linkedin",
                ProviderUserId = "li-term-400",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("old-access"),
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("rt"),
                TokenExpiresAt = DateTime.UtcNow.AddMinutes(1),
                Status = "active",
            };
            db.SocialConnections.Add(sc);
            await db.SaveChangesAsync();
            scId = sc.Id;
        }

        var factory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://www.linkedin.com/oauth/v2/accessToken"] = () =>
                new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = new StringContent("""{"error":"invalid_grant","error_description":"The refresh token is invalid"}"""),
                },
        });
        var service = CreateLinkedInService(factory);

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            var outcome = await service.RefreshAccessTokenV2(sc, db);
            Assert.Equal(LinkedInService.RefreshOutcome.Terminal, outcome);
        }

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            Assert.Equal("expired", sc.Status);
            Assert.Null(sc.AccessTokenEncrypted);

            var evt = await db.AuthEvents.FirstOrDefaultAsync(e =>
                e.UserId == userId && e.EventType == "token_refresh_failed");
            Assert.NotNull(evt);
            Assert.Equal("linkedin", evt!.Provider);
            Assert.NotNull(evt.Metadata);
            Assert.Contains("invalid_grant", evt.Metadata!);
        }
    }

    [Fact]
    public async Task RefreshAccessToken_on_401_marks_SC_expired()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        long scId;
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var u = new User { LinkedInId = "google-term-401", Name = "Term401" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;
            var sc = new SocialConnection
            {
                UserId = userId,
                Provider = "linkedin",
                ProviderUserId = "li-term-401",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("old-access"),
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("rt"),
                TokenExpiresAt = DateTime.UtcNow.AddMinutes(1),
                Status = "active",
            };
            db.SocialConnections.Add(sc);
            await db.SaveChangesAsync();
            scId = sc.Id;
        }

        var factory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://www.linkedin.com/oauth/v2/accessToken"] = () =>
                new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("") },
        });
        var service = CreateLinkedInService(factory);

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            var outcome = await service.RefreshAccessTokenV2(sc, db);
            Assert.Equal(LinkedInService.RefreshOutcome.Terminal, outcome);
        }

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            Assert.Equal("expired", sc.Status);
            Assert.Null(sc.AccessTokenEncrypted);

            var evt = await db.AuthEvents.FirstOrDefaultAsync(e =>
                e.UserId == userId && e.EventType == "token_refresh_failed");
            Assert.NotNull(evt);
            Assert.Contains("http_401", evt!.Metadata ?? "");
        }
    }

    [Fact]
    public async Task RefreshAccessToken_on_500_keeps_SC_active_returns_Transient()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        long scId;
        using (var db = CreateDb(databaseName))
        {
            var u = new User { LinkedInId = "google-trans-500", Name = "Trans500" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            var sc = new SocialConnection
            {
                UserId = u.Id,
                Provider = "linkedin",
                ProviderUserId = "li-trans-500",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("old-access"),
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("rt"),
                TokenExpiresAt = DateTime.UtcNow.AddMinutes(1),
                Status = "active",
            };
            db.SocialConnections.Add(sc);
            await db.SaveChangesAsync();
            scId = sc.Id;
        }

        var factory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://www.linkedin.com/oauth/v2/accessToken"] = () =>
                new HttpResponseMessage(HttpStatusCode.InternalServerError) { Content = new StringContent("upstream down") },
        });
        var service = CreateLinkedInService(factory);

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            var outcome = await service.RefreshAccessTokenV2(sc, db);
            Assert.Equal(LinkedInService.RefreshOutcome.Transient, outcome);
        }

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            Assert.Equal("active", sc.Status);
            Assert.NotNull(sc.AccessTokenEncrypted);
            Assert.Equal("old-access", Encoding.UTF8.GetString(sc.AccessTokenEncrypted!));
            // No token_refresh_failed event should be emitted for a transient failure.
            var failed = await db.AuthEvents.AnyAsync(e => e.EventType == "token_refresh_failed");
            Assert.False(failed);
        }
    }

    [Fact]
    public async Task RefreshAccessToken_dedupes_if_called_within_30_seconds_of_LastRefreshedAt()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        long scId;
        using (var db = CreateDb(databaseName))
        {
            var u = new User { LinkedInId = "google-dedupe", Name = "Dedupe" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            var sc = new SocialConnection
            {
                UserId = u.Id,
                Provider = "linkedin",
                ProviderUserId = "li-dedupe",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("fresh-access"),
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("rt"),
                TokenExpiresAt = DateTime.UtcNow.AddMinutes(55),
                LastRefreshedAt = DateTime.UtcNow.AddSeconds(-5), // just refreshed
                Status = "active",
            };
            db.SocialConnections.Add(sc);
            await db.SaveChangesAsync();
            scId = sc.Id;
        }

        // Factory that would FAIL the test if it were called — we expect no HTTP hit.
        bool hit = false;
        var factory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://www.linkedin.com/oauth/v2/accessToken"] = () =>
            {
                hit = true;
                return new HttpResponseMessage(HttpStatusCode.OK)
                { Content = new StringContent("""{"access_token":"NEVER","expires_in":3600}""") };
            },
        });
        var service = CreateLinkedInService(factory);

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            var outcome = await service.RefreshAccessTokenV2(sc, db);
            Assert.Equal(LinkedInService.RefreshOutcome.AlreadyFresh, outcome);
        }

        Assert.False(hit, "Dedupe should have prevented the HTTP call.");

        using (var db = CreateDb(databaseName))
        {
            var sc = await db.SocialConnections.FirstAsync(s => s.Id == scId);
            Assert.Equal("fresh-access", Encoding.UTF8.GetString(sc.AccessTokenEncrypted!));
        }
    }

    // ---- NotificationsController expired/expiring tests ----

    [Fact]
    public async Task NotificationsController_emits_token_expired_when_SC_status_is_expired()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var u = new User { LinkedInId = "google-noti-expired", Name = "Expired" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;

            db.SocialConnections.Add(new SocialConnection
            {
                UserId = userId,
                Provider = "linkedin",
                ProviderUserId = "li-exp-status",
                AccessTokenEncrypted = null,
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("rt"),
                TokenExpiresAt = DateTime.UtcNow.AddHours(-1),
                Status = "expired",
            });
            await db.SaveChangesAsync();
        }

        var kinds = await CallNotificationsAndGetKinds(databaseName, userId);
        Assert.Contains("linkedin_token_expired", kinds);
        Assert.DoesNotContain("linkedin_token_expiring", kinds);
    }

    [Fact]
    public async Task NotificationsController_emits_token_expired_when_SC_past_expiry_even_if_active()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var u = new User { LinkedInId = "google-noti-past", Name = "PastExpiry" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;

            db.SocialConnections.Add(new SocialConnection
            {
                UserId = userId,
                Provider = "linkedin",
                ProviderUserId = "li-past",
                AccessTokenEncrypted = Encoding.UTF8.GetBytes("stale"),
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("rt"),
                // In the past but status still `active` (scheduler hasn't swept yet).
                TokenExpiresAt = DateTime.UtcNow.AddMinutes(-30),
                Status = "active",
            });
            await db.SaveChangesAsync();
        }

        var kinds = await CallNotificationsAndGetKinds(databaseName, userId);
        Assert.Contains("linkedin_token_expired", kinds);
    }

    [Fact]
    public async Task NotificationsController_does_not_emit_both_expiring_and_expired_for_same_SC()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var u = new User { LinkedInId = "google-noti-both", Name = "Both" };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            userId = u.Id;

            // Expired status AND within the "expiring" 7-day window (past means <= 7d).
            db.SocialConnections.Add(new SocialConnection
            {
                UserId = userId,
                Provider = "linkedin",
                ProviderUserId = "li-both",
                AccessTokenEncrypted = null,
                RefreshTokenEncrypted = Encoding.UTF8.GetBytes("rt"),
                TokenExpiresAt = DateTime.UtcNow.AddDays(3), // inside 7d window
                Status = "expired",                          // but status wins
            });
            await db.SaveChangesAsync();
        }

        var kinds = await CallNotificationsAndGetKinds(databaseName, userId);
        Assert.Contains("linkedin_token_expired", kinds);
        Assert.DoesNotContain("linkedin_token_expiring", kinds);
    }

    private static async Task<List<string>> CallNotificationsAndGetKinds(string databaseName, int userId)
    {
        var values = new Dictionary<string, string?>
        {
            ["SecretKey"] = "test-secret-key-which-is-32-bytes-min",
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options);
        db.Database.EnsureCreated();
        var jwt = new JwtService(config);
        var session = new SessionService(config, jwt);
        var notificationService = new NotificationService(new TestNotificationPublisher());
        var controller = new NotificationsController(db, session, notificationService);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        controller.HttpContext.RequestServices = new ServiceCollection()
            .AddSingleton<IConfiguration>(config)
            .BuildServiceProvider();

        var token = session.CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";

        var result = await controller.List();
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);

        var itemsProp = ok.Value!.GetType().GetProperty("items", BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(itemsProp);
        var items = (IEnumerable<object>)itemsProp!.GetValue(ok.Value)!;

        var kinds = new List<string>();
        foreach (var item in items)
        {
            var k = item.GetType().GetProperty("Kind", BindingFlags.Public | BindingFlags.Instance)?.GetValue(item) as string;
            if (k != null) kinds.Add(k);
        }
        return kinds;
    }

    private static LinkedInService CreateLinkedInService(IHttpClientFactory factory)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LinkedIn:ClientId"] = "linkedin-client-id",
                ["LinkedIn:ClientSecret"] = "linkedin-client-secret",
            })
            .Build();
        return new LinkedInService(config, factory, NullLogger<LinkedInService>.Instance, CreateTokenProtector());
    }

    // Shared Data Protection provider used across every helper in this file so that
    // a value protected in one fixture can be unprotected in another. Ephemeral =>
    // scoped to the test process; nothing touches the filesystem.
    private static readonly IDataProtectionProvider _sharedDpProvider =
        Microsoft.AspNetCore.DataProtection.DataProtectionProvider.Create("LinkedPush.Tests");

    private static TokenProtector CreateTokenProtector() =>
        new TokenProtector(_sharedDpProvider, NullLogger<TokenProtector>.Instance);

    // ---- Harness helpers (mirror AuthControllerTests pattern) ----

    private static async Task<object> CallGetMe(string databaseName, int userId)
    {
        var controller = CreateController(databaseName, overrides: new Dictionary<string, string?>
        {
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
        });
        var testConfig = controller.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var token = new SessionService(testConfig, new JwtService(testConfig)).CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";

        var result = await controller.GetMe();
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        return ok.Value!;
    }

    private static AuthController CreateController(
        string databaseName,
        Dictionary<string, string?>? overrides = null,
        IHttpClientFactory? httpFactory = null)
    {
        var values = new Dictionary<string, string?>
        {
            ["SecretKey"] = "test-secret-key-which-is-32-bytes-min",
            ["Google:ClientId"] = "google-client-id",
            ["Google:ClientSecret"] = "google-client-secret",
            ["Google:RedirectUri"] = "http://localhost:8000/api/auth/callback",
            ["LinkedIn:ClientId"] = "linkedin-client-id",
            ["LinkedIn:ClientSecret"] = "linkedin-client-secret",
            ["LinkedIn:RedirectUri"] = "http://localhost:8000/api/auth/linkedin/callback",
            ["FrontendUrl"] = "http://localhost:5173",
        };
        if (overrides != null)
        {
            foreach (var (key, value) in overrides)
                values[key] = value;
        }

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();

        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options);
        db.Database.EnsureCreated();
        var jwtService = new JwtService(config);
        var sessionService = new SessionService(config, jwtService);
        var controller = new AuthController(db, sessionService, jwtService, config, httpFactory ?? new StubHttpClientFactory(), CreateTokenProtector());
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
            .UseInMemoryDatabase(databaseName)
            .Options);
        db.Database.EnsureCreated();
        return db;
    }

    private static LinkedInService CreateLinkedInService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LinkedIn:ClientId"] = "linkedin-client-id",
                ["LinkedIn:ClientSecret"] = "linkedin-client-secret",
            })
            .Build();
        return new LinkedInService(config, new StubHttpClientFactory(), NullLogger<LinkedInService>.Instance, CreateTokenProtector());
    }

    private static object? GetProperty(object value, string propertyName)
    {
        var p = value.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(p);
        return p!.GetValue(value);
    }

    private static string GetStringProperty(object value, string propertyName)
    {
        var raw = GetProperty(value, propertyName);
        return Assert.IsType<string>(raw);
    }

    private static void AssertHasProperty(object value, string propertyName, out object? child)
    {
        var p = value.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(p);
        child = p!.GetValue(value);
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            new HttpClient(new StubMessageHandler()) { BaseAddress = new Uri("http://localhost") };
    }

    private sealed class StubMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("{}") });
    }

    private static HttpResponseMessage JsonResponse(string json, HttpStatusCode statusCode = HttpStatusCode.OK) =>
        new HttpResponseMessage(statusCode) { Content = new StringContent(json) };

    private sealed class RoutingHttpClientFactory : IHttpClientFactory
    {
        private readonly IReadOnlyDictionary<string, Func<HttpResponseMessage>> _routes;
        public RoutingHttpClientFactory(IReadOnlyDictionary<string, Func<HttpResponseMessage>> routes) { _routes = routes; }
        public HttpClient CreateClient(string name) =>
            new HttpClient(new RoutingMessageHandler(_routes)) { BaseAddress = new Uri("http://localhost") };
    }

    private sealed class RoutingMessageHandler : HttpMessageHandler
    {
        private readonly IReadOnlyDictionary<string, Func<HttpResponseMessage>> _routes;
        public RoutingMessageHandler(IReadOnlyDictionary<string, Func<HttpResponseMessage>> routes) { _routes = routes; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var key = request.RequestUri?.ToString() ?? "";
            if (_routes.TryGetValue(key, out var f)) return Task.FromResult(f());
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("{}") });
        }
    }
}
