import { post } from '../api.js'

export function registerAi(program) {
  const ai = program.command('ai').description('AI caption generation')

  ai
    .command('caption')
    .description('Generate an AI-assisted caption')
    .requiredOption('--topic <topic>', 'Topic for the caption')
    .option('--tone <tone>', 'Tone: professional, casual, technical', 'professional')
    .action(async (opts) => {
      const data = await post('/api/ai/generate', {
        topic: opts.topic,
        tone: opts.tone,
      })
      console.log(JSON.stringify(data, null, 2))
    })
}
