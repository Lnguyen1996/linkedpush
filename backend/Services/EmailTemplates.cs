namespace LinkedPushApi.Services;

public static class EmailTemplates
{
    public static string PostFailed(string userName, string postTitle, string? errorMessage, string appUrl)
    {
        return $"""
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #dc2626;">Post Failed to Publish</h2>
  <p>Hi {userName},</p>
  <p>Your post <strong>"{postTitle}"</strong> failed to publish on LinkedIn.</p>
  <p style="color: #666;">Reason: {errorMessage ?? "Unknown error"}</p>
  <a href="{appUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">View Post</a>
</body>
</html>
""";
    }

    public static string PostPublished(string userName, string postTitle, string appUrl)
    {
        return $"""
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #059669;">Post Published</h2>
  <p>Hi {userName},</p>
  <p>Your post <strong>"{postTitle}"</strong> was successfully published on LinkedIn!</p>
  <a href="{appUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">View Post</a>
</body>
</html>
""";
    }

    public static string WeeklyDigest(string userName, List<(string title, string status, DateTime? scheduledAt)> posts, string appUrl)
    {
        var itemsHtml = string.Join("", posts.Select(p => $"<li>{p.title} — <em>{p.status}</em></li>"));
        return $"""
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Your LinkedPush Weekly Summary</h2>
  <p>Hi {userName}, here's your weekly summary.</p>
  <ul>{itemsHtml}</ul>
  <a href="{appUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Open Dashboard</a>
</body>
</html>
""";
    }
}
