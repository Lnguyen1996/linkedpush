import { test, expect } from '@playwright/test'

test.describe('Notification bell', () => {
  test('renders as a single button trigger', async ({ page }) => {
    const consoleErrors = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.route('**/api/**', route => {
      const url = route.request().url()
      if (url.includes('/api/auth/me')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Lam Nguyen',
            email: 'lnguyen4e@gmail.com',
            avatar_url: null,
          }),
        })
      }
      if (url.includes('/api/posts?')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ posts: [] }),
        })
      }
      if (url.includes('/api/notifications/stored')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total_count: 0, page: 1, page_size: 20 }),
        })
      }
      return route.fulfill({
        contentType: 'application/json',
        body: '{}',
      })
    })

    await page.goto('/app')

    await expect(page.locator('header button[aria-label="Notifications"]')).toHaveCount(1)
    await expect(page.locator('header button button[aria-label="Notifications"]')).toHaveCount(0)

    await page.waitForTimeout(1000)
    expect(consoleErrors.filter(text => text.includes('before the hub handshake could complete'))).toEqual([])
    expect(consoleErrors.filter(text => text.includes('before stop() was called'))).toEqual([])
  })
})
