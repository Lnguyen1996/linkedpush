import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test.describe('Notification realtime proxy', () => {
  test('proxies SignalR hub requests in local dev', async () => {
    const config = await readFile(path.resolve('vite.config.js'), 'utf8')

    expect(config).toContain("'/hubs'")
    expect(config).toContain("ws: true")
  })
})
