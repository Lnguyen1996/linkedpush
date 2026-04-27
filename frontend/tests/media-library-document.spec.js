import { test, expect } from '@playwright/test'

test.describe('Media library document preview', () => {
  test('renders documents with an in-app preview instead of a blank iframe', async ({ page }) => {
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
      if (url.endsWith('/api/media')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 3,
              original_filename: 'di-lifetimes-carousel.pptx',
              filename: 'di-lifetimes-carousel.pdf',
              file_size: 142745,
              mime_type: 'application/pdf',
              media_type: 'document',
              created_at: '2026-04-24T20:00:00Z',
              page_count: 2,
            },
          ]),
        })
      }
      if (url.includes('/api/media/3/file')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: '%PDF-1.4\n%%EOF',
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

    await page.goto('/app/media')
    await page.locator('.grid > .group').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('di-lifetimes-carousel.pptx')).toBeVisible()
    await expect(dialog.locator('iframe')).toHaveCount(0)
    await expect(dialog.getByText('Document preview unavailable')).toBeVisible()
    await expect(dialog.getByText('1 / 2')).toBeVisible()

    await dialog.getByRole('button', { name: 'Next slide' }).click()
    await expect(dialog.getByText('2 / 2')).toBeVisible()

    await dialog.getByRole('button', { name: 'Previous slide' }).click()
    await expect(dialog.getByText('1 / 2')).toBeVisible()
  })
})
