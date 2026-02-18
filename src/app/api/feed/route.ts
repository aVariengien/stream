import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { getOrCreateSettings } from '@/lib/settings'

type QueueRow = {
  id: string
  chunk_id: string
  predicted_score: number
  was_explore: boolean
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()
    const settings = await getOrCreateSettings(session.userId)

    const { data: queueRows, error } = await supabase
      .from('feed_queue')
      .select('id, chunk_id, predicted_score, was_explore')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: true })
      .limit(settings.feed_batch_size)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (queueRows || []) as QueueRow[]
    if (rows.length === 0) {
      return NextResponse.json({ items: [], queueEmpty: true })
    }

    const chunkIds = rows.map((row) => row.chunk_id)
    const queueRowIds = rows.map((row) => row.id)

    const { data: chunks } = await supabase
      .from('chunks')
      .select('id, article_id, chunk_index, content')
      .in('id', chunkIds)

    const chunksById = new Map((chunks || []).map((chunk) => [chunk.id, chunk]))
    const articleIds = [...new Set((chunks || []).map((chunk) => chunk.article_id))]

    const { data: articles } = await supabase
      .from('articles')
      .select('id, title, url')
      .in('id', articleIds)

    const articlesById = new Map((articles || []).map((article) => [article.id, article]))
    const payload = rows
      .map((row) => {
        const chunk = chunksById.get(row.chunk_id)
        if (!chunk) return null
        const article = articlesById.get(chunk.article_id)
        if (!article) return null
        return {
          chunk_id: chunk.id,
          article_id: article.id,
          article_title: article.title,
          article_url: article.url,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          predicted_score: row.predicted_score,
          was_explore: row.was_explore,
        }
      })
      .filter(Boolean)

    if (payload.length > 0) {
      await supabase.from('feed_items').upsert(
        payload.map((item) => ({
          chunk_id: item!.chunk_id,
          user_id: session.userId,
          predicted_score: item!.predicted_score,
          was_explore: item!.was_explore,
          shown_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,chunk_id', ignoreDuplicates: true }
      )
      await supabase.from('feed_queue').delete().in('id', queueRowIds)
    }

    return NextResponse.json({
      items: shuffle(payload),
      queueEmpty: payload.length === 0,
      showExploreFlag: settings.show_explore_flag,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load feed' },
      { status: 500 }
    )
  }
}

