import { test, expect } from '@playwright/test'

test.describe('Account settings', () => {
  test('shows the profile identity without redundant synced copy', async ({ page }) => {
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

    await page.goto('/app/settings?tab=account')

    const panel = page.locator('#settings-panel-account')
    await expect(panel.getByText('Lam Nguyen')).toBeVisible()
    await expect(panel.getByText('lnguyen4e@gmail.com')).toBeVisible()
    await expect(panel.getByText('Synced from your Google account')).toHaveCount(0)
    await expect(panel.getByRole('heading', { name: 'Profile' })).toHaveCount(0)
  })
})
