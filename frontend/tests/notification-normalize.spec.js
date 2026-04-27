import { test, expect } from '@playwright/test'
import { normalizeNotification } from '../src/lib/notifications.js'

test.describe('Notification payloads', () => {
  test('normalizes SignalR camelCase fields for the React notification UI', () => {
    const item = normalizeNotification({
      id: 'post_failed:123',
      kind: 'post_failed',
      title: 'Post failed',
      body: 'LinkedIn rejected it',
      postId: 123,
      occurredAt: '2026-04-27T02:00:00Z',
      readAt: null,
      severity: 'error',
    })

    expect(item.post_id).toBe(123)
    expect(item.occurred_at).toBe('2026-04-27T02:00:00Z')
    expect(item.read_at).toBeNull()
  })
})
