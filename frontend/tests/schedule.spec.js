import { test, expect } from '@playwright/test'

// End-to-end test: schedule a post and verify SchedulerService transitions it to a terminal state.
//
// Path taken: API-driven post creation from within the Playwright browser context (after dev-login).
// Why: The dev user has no LinkedIn connection, so Compose.jsx gates scheduling in the UI
// (`publishGated = !isConnected` short-circuits `savePost('scheduled')` with a toast and returns).
// Driving the UI schedule submit would therefore never produce a `scheduled` post. We still
// exercise dev-login, the frontend's session cookie handling, Compose page rendering (for the
// "connect LinkedIn" banner smoke check), the POST /api/posts scheduling write path, and the
// SchedulerService polling loop (60s cadence).
//
// Expected terminal state: When the backend runs in DevMode, the scheduler detects the dev-user
// sentinel (user.access_token == "dev-token") and simulates a successful publish, setting
// status='published' with a synthetic linkedin_post_id of `dev-scheduled-{id}`. Without DevMode
// the scheduler would set status='failed' with error_message='LinkedIn not connected'. The test
// accepts either terminal state and performs branch-specific assertions.

test.describe('Schedule a post end-to-end', () => {
  test('creating a scheduled post transitions through the scheduler to a terminal state', async ({ page }) => {
    test.setTimeout(240_000) // 4 min — accommodates scheduler 60s cadence + margin

    // 1. Dev-login. GET /api/auth/dev-login now redirects to /api/auth/dev-confirm (HTML form).
    //    Click the "Continue as Dev User" button to POST and create the session.
    const devLogin = await page.request.get('http://localhost:8000/api/auth/dev-login', {
      maxRedirects: 0,
    })
    test.skip(devLogin.status() === 404, 'Dev login is disabled for the running backend')

    await page.goto('http://localhost:8000/api/auth/dev-login')
    const continueBtn = page.getByRole('button', { name: /Continue as Dev User/i })
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click()
    }
    await expect(page).toHaveURL(/localhost:5173\//, { timeout: 15_000 })

    // 2. Smoke-check: Compose page renders with the "Connect LinkedIn" gate visible.
    //    This confirms frontend auth works and the user has no LinkedIn (expected for dev user).
    await page.goto('/app/compose')
    await expect(page.getByText(/Connect LinkedIn to publish/i)).toBeVisible({ timeout: 10_000 })

    // 3. Create a scheduled post via the API (see header comment for rationale).
    //    Schedule ~15s in the future so it's picked up on the next scheduler tick (<=60s).
    const stamp = new Date().toISOString()
    const scheduledAt = new Date(Date.now() + 15_000).toISOString()

    const created = await page.evaluate(
      async ({ scheduledAt, stamp }) => {
        const r = await fetch('/api/posts', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `<p>Scheduler pipeline test ${stamp}</p>`,
            status: 'scheduled',
            scheduled_at: scheduledAt,
            timezone: 'UTC',
          }),
        })
        const body = await r.json().catch(() => ({}))
        return { ok: r.ok, status: r.status, body }
      },
      { scheduledAt, stamp },
    )

    expect(created.ok, `POST /api/posts failed: ${JSON.stringify(created.body)}`).toBe(true)
    expect(created.body.status).toBe('scheduled')
    expect(created.body.id).toBeTruthy()
    const postId = created.body.id
    console.log(`[test] Created scheduled post id=${postId}, scheduled_at=${scheduledAt}`)

    // 4. Poll until terminal state (every 5s, up to ~3 min).
    //    Scheduler polls every 60s, so worst-case wait is ~75s from creation.
    const terminalStates = new Set(['published', 'failed'])
    let final = created.body
    const startPoll = Date.now()
    for (let i = 0; i < 36; i++) {
      await page.waitForTimeout(5_000)
      const r = await page.evaluate(
        (id) => fetch('/api/posts/' + id, { credentials: 'include' }).then((x) => x.json()),
        postId,
      )
      final = r
      console.log(`[test] poll #${i + 1} (t+${((Date.now() - startPoll) / 1000).toFixed(0)}s): status=${r.status}${r.error_message ? ` error="${r.error_message}"` : ''}`)
      if (terminalStates.has(r.status)) break
    }

    // 5. Assert terminal state. Expect either:
    //    - 'published' (DevMode dev-user branch): simulated publish, linkedin_post_id set, no error
    //    - 'failed' (no DevMode / no connection): error_message contains 'LinkedIn'
    expect(terminalStates.has(final.status), `Post did not reach terminal state within timeout; last=${JSON.stringify(final)}`).toBe(true)

    if (final.status === 'published') {
      // DevMode simulated publish branch
      expect(final.linkedin_post_id || '').toMatch(/^dev-scheduled-/)
      expect(final.published_at).toBeTruthy()
    } else {
      // Scheduler failed-branch (no LinkedIn connection)
      expect(final.error_message || '').toMatch(/linkedin/i)
    }

    // 6. Cleanup — delete the test post so it doesn't linger in the dev DB.
    const del = await page.evaluate(
      (id) =>
        fetch('/api/posts/' + id, { method: 'DELETE', credentials: 'include' }).then((r) => r.status),
      postId,
    )
    expect([200, 204]).toContain(del)
  })
})
