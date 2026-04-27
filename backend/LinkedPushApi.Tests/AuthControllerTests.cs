using System.Net;
using System.Reflection;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using LinkedPushApi.Controllers;
using LinkedPushApi.Data;
using LinkedPushApi.Services;
using Xunit;

namespace LinkedPushApi.Tests;

public class AuthControllerTests
{
    [Fact]
    public async Task Login_uses_dev_login_when_dev_mode_has_placeholder_google_credentials()
    {
        var controller = CreateController(
            Guid.NewGuid().ToString("n"),
            new Dictionary<string, string?>
            {
                ["DevMode"] = "true",
                ["Google:ClientId"] = "CHANGEME",
                ["Google:ClientSecret"] = "CHANGEME",
            });

        var loginResult = await controller.Login();

        var ok = Assert.IsType<OkObjectResult>(loginResult);
        Assert.Equal("/api/auth/dev-login", GetAnonymousStringProperty(ok.Value, "redirect_url"));
    }

    [Fact]
    public async Task Login_rejects_placeholder_google_credentials_when_dev_mode_is_disabled()
    {
        var controller = CreateController(
            Guid.NewGuid().ToString("n"),
            new Dictionary<string, string?>
            {
                ["DevMode"] = "false",
                ["Google:ClientId"] = "CHANGEME",
                ["Google:ClientSecret"] = "CHANGEME",
            });

        var loginResult = await controller.Login();

        var error = Assert.IsType<ObjectResult>(loginResult);
        Assert.Equal(500, error.StatusCode);
        Assert.Contains("Google OAuth is not configured", GetAnonymousStringProperty(error.Value, "detail"));
    }

    [Fact]
    public async Task Login_accepts_documented_google_environment_variable_names()
    {
        var controller = CreateController(
            Guid.NewGuid().ToString("n"),
            new Dictionary<string, string?>
            {
                ["Google:ClientId"] = "CHANGEME",
                ["Google:ClientSecret"] = "CHANGEME",
                ["GOOGLE_CLIENT_ID"] = "env-client-id",
                ["GOOGLE_CLIENT_SECRET"] = "env-client-secret",
                ["GOOGLE_REDIRECT_URI"] = "http://localhost:8000/api/auth/callback",
            });

        var loginResult = await controller.Login();

        var ok = Assert.IsType<OkObjectResult>(loginResult);
        var redirectUrl = GetAnonymousStringProperty(ok.Value, "redirect_url");
        var query = QueryHelpers.ParseQuery(new Uri(redirectUrl).Query);
        Assert.Equal("env-client-id", query["client_id"].ToString());
        Assert.Equal("http://localhost:8000/api/auth/callback", query["redirect_uri"].ToString());
    }

    [Fact]
    public async Task Callback_accepts_login_state_after_backend_restart()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        var loginController = CreateController(databaseName);
        var loginResult = await loginController.Login();
        var ok = Assert.IsType<OkObjectResult>(loginResult);
        var redirectUrl = GetAnonymousStringProperty(ok.Value, "redirect_url");
        var loginState = QueryHelpers.ParseQuery(new Uri(redirectUrl).Query)["state"].ToString();

        Assert.False(string.IsNullOrWhiteSpace(loginState));
        var callbackController = CreateController(databaseName);

        var callbackResult = await callbackController.Callback(code: "auth-code", state: loginState);
        var badRequest = Assert.IsType<BadRequestObjectResult>(callbackResult);
        var detail = GetAnonymousStringProperty(badRequest.Value, "detail");

