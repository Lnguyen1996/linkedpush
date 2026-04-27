using Microsoft.AspNetCore.SignalR;
using LinkedPushApi.Hubs;

namespace LinkedPushApi.Services;

public interface INotificationPublisher
{
    Task PublishToUser(int userId, string kind, string title, string? body, int? postId, string severity);
}

/// <summary>
/// Test double for INotificationPublisher that does nothing.
/// Use this in contexts where SignalR IHubContext is not available.
/// </summary>
public class TestNotificationPublisher : INotificationPublisher
{
    public Task PublishToUser(int userId, string kind, string title, string? body, int? postId, string severity)
        => Task.CompletedTask;
}

public class NotificationPublisher : INotificationPublisher
{
    private readonly IHubContext<NotificationsHub> _hub;

    public NotificationPublisher(IHubContext<NotificationsHub> hub)
    {
        _hub = hub;
    }

    public async Task PublishToUser(int userId, string kind, string title, string? body, int? postId, string severity)
    {
        var notification = new
        {
            id = $"{kind}:{Guid.NewGuid()}",
            kind,
            title,
            body,
            postId,
            severity,
            occurredAt = DateTime.UtcNow,
        };
        await _hub.Clients.Group($"user:{userId}").SendAsync("NotificationReceived", notification);
    }
}