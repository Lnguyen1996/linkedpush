using Microsoft.AspNetCore.SignalR;

namespace LinkedPushApi.Hubs;

public class NotificationsHub : Hub
{
    public async Task JoinUserGroup(string userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Clean up is automatic when using Groups — the group membership is removed automatically
        await base.OnDisconnectedAsync(exception);
    }
}