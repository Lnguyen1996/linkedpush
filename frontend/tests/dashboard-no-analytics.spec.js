import { test, expect } from '@playwright/test'

test.describe('Dashboard post actions', () => {
  test('does not expose analytics actions when analytics endpoints are unavailable', async ({ page }) => {
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
      if (url.includes('/api/posts/streak')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ streak: 0 }),
        })
      }
      if (url.includes('/api/posts?')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            posts: [
              {
                id: 1,
                title: 'Test',
                content: '<p>Test content</p>',
                status: 'draft',
                scheduled_at: '2026-04-24T21:30:00Z',
                media: [],
              },
            ],
          }),
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

    await page.getByText('Test', { exact: true }).first().click()

    await expect(page.getByTitle('Edit')).toBeVisible()
    await expect(page.getByTitle('Preview')).toBeVisible()
    await expect(page.getByTitle('Analytics')).toHaveCount(0)
  })
})
