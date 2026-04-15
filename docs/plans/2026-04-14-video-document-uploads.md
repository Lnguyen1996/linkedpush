# Video & Document Uploads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add video uploads (mp4/webm/mov, 200MB, 15min) and PDF/PPTX carousel document posts to LinkedPush, with multi-image support (up to 9).

**Architecture:** Extend the Media model with `media_type` and `duration` columns. Add a `post_media` junction table for multi-attachment support. Videos and documents stored on filesystem; images stay in PostgreSQL bytea. LinkedIn publishing gets new methods for video (async polling) and document (native document) post types. PPTX files auto-converted to PDF via LibreOffice headless.

**Tech Stack:** ASP.NET Core (.NET 10), PostgreSQL, React 19, LinkedIn ugcPosts API v2, ffprobe (video duration), LibreOffice headless (PPTX conversion)

**Design doc:** `docs/plans/2026-04-14-video-document-uploads-design.md`

---

### Task 1: Database Model Changes

**Files:**
- Modify: `backend/Models/Media.cs`
- Create: `backend/Models/PostMedia.cs`
- Modify: `backend/Data/AppDbContext.cs`
- Modify: `backend/Models/Post.cs`

**Step 1: Add `media_type` and `duration` to Media model**

In `backend/Models/Media.cs`, add after the `Height` property (line 47):

```csharp
[Column("media_type")]
[Required]
[MaxLength(20)]
public string MediaType { get; set; } = "image";

[Column("duration")]
public int? Duration { get; set; }
```

Also change `Data` from `[Required]` to nullable — videos/documents don't use bytea:

```csharp
[Column("data")]
public byte[]? Data { get; set; }
```

**Step 2: Create PostMedia junction model**

Create `backend/Models/PostMedia.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("post_media")]
public class PostMedia
{
    [Column("post_id")]
    public int PostId { get; set; }

    [Column("media_id")]
    public int MediaId { get; set; }

    [Column("position")]
    public int Position { get; set; }

    [ForeignKey("PostId")]
    public Post Post { get; set; } = null!;

    [ForeignKey("MediaId")]
    public Media Media { get; set; } = null!;
}
```

**Step 3: Add PostMedia DbSet and configure in AppDbContext**

In `backend/Data/AppDbContext.cs`, add DbSet:

```csharp
public DbSet<PostMedia> PostMedia => Set<PostMedia>();
```

Add in `OnModelCreating` after the Analytics config:

```csharp
modelBuilder.Entity<PostMedia>(entity =>
{
    entity.HasKey(pm => new { pm.PostId, pm.MediaId });

    entity.HasOne(pm => pm.Post)
        .WithMany(p => p.PostMedia)
        .HasForeignKey(pm => pm.PostId)
        .OnDelete(DeleteBehavior.Cascade);

    entity.HasOne(pm => pm.Media)
        .WithMany()
        .HasForeignKey(pm => pm.MediaId)
        .OnDelete(DeleteBehavior.Cascade);
});
```

**Step 4: Add PostMedia navigation to Post model**

In `backend/Models/Post.cs`, add after `Analytics` property:

```csharp
public List<PostMedia> PostMedia { get; set; } = new();
```

**Step 5: Drop and recreate database (no migrations)**

```bash
dropdb linkedpush_dev && createdb linkedpush_dev
cd backend && dotnet run
# EnsureCreatedAsync will create all tables with new schema
```

**Step 6: Commit**

```bash
git add backend/Models/Media.cs backend/Models/PostMedia.cs backend/Models/Post.cs backend/Data/AppDbContext.cs
git commit -m "feat: add media_type, duration columns and post_media junction table"
```

---

### Task 2: Update DTOs

**Files:**
- Modify: `backend/DTOs/MediaDtos.cs`
- Modify: `backend/DTOs/PostDtos.cs`

**Step 1: Add media_type and duration to MediaResponseDto**

In `backend/DTOs/MediaDtos.cs`, add:

```csharp
public string MediaType { get; set; } = "image";
public int? Duration { get; set; }
```

**Step 2: Add media_ids to PostCreateDto and PostUpdateDto**

In `backend/DTOs/PostDtos.cs`:

PostCreateDto — add:
```csharp
public List<int>? MediaIds { get; set; }
```

PostUpdateDto — add:
```csharp
public List<int>? MediaIds { get; set; }
```

PostResponseDto — add:
```csharp
public List<MediaAttachmentDto>? Media { get; set; }
```

Add new DTO class:
```csharp
public class MediaAttachmentDto
{
    public int Id { get; set; }
    public string MediaType { get; set; } = "";
    public string Url { get; set; } = "";
    public string MimeType { get; set; } = "";
    public string OriginalFilename { get; set; } = "";
    public int? Width { get; set; }
    public int? Height { get; set; }
    public int? Duration { get; set; }
    public int FileSize { get; set; }
    public int Position { get; set; }
}
```

