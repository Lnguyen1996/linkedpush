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
    private static readonly HashSet<string> ImageTypes = new() { "image/jpeg", "image/png", "image/gif" };
    private static readonly HashSet<string> VideoTypes = new() { "video/mp4", "video/webm", "video/quicktime" };
    private static readonly HashSet<string> DocumentTypes = new() { "application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    private static readonly HashSet<string> AllAllowedTypes = new(ImageTypes.Concat(VideoTypes).Concat(DocumentTypes));

    private const int MaxImageSize = 5 * 1024 * 1024;        // 5 MB
    private const long MaxVideoSize = 200L * 1024 * 1024;     // 200 MB
    private const long MaxDocumentSize = 100L * 1024 * 1024;   // 100 MB
    private const int MaxVideoDurationSeconds = 15 * 60;        // 15 min

    private readonly AppDbContext _db;
    private readonly SessionService _session;
    private readonly IConfiguration _config;

    public MediaController(AppDbContext db, SessionService session, IConfiguration config)
    {
        _db = db;
        _session = session;
        _config = config;
    }

    private static string ClassifyMediaType(string contentType) =>
        ImageTypes.Contains(contentType) ? "image" :
        VideoTypes.Contains(contentType) ? "video" :
        DocumentTypes.Contains(contentType) ? "document" : "image";

    private static long MaxSizeFor(string mediaType) => mediaType switch
    {
        "video" => MaxVideoSize,
        "document" => MaxDocumentSize,
        _ => MaxImageSize
    };

    private static async Task<int?> GetVideoDurationAsync(string filePath, CancellationToken ct)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "ffprobe",
                Arguments = $"-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 \"{filePath}\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = System.Diagnostics.Process.Start(psi)!;
            var output = await proc.StandardOutput.ReadToEndAsync(ct);
            await proc.WaitForExitAsync(ct);
            if (double.TryParse(output.Trim(), System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var seconds))
                return (int)Math.Ceiling(seconds);
        }
        catch { }
        return null;
    }

    private static async Task<string?> ConvertPptxToPdfAsync(string pptxPath, CancellationToken ct)
    {
        var outDir = Path.GetDirectoryName(pptxPath)!;
        var candidates = new[] { "/opt/homebrew/bin/soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/bin/libreoffice", "/usr/local/bin/libreoffice" };
        var binary = candidates.FirstOrDefault(System.IO.File.Exists) ?? "libreoffice";
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = binary,
            Arguments = $"--headless --convert-to pdf --outdir \"{outDir}\" \"{pptxPath}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = System.Diagnostics.Process.Start(psi)!;
        await proc.WaitForExitAsync(ct);
        if (proc.ExitCode != 0) return null;
        var pdfPath = Path.ChangeExtension(pptxPath, ".pdf");
        return System.IO.File.Exists(pdfPath) ? pdfPath : null;
    }

    private static MediaResponseDto ToResponse(Media m) => new()
    {
        Id = m.Id,
        Filename = m.Filename,
        OriginalFilename = m.OriginalFilename,
        Url = $"/api/media/{m.Id}/file?v={m.Filename}",
        FileSize = m.FileSize,
        MimeType = m.MimeType,
        Width = m.Width,
        Height = m.Height,
        MediaType = m.MediaType,
        Duration = m.Duration,
        CreatedAt = m.CreatedAt,
    };

    [HttpPost("")]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        if (!AllAllowedTypes.Contains(file.ContentType))
            return BadRequest(new { detail = "Unsupported file type. Allowed: JPEG, PNG, GIF, MP4, WebM, MOV, PDF, PPTX" });

        var mediaType = ClassifyMediaType(file.ContentType);
        if (file.Length > MaxSizeFor(mediaType))
            return BadRequest(new { detail = $"File exceeds {mediaType} size limit" });

        var uploadsBase = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "data", "uploads");

        if (mediaType == "image")
        {
            // Images: read into memory, extract dimensions, store in bytea
            byte[] data;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms, ct);
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
                MediaType = "image",
            };
            _db.Media.Add(media);
            await _db.SaveChangesAsync(ct);
            return StatusCode(201, ToResponse(media));
        }
        else if (mediaType == "video")
        {
            // Videos: save to filesystem, get duration via ffprobe
            var videoDir = Path.Combine(uploadsBase, "videos");
            Directory.CreateDirectory(videoDir);

            var ext = Path.GetExtension(file.FileName).TrimStart('.');
            if (string.IsNullOrEmpty(ext)) ext = "mp4";
            var filename = $"{Guid.NewGuid():N}.{ext}";
            var filePath = Path.Combine(videoDir, filename);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream, ct);
            }

            var duration = await GetVideoDurationAsync(filePath, ct);
            if (duration.HasValue && duration.Value > MaxVideoDurationSeconds)
            {
                System.IO.File.Delete(filePath);
                return BadRequest(new { detail = $"Video exceeds maximum duration of {MaxVideoDurationSeconds / 60} minutes" });
            }

            var media = new Media
            {
                UserId = user.Id,
                Filename = filename,
                OriginalFilename = file.FileName,
                FilePath = filePath,
                FileSize = (int)file.Length,
                MimeType = file.ContentType,
                MediaType = "video",
                Duration = duration,
            };
            _db.Media.Add(media);
            await _db.SaveChangesAsync(ct);
            return StatusCode(201, ToResponse(media));
        }
        else // document
        {
            var docDir = Path.Combine(uploadsBase, "documents");
            Directory.CreateDirectory(docDir);

            var guid = Guid.NewGuid().ToString("N");
            string filePath;
            string mimeType = "application/pdf";

            if (file.ContentType == "application/vnd.openxmlformats-officedocument.presentationml.presentation")
            {
                // PPTX: save temp, convert to PDF
                var tempPath = Path.Combine(docDir, $"{guid}.pptx");
                await using (var stream = new FileStream(tempPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream, ct);
                }

                var pdfPath = await ConvertPptxToPdfAsync(tempPath, ct);
                if (pdfPath == null)
                {
                    System.IO.File.Delete(tempPath);
                    return StatusCode(500, new { detail = "PPTX to PDF conversion failed" });
                }

                // Clean up original PPTX
                System.IO.File.Delete(tempPath);
                filePath = pdfPath;
            }
            else
            {
                // PDF: save directly
                filePath = Path.Combine(docDir, $"{guid}.pdf");
                await using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream, ct);
                }
            }

            var fileInfo = new FileInfo(filePath);
            var media = new Media
            {
                UserId = user.Id,
                Filename = $"{guid}.pdf",
                OriginalFilename = file.FileName,
                FilePath = filePath,
                FileSize = (int)fileInfo.Length,
                MimeType = mimeType,
                MediaType = "document",
            };
            _db.Media.Add(media);
            await _db.SaveChangesAsync(ct);
            return StatusCode(201, ToResponse(media));
        }
    }

    /// <summary>Replace image bytes in-place (same id). Used after client-side crop/resize.</summary>
    [HttpPut("{mediaId:int}")]
    public async Task<IActionResult> ReplaceMedia(int mediaId, IFormFile file)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var item = await _db.Media.FirstOrDefaultAsync(m => m.Id == mediaId && m.UserId == user.Id);
        if (item == null)
            return NotFound(new { detail = "Media not found" });

        if (!ImageTypes.Contains(file.ContentType))
            return BadRequest(new { detail = "Only JPEG, PNG, and GIF files are allowed for replacement" });

        if (file.Length > MaxImageSize)
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
                Width = m.Width, Height = m.Height, MediaType = m.MediaType,
                Duration = m.Duration, CreatedAt = m.CreatedAt,
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
            .Select(m => new { m.Data, m.MimeType, m.Filename, m.MediaType, m.FilePath })
            .FirstOrDefaultAsync();

        if (media == null)
            return NotFound();

        var etag = $"\"{mediaId}-{media.Filename}\"";

        if (Request.Headers.IfNoneMatch.Contains(etag))
            return StatusCode(304);

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        Response.Headers.ETag = etag;

        // Filesystem-backed (video/document)
        if (media.MediaType != "image" && !string.IsNullOrEmpty(media.FilePath) && System.IO.File.Exists(media.FilePath))
            return PhysicalFile(media.FilePath, media.MimeType, enableRangeProcessing: true);

        // bytea-backed (image)
        if (media.Data != null && media.Data.Length > 0)
            return File(media.Data, media.MimeType, enableRangeProcessing: false);

        return NotFound();
    }

    [HttpDelete("{mediaId:int}")]
    public async Task<IActionResult> DeleteMedia(int mediaId)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var item = await _db.Media.FirstOrDefaultAsync(m => m.Id == mediaId && m.UserId == user.Id);
        if (item == null)
            return NotFound(new { detail = "Media not found" });

        // Clean up filesystem file if present
        if (!string.IsNullOrEmpty(item.FilePath) && System.IO.File.Exists(item.FilePath))
            System.IO.File.Delete(item.FilePath);

        _db.Media.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
