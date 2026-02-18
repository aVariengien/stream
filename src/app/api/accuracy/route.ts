import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

type AccuracyPoint = {
  date: string
  mae: number
}

function meanAbsoluteError(rows: Array<{ rating: number; predicted_score: number | null }>): number | null {
  const valid = rows.filter((r) => typeof r.predicted_score === 'number')
  if (valid.length === 0) return null
  const sum = valid.reduce((acc, row) => acc + Math.abs(row.rating - Number(row.predicted_score)), 0)
  return sum / valid.length
}

function buildTimeline(
  rows: Array<{ created_at: string; rating: number; predicted_score: number | null }>
): AccuracyPoint[] {
  const grouped = new Map<string, Array<{ rating: number; predicted_score: number | null }>>()
  for (const row of rows) {
    const key = row.created_at.slice(0, 10)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push({ rating: row.rating, predicted_score: row.predicted_score })
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      mae: meanAbsoluteError(values) || 0,
    }))
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabase()
    .from('chunk_ratings')
    .select('created_at, rating, predicted_score, was_explore')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data || []
  const exploreRows = rows.filter((r) => r.was_explore)
  const exploitRows = rows.filter((r) => !r.was_explore)

  return NextResponse.json({
    overallMae: meanAbsoluteError(rows),
    exploreMae: meanAbsoluteError(exploreRows),
    exploitMae: meanAbsoluteError(exploitRows),
    totalRatings: rows.length,
    exploreRatings: exploreRows.length,
    exploitRatings: exploitRows.length,
    timeline: {
      overall: buildTimeline(rows),
      explore: buildTimeline(exploreRows),
      exploit: buildTimeline(exploitRows),
    },
  })
}

