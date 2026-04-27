import { test, expect } from '@playwright/test'

test.describe('Document carousel preview', () => {
  test('falls back to initials when the profile photo fails to load', async ({ page }) => {
    await page.route('**/api/**', route => {
      const url = route.request().url()
      if (url.includes('/api/auth/me')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Dev User',
            email: 'dev@linkedpush.local',
            avatar_url: '/broken-avatar.png',
          }),
        })
      }
      if (url.includes('/api/posts/1')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            content: '<p>Broken profile photo test</p>',
            status: 'draft',
            created_at: '2026-04-24T20:00:00Z',
            media: [],
          }),
        })
      }
      return route.fulfill({
        contentType: 'application/json',
        body: '{}',
      })
    })

    await page.route('**/broken-avatar.png', route =>
      route.fulfill({ status: 404, body: 'missing' }),
    )

    await page.goto('/app/post/1')

    const postPreview = page.locator('.overflow-hidden.rounded-xl').filter({ hasText: 'Post Preview' })
    await expect(postPreview).toHaveCount(1)
    await expect(postPreview.getByText('DU', { exact: true })).toBeVisible()
    await expect(postPreview.locator('img[alt="Dev User"]')).toHaveCount(0)
  })

  test('opens document attachments in a readable full-screen viewer', async ({ page }) => {
    await page.route('**/api/**', route => {
      const url = route.request().url()
      if (url.includes('/api/auth/me')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Dev User',
            email: 'dev@linkedpush.local',
          }),
        })
      }
      if (url.includes('/api/posts/1')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            content: '<p>Document carousel test</p>',
            status: 'draft',
            created_at: '2026-04-24T20:00:00Z',
            media: [
              {
                id: 3,
                url: '/api/media/3/file?v=test.pdf',
                original_filename: 'di-lifetimes-carousel.pptx',
                mime_type: 'application/pdf',
                media_type: 'document',
                page_count: 2,
              },
            ],
          }),
        })
      }
      if (url.includes('/api/media/3/file')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: '%PDF-1.4\n%%EOF',
        })
      }
      return route.fulfill({
        contentType: 'application/json',
        body: '{}',
      })
    })

    await page.goto('/app/post/1')
    await expect(page.getByText('PDF · Use arrows to view slides')).toBeVisible()
    await expect(page.getByText('1 / 2')).toBeVisible()

    await page.getByRole('button', { name: 'Next slide' }).click()
    await expect(page.getByText('2 / 2')).toBeVisible()

    await page.getByRole('button', { name: 'Previous slide' }).click()
    await expect(page.getByText('1 / 2')).toBeVisible()

    await page.getByText('PDF · Use arrows to view slides').click()

    const lightbox = page.locator('.fixed.inset-0')
    await expect(lightbox).toContainText('1 of 1')
    await expect(lightbox.locator('iframe[title="di-lifetimes-carousel.pptx"]')).toBeVisible()
    await expect(lightbox.locator('img[alt="di-lifetimes-carousel.pptx"]')).toHaveCount(0)

    await lightbox.getByRole('button', { name: 'Close' }).click()
    await expect(lightbox).toHaveCount(0)
  })
})
