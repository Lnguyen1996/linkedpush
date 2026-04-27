import { test, expect } from '@playwright/test'

test.describe('Media library empty or unrenderable files', () => {
  test('explains tiny images and documents that do not have meaningful previews', async ({ page }) => {
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
              id: 6,
              original_filename: 't.png',
              filename: 'tiny.png',
              file_size: 70,
              mime_type: 'image/png',
              media_type: 'image',
              width: 1,
              height: 1,
              created_at: '2026-04-24T21:00:00Z',
            },
            {
              id: 4,
              original_filename: 'test-bug.pdf',
              filename: 'empty.pdf',
              file_size: 256,
              mime_type: 'application/pdf',
              media_type: 'document',
              created_at: '2026-04-24T21:05:00Z',
            },
          ]),
        })
      }
      if (url.includes('/api/media/6/file')) {
        return route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGOSHzRgAAAAABJRU5ErkJggg==',
            'base64'
          ),
        })
      }
      if (url.includes('/api/media/4/file')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: '%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n%%EOF',
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

    const tinyImageCard = page.locator('.grid > .group').filter({ hasText: 't.png' })
    await expect(tinyImageCard.getByText('Preview unavailable')).toBeVisible()
    await expect(tinyImageCard.getByText('1 x 1 px')).toBeVisible()

    const tinyDocumentCard = page.locator('.grid > .group').filter({ hasText: 'test-bug.pdf' })
    await expect(tinyDocumentCard.getByText('Document may be empty')).toBeVisible()
  })
})
