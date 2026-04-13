import { get, post, put, del } from '../api.js'

export function registerPosts(program) {
  const posts = program.command('posts').description('Post management')

  posts
    .command('list')
    .description('List posts')
    .option('-s, --status <status>', 'Filter by status: draft|scheduled|published|failed')
    .action(async (opts) => {
      const data = await get('/api/posts', { status: opts.status })
      const list = Array.isArray(data) ? data : data.posts || []
      console.log(JSON.stringify(list, null, 2))
    })

  posts
    .command('get <id>')
    .description('Get a single post')
    .action(async (id) => {
      const data = await get(`/api/posts/${id}`)
      console.log(JSON.stringify(data, null, 2))
    })

  posts
    .command('create')
    .description('Create a new post')
    .requiredOption('-c, --content <content>', 'Post content (text or HTML)')
    .option('-t, --title <title>', 'Post title')
    .option('-s, --schedule <date>', 'Schedule date (ISO 8601)')
    .option('--publish', 'Publish immediately after creating')
    .option('-i, --image-id <imageId>', 'Attach media by ID')
    .option('-l, --link <url>', 'Append a link to the post content')
    .option('--first-comment <text>', 'Add a first comment (e.g. link in comments)')
    .action(async (opts) => {
      let content = opts.content
      if (opts.link) content += `\n\n${opts.link}`
      // Convert plain text to HTML paragraphs for TipTap editor rendering.
      // Backend StripHtml() converts back to plain text before LinkedIn publish.
      if (!content.includes('<p>') && !content.includes('<br')) {
        content = content
          .split(/\n\n+/)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('')
      }
      const body = { content }
      if (opts.title) body.title = opts.title
      if (opts.firstComment) body.first_comment = opts.firstComment
      if (opts.schedule) {
        body.scheduled_at = opts.schedule
        body.status = 'scheduled'
      }
      if (opts.imageId) body.image_id = parseInt(opts.imageId)

      const created = await post('/api/posts', body)
      console.error(`Post created (id: ${created.id}, status: ${created.status})`)

      if (opts.publish) {
        const published = await post(`/api/posts/${created.id}/publish`)
        console.error(`Post published (status: ${published.status})`)
        console.log(JSON.stringify(published, null, 2))
      } else {
        console.log(JSON.stringify(created, null, 2))
      }
    })

  posts
    .command('publish <id>')
    .description('Publish a post to LinkedIn')
    .action(async (id) => {
      const data = await post(`/api/posts/${id}/publish`)
      console.log(JSON.stringify(data, null, 2))
    })

  posts
    .command('delete <id>')
    .description('Delete a post')
    .action(async (id) => {
      await del(`/api/posts/${id}`)
      console.log(JSON.stringify({ ok: true, deleted: parseInt(id) }))
    })
}
