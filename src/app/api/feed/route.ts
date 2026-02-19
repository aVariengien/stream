import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { getOrCreateSettings } from '@/lib/settings'
import type { SupabaseClient } from '@supabase/supabase-js'

type QueueRow = {
  id: string
  chunk_id: string
  predicted_score: number
  was_explore: boolean
}

type FeedItemRow = {
  id: string
  chunk_id: string
  predicted_score: number
  was_explore: boolean
  position: number
}

type ChunkRow = {
  id: string
  article_id: string
  chunk_index: number
  content: string
}

type ArticleRow = {
  id: string
  title: string
  url: string
}

async function enrichFeedItems(supabase: SupabaseClient, rows: FeedItemRow[]) {
  if (rows.length === 0) return []

  const chunkIds = rows.map((r) => r.chunk_id)
  const { data: chunks } = await supabase
    .from('chunks')
    .select('id, article_id, chunk_index, content')
    .in('id', chunkIds)

  const chunksById = new Map(((chunks || []) as ChunkRow[]).map((c) => [c.id, c]))
  const articleIds = [...new Set(((chunks || []) as ChunkRow[]).map((c) => c.article_id))]

  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, url')
    .in('id', articleIds)

  const articlesById = new Map(((articles || []) as ArticleRow[]).map((a) => [a.id, a]))

  return rows
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
      }
    })
    .filter(Boolean)
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  // before=<id>  → load items before this feed_item (exclusive), newest first then reversed
  // after=<id>   → load items after this feed_item (exclusive), oldest first
  // from=<id>    → load items from this feed_item (inclusive), oldest first
  // (none)       → resume from user's saved position (inclusive)
  const beforeId = url.searchParams.get('before')
  const afterId = url.searchParams.get('after')
  const fromId = url.searchParams.get('from')

  try {
    const supabase = getSupabase()
    const settings = await getOrCreateSettings(session.userId)
    const limit = settings.feed_batch_size

    const { data: settingsRow } = await supabase
      .from('user_settings')
      .select('show_explore_flag')
      .eq('user_id', session.userId)
      .maybeSingle()
    const showExploreFlag = settingsRow?.show_explore_flag ?? false

    // ── BACKWARD LOAD (before a given item) ────────────────────────────────
    if (beforeId) {
      const { data: refItem } = await supabase
        .from('feed_items')
        .select('position')
        .eq('id', beforeId)
        .eq('user_id', session.userId)
        .maybeSingle()

      if (!refItem) {
        return NextResponse.json({ items: [], hasBefore: false, showExploreFlag })
      }

      const { data: feedRows } = await supabase
        .from('feed_items')
        .select('id, chunk_id, predicted_score, was_explore, position')
        .eq('user_id', session.userId)
        .lt('position', refItem.position)
        .order('position', { ascending: false })
        .limit(limit)

      const rows = ((feedRows || []) as FeedItemRow[]).reverse()
      const hasBefore = rows.length === limit

      const items = await enrichFeedItems(supabase, rows)
      return NextResponse.json({ items, hasBefore, showExploreFlag })
    }

    // ── FORWARD LOAD (from / after / resume) ───────────────────────────────
    let startPosition: number | null = null
    let inclusive = true // whether startPosition itself is included

    if (fromId || afterId) {
      const refId = fromId ?? afterId
      inclusive = !!fromId
      const { data: refItem } = await supabase
        .from('feed_items')
        .select('position')
        .eq('id', refId)
        .eq('user_id', session.userId)
        .maybeSingle()

      if (refItem) startPosition = refItem.position
    } else {
      // Resume from user's last saved position
      const { data: state } = await supabase
        .from('user_feed_state')
        .select('last_seen_feed_item_id')
        .eq('user_id', session.userId)
        .maybeSingle()

      if (state?.last_seen_feed_item_id) {
        const { data: refItem } = await supabase
          .from('feed_items')
          .select('position')
          .eq('id', state.last_seen_feed_item_id)
          .maybeSingle()

        if (refItem) {
          startPosition = refItem.position
          inclusive = true
        }
      }
    }

    // Fetch existing feed_items in forward direction
    let feedQuery = supabase
      .from('feed_items')
      .select('id, chunk_id, predicted_score, was_explore, position')
      .eq('user_id', session.userId)
      .order('position', { ascending: true })
      .limit(limit)

    if (startPosition !== null) {
      feedQuery = inclusive
        ? feedQuery.gte('position', startPosition)
        : feedQuery.gt('position', startPosition)
    }

    const { data: feedRows, error: feedError } = await feedQuery
    if (feedError) {
      return NextResponse.json({ error: feedError.message }, { status: 500 })
    }

    let rows = (feedRows || []) as FeedItemRow[]

    // Pull more from queue if we don't have a full batch
    const needed = limit - rows.length
    if (needed > 0) {
      const { data: queueRows } = await supabase
        .from('feed_queue')
        .select('id, chunk_id, predicted_score, was_explore')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: true })
        .limit(needed)

      if (queueRows && queueRows.length > 0) {
        const qRows = queueRows as QueueRow[]
        const qChunkIds = qRows.map((r) => r.chunk_id)
        const qQueueIds = qRows.map((r) => r.id)

        // Persist into feed_items (stable positions via sequence)
        await supabase.from('feed_items').upsert(
          qRows.map((r) => ({
            chunk_id: r.chunk_id,
            user_id: session.userId,
            predicted_score: r.predicted_score,
            was_explore: r.was_explore,
            shown_at: new Date().toISOString(),
          })),
          { onConflict: 'user_id,chunk_id', ignoreDuplicates: true }
        )

        await supabase.from('feed_queue').delete().in('id', qQueueIds)

        // Fetch by chunk_id to get positions (works for new + pre-existing items)
        const { data: newItems } = await supabase
          .from('feed_items')
          .select('id, chunk_id, predicted_score, was_explore, position')
          .eq('user_id', session.userId)
          .in('chunk_id', qChunkIds)
          .order('position', { ascending: true })

        if (newItems) {
          const existingIds = new Set(rows.map((r) => r.id))
          const fresh = (newItems as FeedItemRow[]).filter((r) => !existingIds.has(r.id))
          rows = [...rows, ...fresh]
        }
      }
    }

    // Check whether there is history before the first item we're returning
    let hasBefore = false
    if (rows.length > 0) {
      const firstPosition = rows[0].position
      const { count } = await supabase
        .from('feed_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.userId)
        .lt('position', firstPosition)

      hasBefore = (count ?? 0) > 0
    }

    const hasMore = rows.length === limit
    const items = await enrichFeedItems(supabase, rows)

    return NextResponse.json({ items, hasMore, hasBefore, showExploreFlag })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load feed' },
      { status: 500 }
    )
  }
}
