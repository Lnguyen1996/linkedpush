import { get, upload, del } from '../api.js'

export function registerMedia(program) {
  const media = program.command('media').description('Media management')

  media
    .command('list')
    .description('List uploaded media')
    .action(async () => {
      const data = await get('/api/media')
      const list = Array.isArray(data) ? data : data.media || []
      console.log(JSON.stringify(list, null, 2))
    })

  media
    .command('upload <file>')
    .description('Upload an image file')
    .action(async (file) => {
      const data = await upload('/api/media', file)
      console.error(`Uploaded: ${data.filename || data.original_filename} (id: ${data.id})`)
      console.log(JSON.stringify(data, null, 2))
    })

  media
    .command('delete <id>')
    .description('Delete a media item')
    .action(async (id) => {
      await del(`/api/media/${id}`)
      console.log(JSON.stringify({ ok: true, deleted: parseInt(id) }))
    })
}
