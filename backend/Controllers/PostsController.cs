using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LinkedPushApi.Data;
using LinkedPushApi.DTOs;
using LinkedPushApi.Models;
using LinkedPushApi.Services;

namespace LinkedPushApi.Controllers;

[ApiController]
[Route("api/posts")]
public class PostsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SessionService _session;
    private readonly LinkedInService _linkedIn;

    public PostsController(AppDbContext db, SessionService session, LinkedInService linkedIn)
    {
        _db = db;
        _session = session;
        _linkedIn = linkedIn;
    }

    private async Task<List<MediaAttachmentDto>> GetPostMediaAsync(int postId, CancellationToken ct = default)
    {
        return await _db.PostMedia
            .Where(pm => pm.PostId == postId)
            .OrderBy(pm => pm.Position)
            .Join(_db.Media, pm => pm.MediaId, m => m.Id, (pm, m) => new MediaAttachmentDto
            {
                Id = m.Id,
                MediaType = m.MediaType,
                Url = $"/api/media/{m.Id}/file?v={m.Filename}",
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

    private async Task<PostResponseDto> ToResponseAsync(Post post, CancellationToken ct = default)
    {
        return new PostResponseDto
        {
            Id = post.Id,
            UserId = post.UserId,
            Title = post.Title,
            Content = post.Content,
            Status = post.Status,
            ScheduledAt = post.ScheduledAt,
            Timezone = post.Timezone,
            PublishedAt = post.PublishedAt,
            LinkedinPostId = post.LinkedInPostId,
            ErrorMessage = post.ErrorMessage,
            ImageId = post.ImageId,
            FirstComment = post.FirstComment?.Content,
            ImageUrl = post.Image != null ? $"/api/media/{post.Image.Id}/file?v={post.Image.Filename}" : null,
            Media = await GetPostMediaAsync(post.Id, ct),
            CreatedAt = post.CreatedAt,
            UpdatedAt = post.UpdatedAt,
        };
    }

    [HttpPost("")]
    public async Task<IActionResult> CreatePost([FromBody] PostCreateDto data, CancellationToken ct)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var post = new Post
        {
            UserId = user.Id,
            Title = data.Title,
            Content = data.Content,
            ScheduledAt = data.ScheduledAt,
            Timezone = data.Timezone,
            Status = data.Status,
        };
        _db.Posts.Add(post);
        await _db.SaveChangesAsync(ct);

        if (!string.IsNullOrEmpty(data.FirstComment))
        {
            var comment = new Comment { PostId = post.Id, Content = data.FirstComment };
            _db.Comments.Add(comment);
            await _db.SaveChangesAsync(ct);
        }

        // Handle media_ids (new multi-attachment flow)
        if (data.MediaIds?.Count > 0)
        {
            var mediaItems = await _db.Media
                .Where(m => data.MediaIds.Contains(m.Id) && m.UserId == user.Id)
                .ToListAsync(ct);

            if (mediaItems.Count != data.MediaIds.Count)
                return BadRequest(new { detail = "One or more media items not found" });

            var types = mediaItems.Select(m => m.MediaType).Distinct().ToList();
            if (types.Count > 1)
                return BadRequest(new { detail = "Cannot mix media types in one post" });

            var type = types[0];
            if (type == "image" && mediaItems.Count > 9)
                return BadRequest(new { detail = "Maximum 9 images per post" });
            if (type != "image" && mediaItems.Count > 1)
                return BadRequest(new { detail = $"Only 1 {type} per post" });

            // Backward compat: set image_id for single image
            if (type == "image" && mediaItems.Count == 1)
                post.ImageId = mediaItems[0].Id;

            for (int i = 0; i < data.MediaIds.Count; i++)
            {
                _db.PostMedia.Add(new PostMedia
                {
                    PostId = post.Id,
                    MediaId = data.MediaIds[i],
                    Position = i
                });
            }
            await _db.SaveChangesAsync(ct);
        }
        else if (data.ImageId.HasValue)
        {
            // Backward compat: single image_id
            post.ImageId = data.ImageId;
            _db.PostMedia.Add(new PostMedia { PostId = post.Id, MediaId = data.ImageId.Value, Position = 0 });
            await _db.SaveChangesAsync(ct);
        }

        // Reload with relationships
        var loaded = await _db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .FirstAsync(p => p.Id == post.Id, ct);
        return StatusCode(201, await ToResponseAsync(loaded, ct));
    }

    [HttpGet("")]
    public async Task<IActionResult> ListPosts(
        [FromQuery] int page = 1,
        [FromQuery] int per_page = 10,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        if (page < 1) page = 1;
        if (per_page < 1) per_page = 1;
        if (per_page > 100) per_page = 100;

        var query = _db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .Where(p => p.UserId == user.Id);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(p => p.Status == status);

        var total = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)per_page));
        var posts = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * per_page)
            .Take(per_page)
            .ToListAsync(ct);

        var postDtos = new List<PostResponseDto>();
        foreach (var p in posts)
            postDtos.Add(await ToResponseAsync(p, ct));

        return Ok(new PostListDto
        {
            Posts = postDtos,
            Total = total,
            Page = page,
            PerPage = per_page,
            TotalPages = totalPages,
        });
    }

    [HttpGet("{postId:int}")]
    public async Task<IActionResult> GetPost(int postId, CancellationToken ct)
    {
        await _session.RequireCurrentUser(HttpContext, _db);
        var post = await _db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .FirstOrDefaultAsync(p => p.Id == postId, ct);
        if (post == null)
            return NotFound(new { detail = "Post not found" });
        return Ok(await ToResponseAsync(post, ct));
    }

    [HttpPut("{postId:int}")]
    public async Task<IActionResult> UpdatePost(int postId, [FromBody] PostUpdateDto data, CancellationToken ct)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var post = await _db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .FirstOrDefaultAsync(p => p.Id == postId, ct);
        if (post == null)
            return NotFound(new { detail = "Post not found" });

        if (data.Title != null) post.Title = data.Title;
        if (data.Content != null) post.Content = data.Content;
        if (data.ScheduledAt.HasValue) post.ScheduledAt = data.ScheduledAt;
        if (data.Timezone != null) post.Timezone = data.Timezone;
        if (data.Status != null) post.Status = data.Status;
        post.UpdatedAt = DateTime.UtcNow;

        if (data.FirstComment != null)
        {
            if (post.FirstComment != null)
                post.FirstComment.Content = data.FirstComment;
            else
            {
                var comment = new Comment { PostId = post.Id, Content = data.FirstComment };
                _db.Comments.Add(comment);
            }
        }

        // Handle media_ids update
        if (data.MediaIds != null)
        {
            // Clear existing PostMedia rows
            var existing = await _db.PostMedia.Where(pm => pm.PostId == post.Id).ToListAsync(ct);
            _db.PostMedia.RemoveRange(existing);

            if (data.MediaIds.Count > 0)
            {
                var mediaItems = await _db.Media
                    .Where(m => data.MediaIds.Contains(m.Id) && m.UserId == user.Id)
                    .ToListAsync(ct);

                if (mediaItems.Count != data.MediaIds.Count)
                    return BadRequest(new { detail = "One or more media items not found" });

                var types = mediaItems.Select(m => m.MediaType).Distinct().ToList();
                if (types.Count > 1)
                    return BadRequest(new { detail = "Cannot mix media types in one post" });

                var type = types[0];
                if (type == "image" && mediaItems.Count > 9)
                    return BadRequest(new { detail = "Maximum 9 images per post" });
                if (type != "image" && mediaItems.Count > 1)
                    return BadRequest(new { detail = $"Only 1 {type} per post" });

                // Update image_id for backward compat
                post.ImageId = (type == "image" && mediaItems.Count == 1) ? mediaItems[0].Id : null;

                for (int i = 0; i < data.MediaIds.Count; i++)
                {
                    _db.PostMedia.Add(new PostMedia
                    {
                        PostId = post.Id,
                        MediaId = data.MediaIds[i],
                        Position = i
                    });
                }
            }
            else
            {
                post.ImageId = null;
            }
        }
        else if (data.ImageId.HasValue)
        {
            post.ImageId = data.ImageId;
        }

        await _db.SaveChangesAsync(ct);

        // Reload
        var loaded = await _db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .FirstAsync(p => p.Id == post.Id, ct);
        return Ok(await ToResponseAsync(loaded, ct));
    }

    [HttpDelete("{postId:int}")]
    public async Task<IActionResult> DeletePost(int postId)
    {
        await _session.RequireCurrentUser(HttpContext, _db);
        var post = await _db.Posts
            .Include(p => p.FirstComment)
            .FirstOrDefaultAsync(p => p.Id == postId);
        if (post == null)
            return NotFound(new { detail = "Post not found" });

        if (post.FirstComment != null)
            _db.Comments.Remove(post.FirstComment);
        _db.Posts.Remove(post);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("streak")]
    public async Task<IActionResult> GetStreak()
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);

        var publishedDates = await _db.Posts
            .Where(p => p.UserId == user.Id && p.Status == "published" && p.PublishedAt != null)
            .Select(p => p.PublishedAt!.Value.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .ToListAsync();

        int streak = 0;
        DateTime? lastPublished = null;

        if (publishedDates.Count > 0)
        {
            lastPublished = publishedDates[0];
            var checkDate = DateTime.UtcNow.Date;

            // If no post today, start checking from yesterday
            if (publishedDates[0] < checkDate)
                checkDate = checkDate.AddDays(-1);

            foreach (var date in publishedDates)
            {
                if (date == checkDate)
                {
                    streak++;
                    checkDate = checkDate.AddDays(-1);
                }
                else if (date < checkDate)
                {
                    break;
                }
            }
        }

        return Ok(new { Streak = streak, LastPublished = lastPublished });
    }

    [HttpPost("{postId:int}/publish")]
    public async Task<IActionResult> PublishNow(int postId, CancellationToken ct)
    {
        var user = await _session.RequireCurrentUser(HttpContext, _db);
        var post = await _db.Posts
            .Include(p => p.FirstComment)
            .Include(p => p.Image)
            .Include(p => p.PostMedia).ThenInclude(pm => pm.Media)
            .FirstOrDefaultAsync(p => p.Id == postId && p.UserId == user.Id, ct);
        if (post == null)
            return NotFound(new { detail = "Post not found" });

        if (post.Status == "published")
            return BadRequest(new { detail = "Post is already published" });
        if (post.Status == "publishing")
            return BadRequest(new { detail = "Post is currently being published" });

        var accessToken = await _linkedIn.GetValidAccessToken(user, _db, ct);

        if (string.IsNullOrEmpty(accessToken) || accessToken == "dev-token")
        {
            post.Status = "published";
            post.LinkedInPostId = $"dev-post-{post.Id}";
            post.LinkedInPostUrn = $"urn:li:share:dev-{post.Id}";
            post.PublishedAt = DateTime.UtcNow;
            post.ErrorMessage = null;
            if (post.FirstComment != null)
            {
                post.FirstComment.Posted = 1;
                post.FirstComment.LinkedInCommentId = $"dev-comment-{post.Id}";
            }
            await _db.SaveChangesAsync(ct);
            return Ok(new { status = "published", linkedin_post_id = post.LinkedInPostId, simulated = true });
        }

        var success = await _linkedIn.PublishPost(post, user, _db, ct);
        await _db.Entry(post).ReloadAsync(ct);

        if (success)
            return Ok(new { status = "published", linkedin_post_id = post.LinkedInPostId });
        else
            return StatusCode(502, new { detail = post.ErrorMessage ?? "Publishing failed" });
    }
}
