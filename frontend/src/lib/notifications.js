export function normalizeNotification(notification) {
  if (!notification) return notification

  return {
    ...notification,
    post_id: notification.post_id ?? notification.postId ?? null,
    occurred_at: notification.occurred_at ?? notification.occurredAt ?? null,
    read_at: notification.read_at ?? notification.readAt ?? null,
    created_at: notification.created_at ?? notification.createdAt ?? null,
  }
}
