import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('renders login page with Sign in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in to LinkedPush' })).toBeVisible()
    await expect(page.getByText('Continue with Google')).toBeVisible()
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

  test('clicking Sign in triggers Google OAuth flow', async ({ page }) => {
    await page.goto('/login')

    await page.route('**/api/auth/login', route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          redirect_url: 'https://accounts.google.com/o/oauth2/v2/auth?scope=openid%20email%20profile',
        }),
      })
    )

    // Intercept the API call to check the redirect URL
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/auth/login') && resp.status() === 200
    )

    let googleRedirectUrl = ''
    await page.route('https://accounts.google.com/**', route => {
      googleRedirectUrl = route.request().url()
      route.abort()
    })
    await page.getByText('Continue with Google').click()

    const response = await responsePromise
    expect(response.status()).toBe(200)
    await expect.poll(() => googleRedirectUrl).toContain('accounts.google.com')
    expect(decodeURIComponent(googleRedirectUrl)).toContain('scope=openid email profile')
  })
})

test.describe('Dev Mode Login', () => {
  test('dev-login endpoint creates session and redirects to dashboard', async ({ page }) => {
    const devLogin = await page.request.get('http://localhost:8000/api/auth/dev-login', {
      maxRedirects: 0,
    })
    test.skip(devLogin.status() === 404, 'Dev login is disabled for the running backend')

    await page.goto('http://localhost:8000/api/auth/dev-login')
    const continueBtn = page.getByRole('button', { name: /Continue as Dev User/i })
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click()
    }
    await expect(page).toHaveURL('http://localhost:5173/')
  })

  test('after dev-login, /api/auth/me returns user', async ({ page }) => {
    const devLogin = await page.request.get('http://localhost:8000/api/auth/dev-login', {
      maxRedirects: 0,
    })
    test.skip(devLogin.status() === 404, 'Dev login is disabled for the running backend')

    await page.goto('http://localhost:8000/api/auth/dev-login')
    const continueBtn = page.getByRole('button', { name: /Continue as Dev User/i })
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click()
    }
    await expect(page).toHaveURL('http://localhost:5173/')

    const response = await page.evaluate(() =>
      fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json())
    )
    expect(response.name).toBe('Dev User')
    expect(response.email).toBe('dev@linkedpush.local')
  })
})

test.describe('Auth Callback Error Handling', () => {
  test('auth callback without code/state redirects to login with actionable message', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page).toHaveURL(/\/login\?cb_error=missing_code_or_state/)
    await expect(page.getByText('The Google sign-in response was incomplete. Please start sign-in again.')).toBeVisible()
  })

  test('callback with provider error surfaces login message', async ({ page }) => {
    await page.goto('/auth/callback?error=access_denied&error_description=Scope+not+authorized')
    await expect(page).toHaveURL(/\/login\?cb_error=access_denied/)
    await expect(page.getByText('Google sign-in was canceled. Click "Continue with Google" to try again.')).toBeVisible()
    await expect(page.getByText('Scope not authorized')).toBeVisible()
  })
})
