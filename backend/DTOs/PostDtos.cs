namespace LinkedPushApi.DTOs;

public class PostCreateDto
{
    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public DateTime? ScheduledAt { get; set; }
    public string? Timezone { get; set; } = "UTC";
    public string Status { get; set; } = "draft";
    public string? FirstComment { get; set; }
    public int? ImageId { get; set; }
}

public class PostUpdateDto
{
    public string? Title { get; set; }
    public string? Content { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public string? Timezone { get; set; }
    public string? Status { get; set; }
    public string? FirstComment { get; set; }
    public int? ImageId { get; set; }
}

public class PostResponseDto
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime? ScheduledAt { get; set; }
    public string? Timezone { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? LinkedinPostId { get; set; }
    public string? ErrorMessage { get; set; }
    public int? ImageId { get; set; }
    public string? FirstComment { get; set; }
    public string? ImageUrl { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class PostListDto
{
    public List<PostResponseDto> Posts { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PerPage { get; set; }
    public int TotalPages { get; set; }
}