**Step 3: Commit**

```bash
git add backend/DTOs/
git commit -m "feat: add media_type, duration, media_ids to DTOs"
```

---

### Task 3: Update MediaController for Video & Document Uploads

**Files:**
- Modify: `backend/Controllers/MediaController.cs`

**Step 1: Expand MIME types and size limits**

Replace the static fields at top of class:

```csharp
private static readonly HashSet<string> ImageTypes = new() { "image/jpeg", "image/png", "image/gif" };
private static readonly HashSet<string> VideoTypes = new() { "video/mp4", "video/webm", "video/quicktime" };
private static readonly HashSet<string> DocumentTypes = new() { "application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
private static readonly HashSet<string> AllAllowedTypes = new(ImageTypes.Concat(VideoTypes).Concat(DocumentTypes));

private const int MaxImageSize = 5 * 1024 * 1024;       // 5 MB
private const long MaxVideoSize = 200L * 1024 * 1024;    // 200 MB
private const long MaxDocumentSize = 100L * 1024 * 1024;  // 100 MB
private const int MaxVideoDurationSeconds = 15 * 60;       // 15 min

private readonly IConfiguration _config;
```

Add `IConfiguration config` to constructor and store it.

**Step 2: Add helper to classify media type**

```csharp
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
```

**Step 3: Add video duration helper using ffprobe**

```csharp
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
```

**Step 4: Add PPTX to PDF conversion helper**

```csharp
private static async Task<string?> ConvertPptxToPdfAsync(string pptxPath, CancellationToken ct)
{
    var outDir = Path.GetDirectoryName(pptxPath)!;
    var psi = new System.Diagnostics.ProcessStartInfo
    {
        FileName = "libreoffice",
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
    return File.Exists(pdfPath) ? pdfPath : null;
}
```

**Step 5: Rewrite Upload action**

Replace the entire `Upload` method to handle all three types:
- Images: read into memory, extract dimensions with ImageSharp, store in bytea (existing flow)
- Videos: save to `/data/uploads/videos/{guid}.mp4`, run ffprobe for duration, validate ≤ 15 min
- Documents: save PDF to `/data/uploads/documents/{guid}.pdf`. If PPTX, convert first.

Key validation:
```csharp
if (!AllAllowedTypes.Contains(file.ContentType))
    return BadRequest(new { detail = "Unsupported file type. Allowed: JPEG, PNG, GIF, MP4, WebM, MOV, PDF, PPTX" });

var mediaType = ClassifyMediaType(file.ContentType);
if (file.Length > MaxSizeFor(mediaType))
    return BadRequest(new { detail = $"File exceeds {mediaType} size limit" });
```

For video/document, ensure upload directories exist:
```csharp
var uploadsBase = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "data", "uploads");
```

**Step 6: Update ServeFile to serve from filesystem**

```csharp
[HttpGet("{mediaId:int}/file")]
public async Task<IActionResult> ServeFile(int mediaId)
{
    var media = await _db.Media
        .Where(m => m.Id == mediaId)
        .Select(m => new { m.Data, m.MimeType, m.Filename, m.MediaType, m.FilePath })
        .FirstOrDefaultAsync();

    if (media == null) return NotFound();

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
```

**Step 7: Update ToResponse to include new fields**

```csharp
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
    MediaType = m.MediaType,
    Duration = m.Duration,
    CreatedAt = m.CreatedAt,
};
```

**Step 8: Update DeleteMedia to clean up filesystem**

In the `DeleteMedia` method, before `_db.Media.Remove(item)`:

```csharp
if (!string.IsNullOrEmpty(item.FilePath) && System.IO.File.Exists(item.FilePath))
    System.IO.File.Delete(item.FilePath);
```

**Step 9: Commit**

```bash
git add backend/Controllers/MediaController.cs
git commit -m "feat: support video and document uploads in MediaController"
```

---

### Task 4: Update PostsController for media_ids

**Files:**
- Modify: `backend/Controllers/PostsController.cs`

**Step 1: Update Create action**

After creating the post and saving, if `dto.MediaIds` is provided:

