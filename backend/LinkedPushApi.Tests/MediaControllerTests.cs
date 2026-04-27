using System.Reflection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using LinkedPushApi.Controllers;
using LinkedPushApi.Data;
using LinkedPushApi.Models;
using LinkedPushApi.Services;
using Xunit;

namespace LinkedPushApi.Tests;

public class MediaControllerTests
{
    [Fact]
    public async Task Upload_rejects_image_that_cannot_be_decoded()
    {
        var dbName = Guid.NewGuid().ToString("n");
        var uploadRoot = Path.Combine(Path.GetTempPath(), $"linkedpush-media-tests-{Guid.NewGuid():N}");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var user = new User { LinkedInId = "media-image", Name = "Media Image" };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
        }
        var controller = CreateController(dbName, userId, uploadRoot);
        var file = CreateFormFile("bad.png", "image/png", new byte[] { 0x89, 0x50, 0x4e, 0x47 });

        var result = await controller.Upload(file, CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("valid image", GetAnonymousStringProperty(badRequest.Value, "detail"));
    }

    [Fact]
    public async Task Upload_rejects_pdf_without_page_contents()
    {
        var dbName = Guid.NewGuid().ToString("n");
        var uploadRoot = Path.Combine(Path.GetTempPath(), $"linkedpush-media-tests-{Guid.NewGuid():N}");
        int userId;
        using (var db = CreateDb(dbName))
        {
            var user = new User { LinkedInId = "media-pdf", Name = "Media Pdf" };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
        }
        var controller = CreateController(dbName, userId, uploadRoot);
        var pdfWithoutContents = """
            %PDF-1.4
            1 0 obj
            <</Type/Catalog/Pages 2 0 R>>
            endobj
            2 0 obj
            <</Type/Pages/Kids[3 0 R]/Count 1>>
            endobj
            3 0 obj
            <</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>
            endobj
            %%EOF
            """u8.ToArray();
        var file = CreateFormFile("empty.pdf", "application/pdf", pdfWithoutContents);

        var result = await controller.Upload(file, CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("empty", GetAnonymousStringProperty(badRequest.Value, "detail"));
    }

    private static MediaController CreateController(string databaseName, int userId, string uploadRoot)
    {
        var values = new Dictionary<string, string?>
        {
            ["SecretKey"] = "test-secret-key-which-is-32-bytes-min",
            ["DevMode"] = "true",
            ["COOKIE_SECURE"] = "false",
            ["UploadsPath"] = uploadRoot,
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var db = CreateDb(databaseName);
        var jwt = new JwtService(config);
        var session = new SessionService(config, jwt);
        var controller = new MediaController(db, session, config)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };
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

    private static IFormFile CreateFormFile(string filename, string contentType, byte[] data)
    {
        var stream = new MemoryStream(data);
        return new FormFile(stream, 0, data.Length, "file", filename)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };
    }

    private static string GetAnonymousStringProperty(object? value, string propertyName)
    {
        Assert.NotNull(value);
        var prop = value.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(prop);
        return Assert.IsType<string>(prop.GetValue(value));
    }
}
