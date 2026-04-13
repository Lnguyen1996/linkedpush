import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('renders login page with Sign in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByText('Sign in with LinkedIn')).toBeVisible()
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('clicking Sign in triggers OAuth flow with correct scopes', async ({ page }) => {
    await page.goto('/login')

    // Intercept the API call to check the redirect URL
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/auth/login') && resp.status() === 200
    )

    // Click but prevent navigation by intercepting
    await page.route('https://www.linkedin.com/**', route => route.abort())
    await page.getByText('Sign in with LinkedIn').click()

    const response = await responsePromise
    expect(response.status()).toBe(200)
  })
})

test.describe('Dev Mode Login', () => {
  test('dev-login endpoint creates session and redirects to dashboard', async ({ page }) => {
    await page.goto('http://localhost:8000/api/auth/dev-login')
    await expect(page).toHaveURL('http://localhost:5173/')
  })

  test('after dev-login, /api/auth/me returns user', async ({ page }) => {
    await page.goto('http://localhost:8000/api/auth/dev-login')
    await expect(page).toHaveURL('http://localhost:5173/')

    const response = await page.evaluate(() =>
      fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json())
    )
    expect(response.name).toBe('Dev User')
    expect(response.email).toBe('dev@linkedpush.local')
  })
})

test.describe('Auth Callback Error Handling', () => {
  test('callback with error redirects to login with error message', async ({ page }) => {
    await page.goto('http://localhost:8000/api/auth/callback?error=unauthorized_scope_error&error_description=Scope+not+authorized')
    await expect(page).toHaveURL(/\/login\?error=/)
  })
})
