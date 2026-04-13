#!/usr/bin/env node

import { program } from 'commander'
import { registerAuth } from './commands/auth.js'
import { registerPosts } from './commands/posts.js'
import { registerMedia } from './commands/media.js'
import { registerAi } from './commands/ai.js'
import { registerAnalytics } from './commands/analytics.js'

program
  .name('linkedpush')
  .description('CLI for scheduling and publishing LinkedIn posts')
  .version('1.0.0')

registerAuth(program)
registerPosts(program)
registerMedia(program)
registerAi(program)
registerAnalytics(program)

program.parseAsync(process.argv).catch(err => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
