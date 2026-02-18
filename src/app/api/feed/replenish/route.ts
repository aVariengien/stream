import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { getOrCreateSettings } from '@/lib/settings'
import { scoreChunksBatch } from '@/lib/cerebras'

type Candidate = {
  id: string
  content: string
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()
    const settings = await getOrCreateSettings(session.userId)

    const { count: queueCount } = await supabase
      .from('feed_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)

    if ((queueCount || 0) >= settings.feed_batch_size) {
      return NextResponse.json({ replenished: false, queueSize: queueCount || 0 })
    }

    const { data: cloudArticles } = await supabase
      .from('articles')
      .select('id')
      .eq('user_id', session.userId)
      .eq('status', 'cloud')

    const articleIds = (cloudArticles || []).map((a) => a.id)
    if (articleIds.length === 0) {
      return NextResponse.json({ replenished: false, queueSize: queueCount || 0, reason: 'no_active_sources' })
    }

    const [{ data: shown }, { data: queued }, { data: rated }] = await Promise.all([
      supabase.from('feed_items').select('chunk_id').eq('user_id', session.userId),
      supabase.from('feed_queue').select('chunk_id').eq('user_id', session.userId),
      supabase.from('chunk_ratings').select('chunk_id').eq('user_id', session.userId),
    ])

    const excluded = new Set<string>([
      ...(shown || []).map((r) => r.chunk_id),
      ...(queued || []).map((r) => r.chunk_id),
      ...(rated || []).map((r) => r.chunk_id),
    ])

    const { data: rawCandidates } = await supabase
      .from('chunks')
      .select('id, content')
      .eq('user_id', session.userId)
      .in('article_id', articleIds)
      .order('created_at', { ascending: false })
      .limit(Math.max(settings.candidate_pool_size * 4, 300))

    const filteredCandidates = (rawCandidates || []).filter((c) => !excluded.has(c.id))
    const selectedCandidates = shuffle(filteredCandidates).slice(0, settings.candidate_pool_size) as Candidate[]

    if (selectedCandidates.length === 0) {
      return NextResponse.json({ replenished: false, queueSize: queueCount || 0, reason: 'no_candidates' })
    }

    const { data: ratings } = await supabase
      .from('chunk_ratings')
      .select('chunk_id, rating, annotation, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(settings.num_few_shot)

    const fewShotChunkIds = (ratings || []).map((r) => r.chunk_id)
    let fewShotMap = new Map<string, string>()

    if (fewShotChunkIds.length > 0) {
      const { data: fewShotChunks } = await supabase.from('chunks').select('id, content').in('id', fewShotChunkIds)
      fewShotMap = new Map((fewShotChunks || []).map((row) => [row.id, row.content]))
    }

    const examples = (ratings || [])
      .map((rating) => ({
        content: fewShotMap.get(rating.chunk_id) || '',
        rating: rating.rating,
        annotation: rating.annotation,
      }))
      .filter((r) => r.content)

    let scored = selectedCandidates.map((chunk) => ({ id: chunk.id, score: Math.random() * 4 + 1 }))
    if (examples.length > 0) {
      const batches = chunkArray(selectedCandidates, settings.scoring_batch_size)
      const scoreResults = await Promise.all(
        batches.map((batch) => scoreChunksBatch(batch, examples, settings.scoring_model))
      )
      scored = scoreResults.flat()
    }

    scored.sort((a, b) => b.score - a.score)
    const batchSize = Math.min(settings.feed_batch_size, scored.length)
    const exploitCount = Math.max(0, Math.min(batchSize, Math.round((1 - settings.explore_ratio) * batchSize)))
    const exploreCount = Math.max(0, batchSize - exploitCount)

    const top = scored.slice(0, exploitCount)
    const remainder = scored.slice(exploitCount)
    const randomRemainder = shuffle(remainder).slice(0, exploreCount)

    const queueRows = [
      ...top.map((row) => ({
        chunk_id: row.id,
        user_id: session.userId,
        predicted_score: row.score,
        was_explore: false,
      })),
      ...randomRemainder.map((row) => ({
        chunk_id: row.id,
        user_id: session.userId,
        predicted_score: row.score,
        was_explore: true,
      })),
    ]

    if (queueRows.length > 0) {
      await supabase.from('feed_queue').upsert(queueRows, { onConflict: 'user_id,chunk_id', ignoreDuplicates: true })
    }

    const { count: finalQueueCount } = await supabase
      .from('feed_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)

    return NextResponse.json({
      replenished: true,
      added: queueRows.length,
      queueSize: finalQueueCount || 0,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to replenish feed' },
      { status: 500 }
    )
  }
}

