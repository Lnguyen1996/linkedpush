import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login via dev endpoint
    await page.goto('http://localhost:8000/api/auth/dev-login')
    await expect(page).toHaveURL('http://localhost:5173/')
  })

  test('renders dashboard with stat cards', async ({ page }) => {
    await expect(page.getByText('Total Posts')).toBeVisible()
    await expect(page.locator('.text-xs').filter({ hasText: 'Drafts' })).toBeVisible()
    await expect(page.locator('.text-xs').filter({ hasText: 'Scheduled' })).toBeVisible()
    await expect(page.locator('.text-xs').filter({ hasText: 'Published' })).toBeVisible()
  })

  test('sidebar navigation links are visible', async ({ page }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Compose' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Media' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Analytics' })).toBeVisible()
  })

  test('navigate to compose page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Compose' }).click()
    await expect(page).toHaveURL(/\/compose/)
  })

  test('navigate to media page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Media' }).click()
    await expect(page).toHaveURL(/\/media/)
  })

  test('navigate to analytics page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Analytics' }).click()
    await expect(page).toHaveURL(/\/analytics/)
  })

  test('logout clears session and redirects to login', async ({ page }) => {
    await page.locator('aside').getByRole('button').filter({ has: page.locator('svg.lucide-log-out') }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
