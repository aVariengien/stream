import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { fetchJinaMarkdown } from '@/lib/jina'
import { generateChunkContext } from '@/lib/cerebras'
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
    const context = await generateChunkContext(chunk.content, fullMarkdown, settings.context_model)
    return NextResponse.json({ context })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate context' },
      { status: 500 }
    )
  }
}

