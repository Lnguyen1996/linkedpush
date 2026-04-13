import http from 'node:http'
import { loginDev, login, me } from '../api.js'

export function registerAuth(program) {
  const auth = program.command('auth').description('Authentication commands')

  auth
    .command('login')
    .description('Login via LinkedIn OAuth or dev mode')
    .action(async () => {
      // Try dev-login first
      try {
        const result = await loginDev()
        if (result.session) {
          console.error('Login successful (dev mode). Run this to authenticate future commands:')
          console.error(`  export LINKEDPUSH_SESSION=${result.session}`)
          console.log(JSON.stringify({ session: result.session }))
          return
        }
      } catch { /* dev-login not available, try OAuth */ }

      // OAuth flow: get the redirect URL, open browser, listen for callback
      console.error('Dev login not available. Starting LinkedIn OAuth flow...')
      const data = await login({ cli_port: 9876 })
      if (!data.redirect_url) {
        console.error('Failed to get OAuth URL from backend.')
        process.exit(1)
      }

      // Start a temporary local server to capture the session cookie after OAuth
      const BASE_URL = process.env.LINKEDPUSH_URL || 'http://localhost:8000'
      const session = await new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
          const url = new URL(req.url, 'http://localhost')
          if (url.pathname === '/cli-callback') {
            const token = url.searchParams.get('session')
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<html><body><h2>Login successful! You can close this tab.</h2></body></html>')
            server.close()
            resolve(token)
          }
        })
        server.listen(9876, () => {
          console.error('Waiting for OAuth callback on http://localhost:9876 ...')
          console.error(`\nOpen this URL in your browser:\n  ${data.redirect_url}\n`)
          // Try to open browser automatically
          import('node:child_process').then(({ exec }) => {
            const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
            exec(`${cmd} "${data.redirect_url}"`)
          })
        })
        setTimeout(() => { server.close(); reject(new Error('OAuth timeout (2 min)')) }, 120000)
      })

      if (session) {
        console.error('Login successful. Run this to authenticate future commands:')
        console.error(`  export LINKEDPUSH_SESSION=${session}`)
        console.log(JSON.stringify({ session }))
      } else {
        console.error('Login failed — no session token received.')
        process.exit(1)
      }
    })

  auth
    .command('me')
    .description('Show current user info')
    .action(async () => {
      const user = await me()
      console.log(JSON.stringify(user, null, 2))
    })
}
