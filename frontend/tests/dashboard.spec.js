import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
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
  })

  test('renders dashboard with stat cards', async ({ page }) => {
    await expect(page.locator('span.hidden.sm\\:inline').filter({ hasText: 'Total' })).toBeVisible()
    await expect(page.locator('span.hidden.sm\\:inline').filter({ hasText: 'Drafts' })).toBeVisible()
    await expect(page.locator('span.hidden.sm\\:inline').filter({ hasText: 'Scheduled' })).toBeVisible()
    await expect(page.locator('span.hidden.sm\\:inline').filter({ hasText: 'Published' })).toBeVisible()
  })

  test('sidebar navigation links are visible', async ({ page }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Compose' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Media' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Analytics' })).toHaveCount(0)
  })

  test('navigate to compose page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Compose' }).click()
    await expect(page).toHaveURL(/\/compose/)
  })

  test('navigate to media page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Media' }).click()
    await expect(page).toHaveURL(/\/media/)
  })

  test('logout clears session and redirects to login', async ({ page }) => {
    await page.locator('aside').getByRole('button').filter({ has: page.locator('svg.lucide-log-out') }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
