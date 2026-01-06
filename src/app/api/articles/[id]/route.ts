import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function PATCH(
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

    const updates: Record<string, unknown> = {}

    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === 'river') {
        updates.moved_to_river_at = new Date().toISOString()
      } else if (body.status === 'ocean') {
        updates.moved_to_ocean_at = new Date().toISOString()
      }
    }

    if (body.reading_progress !== undefined) {
      updates.reading_progress = body.reading_progress
    }

    if (body.finished !== undefined) {
      updates.finished = body.finished
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes
    }

    if (body.unread_reason !== undefined) {
      updates.unread_reason = body.unread_reason
    }

    // Only update articles belonging to this user
    const { data, error } = await getSupabase()
      .from('articles')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Only delete articles belonging to this user
    const { error } = await getSupabase()
      .from('articles')
      .delete()
      .eq('id', id)
      .eq('user_id', session.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
