import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const rating = Number(body.rating)
    const annotation = typeof body.annotation === 'string' ? body.annotation.trim() : null

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer from 1 to 5' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data: shown } = await supabase
      .from('feed_items')
      .select('predicted_score, was_explore')
      .eq('user_id', session.userId)
      .eq('chunk_id', id)
      .maybeSingle()

    if (!shown) {
      return NextResponse.json({ error: 'Chunk was not shown to this user' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('chunk_ratings')
      .select('id, rating')
      .eq('user_id', session.userId)
      .eq('chunk_id', id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Chunk already rated' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('chunk_ratings')
      .insert({
        chunk_id: id,
        user_id: session.userId,
        rating,
        annotation: annotation || null,
        predicted_score: shown.predicted_score,
        was_explore: shown.was_explore,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

