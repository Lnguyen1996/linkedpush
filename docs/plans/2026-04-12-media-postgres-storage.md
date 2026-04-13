# Media PostgreSQL Storage Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate image storage from local filesystem (`data/uploads/`) to PostgreSQL `bytea` column, with CDN-friendly cache headers.

**Architecture:** Images stored as `bytea` in the existing `media` table. New `GET /api/media/{id}/file` endpoint serves binary with aggressive cache headers for Cloudflare CDN. Upload writes to DB instead of disk. LinkedIn publishing reads bytes from DB instead of filesystem.

**Tech Stack:** ASP.NET Core (.NET 10), PostgreSQL (Npgsql), SixLabors.ImageSharp, React 19

**Design doc:** `docs/plans/2026-04-12-media-postgres-storage-design.md`

---

### Task 1: Add bytea column to Media model

**Files:**
- Modify: `backend/Models/Media.cs`

**Step 1: Add Data property and make FilePath nullable**

```csharp
// Add after the FilePath property (line 29):

[Column("data")]
[Required]
public byte[] Data { get; set; } = Array.Empty<byte>();
```

Change `FilePath` from `[Required]` to nullable:
```csharp
[Column("file_path")]
[MaxLength(500)]
public string? FilePath { get; set; }
```

**Step 2: Update MediaResponseDto to include a URL field instead of FilePath**

In `backend/DTOs/MediaDtos.cs`, replace `FilePath` with `Url`:
```csharp
public class MediaResponseDto
{
    public int Id { get; set; }
    public string Filename { get; set; } = "";
    public string OriginalFilename { get; set; } = "";
    public string Url { get; set; } = "";  // was FilePath
    public int FileSize { get; set; }
    public string MimeType { get; set; } = "";
    public int? Width { get; set; }
    public int? Height { get; set; }
    public DateTime? CreatedAt { get; set; }
}
```

**Step 3: Verify it compiles**

Run: `cd backend && dotnet build`
Expected: Build succeeded (will fail at runtime until DB is recreated — that's fine)

**Step 4: Commit**

```
feat: add bytea Data column to Media model
```

---

### Task 2: Update MediaController — upload to DB + serve endpoint

**Files:**
- Modify: `backend/Controllers/MediaController.cs`

**Step 1: Update ToResponse to use URL**

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
    CreatedAt = m.CreatedAt,
};
```

**Step 2: Rewrite Upload to store bytes in DB**

Replace the Upload method body. Key changes:
- Read `IFormFile` into a `byte[]` via `MemoryStream`
- Extract dimensions from the in-memory bytes
- Store bytes in `media.Data`
- Remove all filesystem writes (`Directory.CreateDirectory`, `FileStream`)

```csharp
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
```

**Step 3: Add the file-serving endpoint**

Add after the `GetMedia` method:

```csharp
[HttpGet("{mediaId:int}/file")]
[AllowAnonymous]  // Served publicly, cached by CDN
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
```

**Step 4: Remove UploadDir constant and AllowedTypes/MaxSize stay**

Remove: `private const string UploadDir = "data/uploads";`

**Step 5: Update ListMedia to exclude Data from query (performance)**

```csharp
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
```

**Step 6: Update DeleteMedia — remove filesystem delete**

Remove these lines from DeleteMedia:
```csharp
if (System.IO.File.Exists(item.FilePath))
    System.IO.File.Delete(item.FilePath);
```

**Step 7: Verify it compiles**

Run: `cd backend && dotnet build`

**Step 8: Commit**

```
feat: MediaController — upload to DB, serve from bytea, CDN cache headers
```

---

### Task 3: Update PostsController image URL

**Files:**
- Modify: `backend/Controllers/PostsController.cs`

**Step 1: Change ToResponse ImageUrl**

Find the `ToResponse` helper (around line 41). Change:
```csharp
ImageUrl = post.Image != null ? $"/uploads/{post.Image.Filename}" : null,
```
To:
```csharp
ImageUrl = post.Image != null ? $"/api/media/{post.Image.Id}/file" : null,
```

**Step 2: Verify it compiles**

Run: `cd backend && dotnet build`

**Step 3: Commit**

```
fix: PostsController image URL points to new media endpoint
```

---

### Task 4: Update LinkedInService — accept byte[] instead of file path

**Files:**
- Modify: `backend/Services/LinkedInService.cs`

**Step 1: Change UploadImage signature**

From:
```csharp
public async Task<string> UploadImage(string accessToken, string authorUrn, string imagePath, CancellationToken ct = default)
```
To:
```csharp
public async Task<string> UploadImage(string accessToken, string authorUrn, byte[] imageData, CancellationToken ct = default)
```

Remove the `File.ReadAllBytesAsync` line and use `imageData` directly.

**Step 2: Change PublishImagePost signature**

From:
```csharp
public async Task<string> PublishImagePost(string accessToken, string authorUrn, string text, string imagePath, CancellationToken ct = default)
```
To:
```csharp
public async Task<string> PublishImagePost(string accessToken, string authorUrn, string text, byte[] imageData, CancellationToken ct = default)
```

Update the call: `var asset = await UploadImage(accessToken, authorUrn, imageData, ct);`

**Step 3: Update PublishPost to load image bytes from DB**

Change:
```csharp
if (post.Image != null && File.Exists(post.Image.FilePath))
    postUrn = await PublishImagePost(accessToken, authorUrn, plainText, post.Image.FilePath, ct);
