using System.Net;
using System.Reflection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using LinkedPushApi.Controllers;
using LinkedPushApi.Data;
using LinkedPushApi.Services;
using Xunit;

namespace LinkedPushApi.Tests;

public class AuthControllerTests
{
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

    private static AuthController CreateController(string databaseName)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SecretKey"] = "test-secret",
                ["LinkedIn:ClientId"] = "client-id",
                ["LinkedIn:ClientSecret"] = "client-secret",
                ["LinkedIn:RedirectUri"] = "http://localhost:8000/api/auth/callback",
                ["FrontendUrl"] = "http://localhost:5173",
            })
            .Build();

        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options);
        db.Database.EnsureCreated();
        var controller = new AuthController(db, new SessionService(config), config, new StubHttpClientFactory());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        return controller;
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
}