```csharp
if (dto.MediaIds?.Count > 0)
{
    // Validate all media belong to user
    var mediaItems = await _db.Media
        .Where(m => dto.MediaIds.Contains(m.Id) && m.UserId == user.Id)
        .ToListAsync(ct);

    if (mediaItems.Count != dto.MediaIds.Count)
        return BadRequest(new { detail = "One or more media items not found" });

    // Validate no type mixing
    var types = mediaItems.Select(m => m.MediaType).Distinct().ToList();
    if (types.Count > 1)
        return BadRequest(new { detail = "Cannot mix media types in one post" });

    var type = types[0];
    if (type == "image" && mediaItems.Count > 9)
        return BadRequest(new { detail = "Maximum 9 images per post" });
    if (type != "image" && mediaItems.Count > 1)
        return BadRequest(new { detail = $"Only 1 {type} per post" });

    // Also set image_id for backward compat if single image
    if (type == "image" && mediaItems.Count == 1)
        post.ImageId = mediaItems[0].Id;

    for (int i = 0; i < dto.MediaIds.Count; i++)
    {
        _db.PostMedia.Add(new PostMedia
        {
            PostId = post.Id,
            MediaId = dto.MediaIds[i],
            Position = i
        });
    }
    await _db.SaveChangesAsync(ct);
}
else if (dto.ImageId.HasValue)
{
    // Backward compat: single image_id
    post.ImageId = dto.ImageId;
    _db.PostMedia.Add(new PostMedia { PostId = post.Id, MediaId = dto.ImageId.Value, Position = 0 });
    await _db.SaveChangesAsync(ct);
}
```

**Step 2: Update response mapping to include media array**

Add a helper method:

```csharp
private async Task<List<MediaAttachmentDto>> GetPostMediaAsync(int postId, CancellationToken ct)
{
    return await _db.PostMedia
        .Where(pm => pm.PostId == postId)
        .OrderBy(pm => pm.Position)
        .Join(_db.Media, pm => pm.MediaId, m => m.Id, (pm, m) => new MediaAttachmentDto
        {
            Id = m.Id,
            MediaType = m.MediaType,
            Url = $"/api/media/{m.Id}/file",
            MimeType = m.MimeType,
            OriginalFilename = m.OriginalFilename,
            Width = m.Width,
            Height = m.Height,
            Duration = m.Duration,
            FileSize = m.FileSize,
            Position = pm.Position
        })
        .ToListAsync(ct);
}
```

Include `Media = await GetPostMediaAsync(post.Id, ct)` in all PostResponseDto returns.

**Step 3: Update Put/Update to handle media_ids similarly**

Clear existing PostMedia rows, re-add with new media_ids.

**Step 4: Commit**

```bash
git add backend/Controllers/PostsController.cs
git commit -m "feat: support media_ids array in post create/update"
```

---

### Task 5: LinkedIn Publishing — Video & Document

**Files:**
- Modify: `backend/Services/LinkedInService.cs`

**Step 1: Add PublishMultiImagePost method**

Loop through images, upload each, collect asset URNs, publish with multiple media entries.

**Step 2: Add UploadVideo method**

Same register flow as image but with recipe `urn:li:digitalmediaRecipe:feedshare-video`. After upload, poll `GET /v2/assets/{asset}` until processing completes (status = ALLOWED). Timeout after 5 minutes.

**Step 3: Add PublishVideoPost method**

Register + upload + poll + publish with `shareMediaCategory: "VIDEO"`.

**Step 4: Add UploadDocument method**

Recipe: `urn:li:digitalmediaRecipe:feedshare-document`. Same register/upload flow as image.

**Step 5: Add PublishDocumentPost method**

Publish with `shareMediaCategory: "NATIVE_DOCUMENT"`.

**Step 6: Update PublishPost routing**

Replace the simple image/text branch with:

```csharp
var postMedia = await db.PostMedia
    .Where(pm => pm.PostId == post.Id)
    .OrderBy(pm => pm.Position)
    .Include(pm => pm.Media)
    .ToListAsync(ct);

if (postMedia.Count > 0)
{
    var mediaType = postMedia[0].Media.MediaType;
    postUrn = mediaType switch
    {
        "video" => await PublishVideoPost(accessToken, authorUrn, plainText, postMedia[0].Media, ct),
        "document" => await PublishDocumentPost(accessToken, authorUrn, plainText, postMedia[0].Media, ct),
        "image" when postMedia.Count == 1 => await PublishImagePost(accessToken, authorUrn, plainText, GetMediaBytes(postMedia[0].Media), ct),
        "image" => await PublishMultiImagePost(accessToken, authorUrn, plainText, postMedia.Select(pm => GetMediaBytes(pm.Media)).ToList(), ct),
        _ => await PublishTextPost(accessToken, authorUrn, plainText, ct)
    };
}
else if (post.Image != null && post.Image.Data != null && post.Image.Data.Length > 0)
    postUrn = await PublishImagePost(accessToken, authorUrn, plainText, post.Image.Data, ct);
else
    postUrn = await PublishTextPost(accessToken, authorUrn, plainText, ct);
```

