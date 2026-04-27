using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public class NotificationService : INotificationService
{
    private readonly INotificationPublisher _publisher;

    public NotificationService(INotificationPublisher publisher)
    {
        _publisher = publisher;
    }

    public async Task NotifyPostPublished(Post post, User user)
    {
        await _publisher.PublishToUser(user.Id, "post_published",
            "Your post was published",
            post.Title ?? "Post published on LinkedIn",
            post.Id, "info");
    }

    public async Task NotifyPostFailed(Post post, User user)
    {
        await _publisher.PublishToUser(user.Id, "post_failed",
            "Your post failed to publish",
            post.ErrorMessage ?? "Check your LinkedIn connection and try again.",
            post.Id, "error");
    }

    public async Task NotifyLinkedInTokenExpiring(SocialConnection connection, User user)
    {
        await _publisher.PublishToUser(user.Id, "linkedin_token_expiring",
            "LinkedIn token expiring soon",
            $"Your LinkedIn access token will expire on {connection.TokenExpiresAt:g}. Please re-authenticate to avoid interruption.",
            null, "warning");
    }

    public async Task NotifyLinkedInTokenExpired(SocialConnection connection, User user)
    {
        await _publisher.PublishToUser(user.Id, "linkedin_token_expired",
            "LinkedIn token expired",
            "Your LinkedIn access token has expired. Please re-authenticate to continue publishing.",
            null, "error");
    }

    public async Task PublishToUser(int userId, string kind, string title, string? body, int? postId, string severity)
    {
        await _publisher.PublishToUser(userId, kind, title, body, postId, severity);
    }
}