        Assert.Equal("Failed to exchange code for token", detail);
    }

    [Fact]
    public async Task Callback_requires_state_when_oauth_is_enabled()
    {
        var controller = CreateController(Guid.NewGuid().ToString("n"));

        var callbackResult = await controller.Callback(code: "auth-code", state: null);

        var badRequest = Assert.IsType<BadRequestObjectResult>(callbackResult);
        Assert.Equal("Missing state parameter", GetAnonymousStringProperty(badRequest.Value, "detail"));
    }

    [Fact]
    public async Task Callback_rejects_expired_state()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.OAuthStates.Add(new Models.OAuthState
            {
                State = "expired-state",
                CreatedAt = DateTime.UtcNow.AddMinutes(-11),
                Provider = "linkedin",
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        var callbackResult = await controller.Callback(code: "auth-code", state: "expired-state");

        var badRequest = Assert.IsType<BadRequestObjectResult>(callbackResult);
        Assert.Equal("Invalid or expired state parameter", GetAnonymousStringProperty(badRequest.Value, "detail"));
    }

    [Fact]
    public async Task Callback_rejects_unknown_provider_state_with_json_body()
    {
        // Regression: previously every non-Google state fell through to a
        // generic error that sometimes returned an empty body. Now any
        // provider we don't recognize must produce an explicit JSON detail.
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.OAuthStates.Add(new Models.OAuthState
            {
                State = "weird-state",
                CreatedAt = DateTime.UtcNow,
                Provider = "facebook",
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        var callbackResult = await controller.Callback(code: "auth-code", state: "weird-state");

        var badRequest = Assert.IsType<BadRequestObjectResult>(callbackResult);
        Assert.Equal("Unknown provider in state", GetAnonymousStringProperty(badRequest.Value, "detail"));
    }

    [Fact]
    public async Task Callback_dispatches_linkedin_state_to_linkedin_handler()
    {
        // The generic /api/auth/callback must accept LinkedIn state too — the
        // LinkedIn Developer Portal allows a single redirect URI per app and
        // we point it at this shared path. Confirm the dispatch reached the
        // LinkedIn token-exchange step (stub returns BadRequest so we expect
        // "Failed to exchange code for token", NOT "Invalid state provider").
        var databaseName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var user = new Models.User
            {
                LinkedInId = "li-link-user",
                Name = "Link User",
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
            db.OAuthStates.Add(new Models.OAuthState
            {
                State = "li-generic-state",
                CreatedAt = DateTime.UtcNow,
                Provider = "linkedin",
                Intent = "link_provider",
                LinkUserId = userId,
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        var callbackResult = await controller.Callback(code: "auth-code", state: "li-generic-state");

        var badRequest = Assert.IsType<BadRequestObjectResult>(callbackResult);
        Assert.Equal("Failed to exchange code for token", GetAnonymousStringProperty(badRequest.Value, "detail"));
    }

    [Fact]
    public async Task LinkedInCallback_rejects_google_state()
    {
        // The dedicated /api/auth/linkedin/callback endpoint must still reject
        // a state whose Provider is "google" so that crossed-up OAuth flows
        // cannot be used to bypass the LinkedIn link intent check.
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.OAuthStates.Add(new Models.OAuthState
            {
                State = "google-state-on-li-callback",
                CreatedAt = DateTime.UtcNow,
                Provider = "google",
                Nonce = "nonce-li",
            });
            await db.SaveChangesAsync();
        }

        var controller = CreateController(databaseName);
        var result = await controller.LinkedInCallback(code: "auth-code", state: "google-state-on-li-callback");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Invalid state provider", GetAnonymousStringProperty(badRequest.Value, "detail"));
    }

    [Fact]
    public async Task Logout_invalidates_existing_session_token()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var user = new Models.User
            {
                LinkedInId = "li-logout",
                Name = "Logout User",
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
        }

        var controller = CreateController(databaseName, overrides: new Dictionary<string, string?>
        {
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
        });
        var testConfig = controller.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var token = new SessionService(testConfig, new JwtService(testConfig)).CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";

        var result = await controller.Logout();
        Assert.IsType<OkObjectResult>(result);

        using var verifyDb = CreateDb(databaseName);
        var userAfterLogout = await verifyDb.Users.FindAsync(userId);
        Assert.NotNull(userAfterLogout);
        Assert.NotNull(userAfterLogout!.SessionInvalidBefore);
    }

    [Fact]
    public async Task Callback_sets_auth_cookies_without_secure_in_dev_when_overridden()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.OAuthStates.Add(new Models.OAuthState
            {
                State = "ok-state",
                CreatedAt = DateTime.UtcNow,
                Provider = "google",
                Nonce = "nonce-123",
            });
            await db.SaveChangesAsync();
        }

        var httpFactory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://oauth2.googleapis.com/token"] = () => JsonResponse("""{"access_token":"ya29.token","id_token":"hdr.eyJzdWIiOiJnLXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlRlc3QgVXNlciIsIm5vbmNlIjoibm9uY2UtMTIzIn0.sig","expires_in":3600}"""),
            ["https://oauth2.googleapis.com/tokeninfo?id_token=hdr.eyJzdWIiOiJnLXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlRlc3QgVXNlciIsIm5vbmNlIjoibm9uY2UtMTIzIn0.sig"] =
                () => JsonResponse("""{"aud":"google-client-id","iss":"https://accounts.google.com","exp":"4102444800","sub":"g-user","email":"test@example.com","email_verified":"true","name":"Test User","nonce":"nonce-123"}"""),
        });

        var controller = CreateController(databaseName, overrides: new Dictionary<string, string?>
        {
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
        }, httpFactory: httpFactory);

        var callbackResult = await controller.Callback(code: "auth-code", state: "ok-state");
        var redirect = Assert.IsType<RedirectResult>(callbackResult);
        Assert.Equal("http://localhost:5173/app", redirect.Url);
        var setCookie = controller.Response.Headers.SetCookie.ToString();
        Assert.Contains("session=", setCookie);
        Assert.Contains("lp_access=", setCookie);
        Assert.Contains("lp_refresh=", setCookie);
        Assert.DoesNotContain("secure", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Callback_extracts_picture_from_id_token_payload()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        using (var db = CreateDb(databaseName))
        {
            db.OAuthStates.Add(new Models.OAuthState
            {
                State = "pic-state",
                CreatedAt = DateTime.UtcNow,
                Provider = "google",
                Nonce = "nonce-abc",
            });
            await db.SaveChangesAsync();
        }

        var realPictureUrl = "https://lh3.googleusercontent.com/photo/abc123";
        var idTokenPayload = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(
            $$"""{"sub":"g-user-789","email":"avatar@test.com","email_verified":true,"name":"Avatar User","picture":"{{realPictureUrl}}","nonce":"nonce-abc"}"""))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var idToken = $"hdr.{idTokenPayload}.sig";

        var httpFactory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://oauth2.googleapis.com/token"] = () => JsonResponse($"{{\"access_token\":\"atoken\",\"id_token\":\"{idToken}\"}}"),
            [$"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}"] =
                () => JsonResponse("""{"aud":"google-client-id","iss":"https://accounts.google.com","exp":"4102444800","sub":"g-user-789"}"""),
        });

        var controller = CreateController(databaseName, overrides: new Dictionary<string, string?>
        {
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
        }, httpFactory: httpFactory);

        var callbackResult = await controller.Callback(code: "auth-code", state: "pic-state");
        Assert.IsType<RedirectResult>(callbackResult);

        using var verifyDb = CreateDb(databaseName);
        var user = await verifyDb.Users.FirstOrDefaultAsync(u => u.Email == "avatar@test.com");
        Assert.NotNull(user);
        Assert.Equal(realPictureUrl, user!.AvatarUrl);
    }

    [Fact]
    public async Task Callback_links_verified_google_login_to_existing_email_user()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        int existingUserId;
        using (var db = CreateDb(databaseName))
        {
            var user = new Models.User
            {
                LinkedInId = "legacy-linkedin-user",
                Name = "Legacy User",
                Email = "lnguyen4e@gmail.com",
                PrimaryLoginProvider = "linkedin",
            };
            db.Users.Add(user);
            db.OAuthStates.Add(new Models.OAuthState
            {
                State = "link-existing-email-state",
                CreatedAt = DateTime.UtcNow,
                Provider = "google",
                Nonce = "nonce-link",
            });
            await db.SaveChangesAsync();
            existingUserId = user.Id;
        }

        var pictureUrl = "https://lh3.googleusercontent.com/photo/linked";
        var idTokenPayload = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(
            $$"""{"sub":"g-linked-user","email":"LNguyen4e@Gmail.com","email_verified":true,"name":"Lam Google","picture":"{{pictureUrl}}","nonce":"nonce-link"}"""))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var idToken = $"hdr.{idTokenPayload}.sig";
        var httpFactory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            ["https://oauth2.googleapis.com/token"] = () => JsonResponse($"{{\"access_token\":\"atoken\",\"id_token\":\"{idToken}\"}}"),
            [$"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}"] =
                () => JsonResponse("""{"aud":"google-client-id","iss":"https://accounts.google.com","exp":"4102444800","sub":"g-linked-user"}"""),
        });

        var controller = CreateController(databaseName, overrides: new Dictionary<string, string?>
        {
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
        }, httpFactory: httpFactory);

        var callbackResult = await controller.Callback(code: "auth-code", state: "link-existing-email-state");
        var redirect = Assert.IsType<RedirectResult>(callbackResult);
        Assert.Equal("http://localhost:5173/app", redirect.Url);

        using var verifyDb = CreateDb(databaseName);
        Assert.Equal(1, await verifyDb.Users.CountAsync());
        var identity = await verifyDb.Identities.FirstOrDefaultAsync(i => i.Provider == "google" && i.ProviderUserId == "g-linked-user");
        Assert.NotNull(identity);
        Assert.Equal(existingUserId, identity!.UserId);

        var userAfterLogin = await verifyDb.Users.FindAsync(existingUserId);
        Assert.NotNull(userAfterLogin);
        Assert.Equal("Lam Google", userAfterLogin!.Name);
        Assert.Equal("lnguyen4e@gmail.com", userAfterLogin.Email);
        Assert.Equal(pictureUrl, userAfterLogin.AvatarUrl);
        Assert.True(userAfterLogin.EmailVerified);
        Assert.Equal("google", userAfterLogin.PrimaryLoginProvider);
    }

    [Fact]
    public async Task Avatar_returns_current_users_google_profile_photo()
    {
        var databaseName = Guid.NewGuid().ToString("n");
        var avatarUrl = "https://lh3.googleusercontent.com/photo/avatar123";
        var avatarBytes = new byte[] { 1, 2, 3, 4 };
        int userId;
        using (var db = CreateDb(databaseName))
        {
            var user = new Models.User
            {
                LinkedInId = "google-avatar",
                Name = "Avatar User",
                Email = "avatar@test.com",
                AvatarUrl = avatarUrl,
                PrimaryLoginProvider = "google",
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
        }

        var httpFactory = new RoutingHttpClientFactory(new Dictionary<string, Func<HttpResponseMessage>>
        {
            [avatarUrl] = () => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(avatarBytes)
                {
                    Headers = { ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg") },
                },
            },
        });

        var controller = CreateController(databaseName, httpFactory: httpFactory);
        var testConfig = controller.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var token = new SessionService(testConfig, new JwtService(testConfig)).CreateSessionToken(userId);
        controller.HttpContext.Request.Headers.Cookie = $"session={token}";

        var result = await controller.Avatar(CancellationToken.None);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("image/jpeg", file.ContentType);
        Assert.Equal(avatarBytes, file.FileContents);
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
        var tokenProtector = new TokenProtector(
            DataProtectionProvider.Create("LinkedPush.Tests"),
            NullLogger<TokenProtector>.Instance);
        var controller = new AuthController(db, sessionService, jwtService, config, httpFactory ?? new StubHttpClientFactory(), tokenProtector);
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

    private static string GetAnonymousStringProperty(object? value, string propertyName)
    {
        Assert.NotNull(value);
        var property = value.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(property);
        return Assert.IsType<string>(property.GetValue(value));
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            return new HttpClient(new StubMessageHandler())
            {
                BaseAddress = new Uri("http://localhost"),
            };
        }
    }

    private sealed class StubMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("{}"),
            });
        }
    }

    private static HttpResponseMessage JsonResponse(string json, HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        return new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(json),
        };
    }

    private sealed class RoutingHttpClientFactory : IHttpClientFactory
    {
        private readonly IReadOnlyDictionary<string, Func<HttpResponseMessage>> _routes;

        public RoutingHttpClientFactory(IReadOnlyDictionary<string, Func<HttpResponseMessage>> routes)
        {
            _routes = routes;
        }

        public HttpClient CreateClient(string name)
        {
            return new HttpClient(new RoutingMessageHandler(_routes))
            {
                BaseAddress = new Uri("http://localhost"),
            };
        }
    }

    private sealed class RoutingMessageHandler : HttpMessageHandler
    {
        private readonly IReadOnlyDictionary<string, Func<HttpResponseMessage>> _routes;

        public RoutingMessageHandler(IReadOnlyDictionary<string, Func<HttpResponseMessage>> routes)
        {
            _routes = routes;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var key = request.RequestUri?.ToString() ?? "";
            if (_routes.TryGetValue(key, out var responseFactory))
                return Task.FromResult(responseFactory());

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("{}"),
            });
        }
    }
}
