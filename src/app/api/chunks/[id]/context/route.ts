import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { fetchJinaMarkdown } from '@/lib/jina'
import { streamChunkContext } from '@/lib/cerebras'
import { getOrCreateSettings } from '@/lib/settings'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const supabase = getSupabase()

    const { data: chunk, error: chunkError } = await supabase
      .from('chunks')
      .select('id, content, article_id')
      .eq('id', id)
      .eq('user_id', session.userId)
      .single()

    if (chunkError || !chunk) {
      return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })
    }

    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('url')
      .eq('id', chunk.article_id)
      .eq('user_id', session.userId)
      .single()

    if (articleError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const settings = await getOrCreateSettings(session.userId)
    const fullMarkdown = await fetchJinaMarkdown(article.url)
    const textStream = await streamChunkContext(chunk.content, fullMarkdown, settings.context_model)

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const text of textStream) {
          controller.enqueue(encoder.encode(text))
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate context' },
      { status: 500 }
    )
  }
}

