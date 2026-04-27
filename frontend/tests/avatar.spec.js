import { test, expect } from '@playwright/test'

const AVATAR_URL = 'https://lh3.googleusercontent.com/a/test-avatar=s96-c'
const ONE_PIXEL_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBQBAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
  'base64',
)

test.describe('Shell avatar', () => {
  test('renders the Google profile photo when avatar_url is present', async ({ page }) => {
    await page.route('**/api/**', route => {
      const url = route.request().url()
      if (url.includes('/api/auth/me')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Lam Nguyen',
            email: 'lnguyen4e@gmail.com',
            avatar_url: AVATAR_URL,
            primary_login_provider: 'google',
          }),
        })
      }
      if (url.includes('/api/auth/avatar')) {
        return route.fulfill({
          status: 200,
          contentType: 'image/jpeg',
          body: ONE_PIXEL_JPEG,
        })
      }
      if (url.includes('/api/posts?')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ posts: [] }),
        })
      }
      return route.fulfill({
        contentType: 'application/json',
        body: '{}',
      })
    })

    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto('/app')

    const sidebarAvatar = page.locator('aside img[alt="Lam Nguyen"]')
    await expect(sidebarAvatar).toBeVisible()
    await expect(sidebarAvatar).toHaveAttribute('src', /\/api\/auth\/avatar\?v=/)
    await expect(page.locator('aside').getByText('LN', { exact: true })).toHaveCount(0)
  })
})
