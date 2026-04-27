using LinkedPushApi.Models;

namespace LinkedPushApi.Services;

public interface INotificationService
{
    Task NotifyPostPublished(Post post, User user);
    Task NotifyPostFailed(Post post, User user);
    Task NotifyLinkedInTokenExpiring(SocialConnection connection, User user);
    Task NotifyLinkedInTokenExpired(SocialConnection connection, User user);
    Task PublishToUser(int userId, string kind, string title, string? body, int? postId, string severity);
}