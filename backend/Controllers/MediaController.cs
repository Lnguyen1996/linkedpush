using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.DTOs;
using LinkedPushApi.Models;
using LinkedPushApi.Services;
using SixLabors.ImageSharp;

namespace LinkedPushApi.Controllers;

[ApiController]
[Route("api/media")]
public class MediaController : ControllerBase
{
    private static readonly HashSet<string> AllowedTypes = new() { "image/jpeg", "image/png", "image/gif" };
    private const int MaxSize = 5 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly SessionService _session;

    public MediaController(AppDbContext db, SessionService session)
    {
        _db = db;
        _session = session;
    }

    private static MediaResponseDto ToResponse(Media m) => new()
    {
        Id = m.Id,
        Filename = m.Filename,
        OriginalFilename = m.OriginalFilename,
        Url = $"/api/media/{m.Id}/file",
        FileSize = m.FileSize,
        MimeType = m.MimeType,
        Width = m.Width,
        Height = m.Height,
        CreatedAt = m.CreatedAt,
    };

    [HttpPost("")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        if (!AllowedTypes.Contains(file.ContentType))
            return BadRequest(new { detail = "Only JPEG, PNG, and GIF files are allowed" });

        if (file.Length > MaxSize)
            return BadRequest(new { detail = "File size exceeds 5MB limit" });

        byte[] data;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            data = ms.ToArray();
        }

        int? width = null, height = null;
        try
        {
            using var image = Image.Load(data);
            width = image.Width;
            height = image.Height;
        }
        catch { }

        var ext = Path.GetExtension(file.FileName).TrimStart('.');
        if (string.IsNullOrEmpty(ext)) ext = "jpg";

        var media = new Media
        {
            UserId = user.Id,
            Filename = $"{Guid.NewGuid():N}.{ext}",
            OriginalFilename = file.FileName,
            FileSize = (int)file.Length,
            MimeType = file.ContentType,
            Width = width,
            Height = height,
            Data = data,
        };
        _db.Media.Add(media);
        await _db.SaveChangesAsync();

        return StatusCode(201, ToResponse(media));
    }

    /// <summary>Replace image bytes in-place (same id). Used after client-side crop/resize.</summary>
    [HttpPut("{mediaId:int}")]
    public async Task<IActionResult> ReplaceMedia(int mediaId, IFormFile file)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var item = await _db.Media.FirstOrDefaultAsync(m => m.Id == mediaId && m.UserId == user.Id);
        if (item == null)
            return NotFound(new { detail = "Media not found" });

        if (!AllowedTypes.Contains(file.ContentType))
            return BadRequest(new { detail = "Only JPEG, PNG, and GIF files are allowed" });

        if (file.Length > MaxSize)
            return BadRequest(new { detail = "File size exceeds 5MB limit" });

        byte[] data;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            data = ms.ToArray();
        }

        int? width = null, height = null;
        try
        {
            using var image = Image.Load(data);
            width = image.Width;
            height = image.Height;
        }
        catch { }

        var ext = Path.GetExtension(file.FileName).TrimStart('.');
        if (string.IsNullOrEmpty(ext))
            ext = Path.GetExtension(item.Filename).TrimStart('.');
        if (string.IsNullOrEmpty(ext))
            ext = "jpg";

        item.Filename = $"{Guid.NewGuid():N}.{ext}";
        item.FileSize = data.Length;
        item.MimeType = file.ContentType;
        item.Width = width;
        item.Height = height;
        item.Data = data;

        await _db.SaveChangesAsync();
        return Ok(ToResponse(item));
    }

    [HttpGet("")]
    public async Task<IActionResult> ListMedia()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var items = await _db.Media
            .Where(m => m.UserId == user.Id)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new Media
            {
                Id = m.Id, Filename = m.Filename, OriginalFilename = m.OriginalFilename,
                FileSize = m.FileSize, MimeType = m.MimeType,
                Width = m.Width, Height = m.Height, CreatedAt = m.CreatedAt,
            })
            .ToListAsync();
        return Ok(items.Select(ToResponse));
    }

    [HttpGet("{mediaId:int}")]
    public async Task<IActionResult> GetMedia(int mediaId)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var item = await _db.Media.FirstOrDefaultAsync(m => m.Id == mediaId && m.UserId == user.Id);
        if (item == null)
            return NotFound(new { detail = "Media not found" });
        return Ok(ToResponse(item));
    }

    [HttpGet("{mediaId:int}/file")]
    public async Task<IActionResult> ServeFile(int mediaId)
    {
        var media = await _db.Media
            .Where(m => m.Id == mediaId)
            .Select(m => new { m.Data, m.MimeType, m.Filename })
            .FirstOrDefaultAsync();

        if (media == null || media.Data.Length == 0)
            return NotFound();

        var etag = $"\"{mediaId}-{media.Filename}\"";

        if (Request.Headers.IfNoneMatch.Contains(etag))
            return StatusCode(304);

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        Response.Headers.ETag = etag;

        return File(media.Data, media.MimeType, enableRangeProcessing: false);
    }

    [HttpDelete("{mediaId:int}")]
    public async Task<IActionResult> DeleteMedia(int mediaId)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var item = await _db.Media.FirstOrDefaultAsync(m => m.Id == mediaId && m.UserId == user.Id);
        if (item == null)
            return NotFound(new { detail = "Media not found" });

        _db.Media.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