Add helper to read bytes from filesystem or bytea:
```csharp
private static byte[] GetMediaBytes(Media m)
{
    if (m.Data != null && m.Data.Length > 0) return m.Data;
    if (!string.IsNullOrEmpty(m.FilePath) && File.Exists(m.FilePath))
        return File.ReadAllBytes(m.FilePath);
    return Array.Empty<byte>();
}
```

**Step 7: Commit**

```bash
git add backend/Services/LinkedInService.cs
git commit -m "feat: add video and document LinkedIn publishing methods"
```

---

### Task 6: Install VPS Dependencies

**Step 1: Install ffmpeg and LibreOffice on VPS**

```bash
ssh root@72.61.9.200 'apt-get update -qq && apt-get install -y -qq ffmpeg libreoffice-core'
```

**Step 2: Create upload directories**

```bash
ssh root@72.61.9.200 'mkdir -p /opt/linkedpush/data/uploads/videos /opt/linkedpush/data/uploads/documents && chown -R www-data:www-data /opt/linkedpush/data'
```

**Step 3: Commit** (nothing to commit, VPS-only)

---

### Task 7: Frontend — Compose Page Media Attachment

**Files:**
- Modify: `frontend/src/pages/Compose.jsx`

**Step 1: Replace single image picker with media type tabs**

Add state:
```jsx
const [mediaType, setMediaType] = useState(null) // 'image' | 'video' | 'document'
const [mediaIds, setMediaIds] = useState([])
const [mediaItems, setMediaItems] = useState([]) // full objects with url, type
const [uploadProgress, setUploadProgress] = useState(0)
```

Add media attachment bar with 3 buttons (Image, Video, Document). Switching type clears existing attachments.

**Step 2: Multi-image support**

Image mode: file input with `multiple` + `accept="image/*"`. Upload each, add to `mediaIds` array. Show thumbnail strip. Max 9.

**Step 3: Video upload with progress**

Video mode: single file input `accept="video/mp4,video/webm,video/quicktime"`. Use XMLHttpRequest for upload progress. Show progress bar and duration after upload.

**Step 4: Document upload**

Document mode: `accept=".pdf,.pptx"`. Show filename and "(converting...)" if PPTX. Show page count badge if available.

**Step 5: Update save/publish to send media_ids**

Replace `image_id: imageId` with `media_ids: mediaIds` in the POST/PUT body.

**Step 6: Update LinkedIn Preview sidebar**

- Multi-image: thumbnail grid
- Video: video thumbnail with play overlay
- Document: "Carousel - PDF" indicator

**Step 7: Commit**

```bash
git add frontend/src/pages/Compose.jsx
git commit -m "feat: add video and document upload support to compose page"
```

---

### Task 8: Frontend — Media Library Updates

**Files:**
- Modify: `frontend/src/pages/MediaLibrary.jsx`

**Step 1: Add filter tabs**

Add `mediaFilter` state. Filter tabs: All | Images | Videos | Documents. Pass `?type=video` param to API (add backend support for filtering by type).

**Step 2: Video thumbnails**

Show play icon overlay and duration badge on video items in the grid.

**Step 3: Document thumbnails**

Show PDF icon with filename for document items.

**Step 4: Preview modal updates**

- Video: render `<video>` player with controls
- Document: render `<iframe>` or `<object>` for PDF preview

**Step 5: Commit**

```bash
git add frontend/src/pages/MediaLibrary.jsx
git commit -m "feat: add video/document support to media library"
```

---

### Task 9: Frontend — Dashboard Post Type Icons

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

**Step 1: Show media type icon in post list**

In the post list items, check `post.media` array to determine type. Show Video/FileText/Image icon accordingly.

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: show media type icon in dashboard post list"
```

---

### Task 10: Deploy & Test

**Step 1: Reset prod database**

Since we use EnsureCreatedAsync (no migrations), the prod database needs to be recreated:

```bash
ssh root@72.61.9.200 'sudo -u postgres psql -c "DROP DATABASE linkedpush_prod;" && sudo -u postgres psql -c "CREATE DATABASE linkedpush_prod OWNER lamnguyen;"'
```

**Step 2: Deploy**

Use `/deploy` skill — full deploy (rsync, build backend, build frontend, restart, health check).

**Step 3: Test upload flows**

- Upload a JPEG → verify image shows in library
- Upload an MP4 → verify video plays in preview, duration shown
- Upload a PPTX → verify conversion to PDF, carousel preview
- Create post with 3 images → verify multi-image in LinkedIn preview
- Create post with video → verify video attachment
- Schedule a post with document → verify it publishes as carousel

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: post-deploy fixes for video/document uploads"
```
