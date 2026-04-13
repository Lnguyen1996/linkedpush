import { loginDev, me } from '../api.js'

export function registerAuth(program) {
  const auth = program.command('auth').description('Authentication commands')

  auth
    .command('login')
    .description('Login via dev mode (prints session token to export)')
    .action(async () => {
      const result = await loginDev()
      if (result.session) {
        console.error('Login successful. Run this to authenticate future commands:')
        console.error(`  export LINKEDPUSH_SESSION=${result.session}`)
        console.log(JSON.stringify({ session: result.session }))
      } else {
        console.error('Dev login not available. Set DevMode=true in backend config.')
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
