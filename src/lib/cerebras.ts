import Cerebras from '@cerebras/cerebras_cloud_sdk'

type FewShotExample = {
  content: string
  rating: number
  annotation?: string | null
}

type CandidateChunk = {
  id: string
  content: string
}

export type ChunkScore = {
  id: string
  score: number
}

function getApiKey(): string {
  const key = process.env.CEREBRAS_API_KEY
  if (!key) {
    throw new Error('CEREBRAS_API_KEY is not configured')
  }
  return key
}

let cerebrasClient: Cerebras | null = null

function getClient(): Cerebras {
  if (cerebrasClient) return cerebrasClient
  cerebrasClient = new Cerebras({ apiKey: getApiKey() })
  return cerebrasClient
}

async function callChatCompletion(payload: Record<string, unknown>) {
  return getClient().chat.completions.create(payload as never) as Promise<{
    choices?: Array<{
      message?: {
        content?: string | null
      }
    }>
  }>
}

function scoreSchema() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'chunk_scores',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['scores'],
        properties: {
          scores: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'score'],
              properties: {
                id: { type: 'string' },
                score: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }
}

function buildFewShotText(examples: FewShotExample[]): string {
  if (examples.length === 0) {
    return 'No historical ratings available yet. Use your best estimate.'
  }
  return examples
    .map((example, index) => {
      const note = example.annotation ? `\nNote: ${example.annotation}` : ''
      return `Example ${index + 1}\nRating: ${example.rating}\nChunk: ${example.content}${note}`
    })
    .join('\n\n')
}

export async function scoreChunksBatch(
  chunks: CandidateChunk[],
  examples: FewShotExample[],
  model: string
): Promise<ChunkScore[]> {
  if (chunks.length === 0) return []

  const response = await callChatCompletion({
    model,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'You are a recommendation scorer. Score each chunk from 1 to 5. Return only JSON that matches the schema.',
      },
      {
        role: 'user',
        content: `Historical examples:\n${buildFewShotText(examples)}\n\nScore these chunks:\n${JSON.stringify(
          chunks
        )}`,
      },
    ],
    response_format: scoreSchema(),
  })

  const content = response.choices?.[0]?.message?.content
  if (!content) {
    return chunks.map((chunk) => ({ id: chunk.id, score: 3 }))
  }

  try {
    const parsed = JSON.parse(content) as { scores: ChunkScore[] }
    const safeScores = new Map(parsed.scores.map((score) => [score.id, Number(score.score)]))
    return chunks.map((chunk) => ({
      id: chunk.id,
      score: Number.isFinite(safeScores.get(chunk.id)) ? Number(safeScores.get(chunk.id)) : 3,
    }))
  } catch {
    return chunks.map((chunk) => ({ id: chunk.id, score: 3 }))
  }
}

export async function streamChunkContext(
  chunkText: string,
  fullDocument: string,
  model: string
): Promise<AsyncIterable<string>> {
  const stream = await getClient().chat.completions.create({
    model,
    stream: true,
    temperature: 0.2,
    max_completion_tokens: 800,
    messages: [
      {
        role: 'system',
        content:
          'Given the first text block (a chunk) and the second text block (the full document it comes from), provide: 1) one sentence that contextualizes where the chunk comes from, 2) a concise outline of the full document with one line per section/chapter, and clearly indicate where the chunk fits. Keep total output under half a page.',
      },
      {
        role: 'user',
        content: `${chunkText}\n\n${fullDocument}`,
      },
    ],
  } as never) as AsyncIterable<{
    choices?: Array<{ delta?: { content?: string | null } }>
  }>

  async function* textChunks() {
    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content
      if (text) yield text
    }
  }

  return textChunks()
}
