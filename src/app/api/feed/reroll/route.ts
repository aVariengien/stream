import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()

    // Caller can specify an explicit cut point; otherwise use the saved position
    let fromFeedItemId: string | null = null
    try {
      const body = await request.json()
      if (typeof body.from_feed_item_id === 'string') fromFeedItemId = body.from_feed_item_id
    } catch {
      // body is optional
    }

    if (!fromFeedItemId) {
      const { data: state } = await supabase
        .from('user_feed_state')
        .select('last_seen_feed_item_id')
        .eq('user_id', session.userId)
        .maybeSingle()
      fromFeedItemId = state?.last_seen_feed_item_id ?? null
    }

    let currentPosition: number | null = null
    if (fromFeedItemId) {
      const { data: ref } = await supabase
        .from('feed_items')
        .select('position')
        .eq('id', fromFeedItemId)
        .eq('user_id', session.userId)
        .maybeSingle()
      currentPosition = ref?.position ?? null
    }

    // Delete future feed_items (past the reading cursor) that the user hasn't rated.
    // Rated chunks stay so their rating data remains coherent.
    const { data: rated } = await supabase
      .from('chunk_ratings')
      .select('chunk_id')
      .eq('user_id', session.userId)

    const ratedChunkIds = (rated || []).map((r) => r.chunk_id)

    let deleteQuery = supabase
      .from('feed_items')
      .delete()
      .eq('user_id', session.userId)

    if (currentPosition !== null) {
      deleteQuery = deleteQuery.gt('position', currentPosition)
    }

    if (ratedChunkIds.length > 0) {
      deleteQuery = deleteQuery.not('chunk_id', 'in', `(${ratedChunkIds.join(',')})`)
    }

    await deleteQuery

    // Clear the pre-scored queue entirely so it gets re-scored from scratch
    await supabase.from('feed_queue').delete().eq('user_id', session.userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reroll feed' },
      { status: 500 }
    )
  }
}