```
To:
```csharp
if (post.Image != null && post.Image.Data.Length > 0)
    postUrn = await PublishImagePost(accessToken, authorUrn, plainText, post.Image.Data, ct);
```

**Step 4: Verify it compiles**

Run: `cd backend && dotnet build`

**Step 5: Commit**

```
refactor: LinkedInService reads image bytes from DB instead of filesystem
```

---

### Task 5: Clean up Program.cs

**Files:**
- Modify: `backend/Program.cs`

**Step 1: Remove static file serving for uploads**

Remove (around lines 50-61):
```csharp
Directory.CreateDirectory("data/uploads");
```
and:
```csharp
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "data", "uploads")),
    RequestPath = "/uploads"
});
```

**Step 2: Verify it compiles**

Run: `cd backend && dotnet build`

**Step 3: Commit**

```
chore: remove filesystem upload directory and static file serving
```

---

### Task 6: Update frontend — use /api/media/{id}/file URLs

**Files:**
- Modify: `frontend/src/pages/Compose.jsx`
- Modify: `frontend/src/pages/MediaLibrary.jsx`
- Modify: `frontend/vite.config.js`

**Step 1: Update Compose.jsx**

Three places use `/uploads/${...}`:

Line ~117 (after upload):
```javascript
setImageUrl(`/uploads/${media.filename}`)
```
Change to:
```javascript
setImageUrl(media.url)
```

Line ~139 (select from library):
```javascript
setImageUrl(`/uploads/${item.filename}`)
```
Change to:
```javascript
setImageUrl(`/api/media/${item.id}/file`)
```

Line ~583 (media picker thumbnail):
```javascript
src={`/uploads/${item.filename}`}
```
Change to:
```javascript
src={`/api/media/${item.id}/file`}
```

**Step 2: Update MediaLibrary.jsx**

Five places use `/uploads/${...}` (lines ~163, ~205, ~232, ~266, ~288).

Replace all instances of:
```javascript
`/uploads/${item.filename}`
```
or:
```javascript
`/uploads/${selected.filename}`
```
With:
```javascript
`/api/media/${item.id}/file`
```
or:
```javascript
`/api/media/${selected.id}/file`
```

For the clipboard copy lines (~232, ~288), copy the full URL:
```javascript
navigator.clipboard.writeText(`${window.location.origin}/api/media/${selected.id}/file`)
```

**Step 3: Remove /uploads proxy from vite.config.js**

Remove:
```javascript
'/uploads': {
  target: 'http://localhost:8000',
  changeOrigin: true,
},
```

**Step 4: Verify frontend compiles**

Run: `cd frontend && npm run build`

**Step 5: Commit**

```
feat: frontend uses /api/media/{id}/file URLs instead of /uploads/
```

---

### Task 7: Recreate database and test end-to-end

**Step 1: Drop and recreate database**

Since LinkedPush uses `EnsureCreatedAsync()` (no migrations), drop and recreate:
```bash
dropdb postiz_dev && createdb postiz_dev
```

**Step 2: Start backend and frontend**

```bash
cd backend && dotnet run &
cd frontend && npm run dev &
```

**Step 3: Test upload flow**

- Log in via dev-login
- Go to Media Library
- Upload an image
- Verify it appears in the grid
- Open the image in a new tab — URL should be `/api/media/{id}/file`
- Check response headers: `Cache-Control: public, max-age=31536000, immutable` and `ETag` present

**Step 4: Test compose flow**

- Create a new post
- Attach an image (upload or pick from library)
- Verify image preview shows in the editor
- Save as draft
- Open the post review page — verify image renders

**Step 5: Test publish flow (dev mode)**

- Publish the post
- Verify no errors

**Step 6: Commit any fixes**

---

### Task 8: Update Docker and docs

**Files:**
- Modify: `docker-compose.yml`
- Modify: `CLAUDE.md`

**Step 1: Remove uploads volume from docker-compose.yml**

Remove the `uploads` named volume from the `backend` service volumes and from the `volumes:` section.

**Step 2: Update CLAUDE.md**

Update the media-related documentation:
- Change "Uploads (./data/uploads/)" to "Images stored in PostgreSQL bytea"
- Update the image upload description
- Note the new serving endpoint

**Step 3: Commit**

```
chore: remove uploads volume from Docker, update docs for bytea storage
```
