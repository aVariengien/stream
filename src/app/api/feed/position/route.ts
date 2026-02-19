import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const feedItemId = typeof body.feed_item_id === 'string' ? body.feed_item_id : null

    const supabase = getSupabase()

    if (feedItemId) {
      const { data: belongsToUser } = await supabase
        .from('feed_items')
        .select('id')
        .eq('id', feedItemId)
        .eq('user_id', session.userId)
        .maybeSingle()
      if (!belongsToUser) {
        return NextResponse.json({ error: 'Invalid feed item' }, { status: 400 })
      }
    }

    const { error } = await supabase.from('user_feed_state').upsert({
      user_id: session.userId,
      last_seen_feed_item_id: feedItemId,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

