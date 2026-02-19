import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

type FeedRow = {
  id: string
  chunk_id: string
  predicted_score: number
  was_explore: boolean
  shown_at: string
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()
    const url = new URL(request.url)
    const limitParam = Number(url.searchParams.get('limit') || 200)
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(1000, Math.round(limitParam))) : 200

    const { data: feedRows, error: feedError } = await supabase
      .from('feed_items')
      .select('id, chunk_id, predicted_score, was_explore, shown_at')
      .eq('user_id', session.userId)
      .order('shown_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit)

    if (feedError) {
      return NextResponse.json({ error: feedError.message }, { status: 500 })
    }

    const rows = (feedRows || []) as FeedRow[]
    let showExploreFlag = false
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('show_explore_flag')
      .eq('user_id', session.userId)
      .maybeSingle()
    if (settingsData && typeof settingsData.show_explore_flag === 'boolean') {
      showExploreFlag = settingsData.show_explore_flag
    }

    if (rows.length === 0) {
      return NextResponse.json({ items: [], resumeFeedItemId: null, showExploreFlag })
    }

    const chunkIds = rows.map((row) => row.chunk_id)
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id, article_id, chunk_index, content')
      .in('id', chunkIds)

    const chunksById = new Map((chunks || []).map((chunk) => [chunk.id, chunk]))
    const articleIds = [...new Set((chunks || []).map((chunk) => chunk.article_id))]
    const { data: articles } = await supabase.from('articles').select('id, title, url').in('id', articleIds)
    const articlesById = new Map((articles || []).map((article) => [article.id, article]))

    const items = rows
      .map((row) => {
        const chunk = chunksById.get(row.chunk_id)
        if (!chunk) return null
        const article = articlesById.get(chunk.article_id)
        if (!article) return null
        return {
          feed_item_id: row.id,
          chunk_id: chunk.id,
          article_id: article.id,
          article_title: article.title,
          article_url: article.url,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          predicted_score: row.predicted_score,
          was_explore: row.was_explore,
          shown_at: row.shown_at,
        }
      })
      .filter(Boolean)

    const { data: state } = await supabase
      .from('user_feed_state')
      .select('last_seen_feed_item_id')
      .eq('user_id', session.userId)
      .maybeSingle()

    return NextResponse.json({
      items,
      resumeFeedItemId: state?.last_seen_feed_item_id || null,
      showExploreFlag,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load feed history' },
      { status: 500 }
    )
  }
}

