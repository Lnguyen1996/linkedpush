import { get, post } from '../api.js'

export function registerAnalytics(program) {
  const analytics = program.command('analytics').description('Post analytics')

  analytics
    .command('summary')
    .description('Get analytics summary for all published posts')
    .action(async () => {
      const data = await get('/api/analytics')
      console.log(JSON.stringify(data, null, 2))
    })

  analytics
    .command('refresh')
    .description('Re-fetch analytics from LinkedIn')
    .action(async () => {
      const data = await post('/api/analytics/refresh')
      console.error('Analytics refreshed')
      console.log(JSON.stringify(data, null, 2))
    })
}
