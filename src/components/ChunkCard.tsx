'use client'

import { useMemo, useState } from 'react'
import { marked } from 'marked'

export type FeedChunk = {
  chunk_id: string
  article_id: string
  article_title: string
  article_url: string
  chunk_index: number
  content: string
  predicted_score: number
  was_explore: boolean
}

type ChunkCardProps = {
  item: FeedChunk
  showExploreFlag: boolean
  onRated: (chunkId: string, rating: number, annotation?: string) => Promise<void>
  onDoneWithSource: (articleId: string) => Promise<void>
  onViewDocument: (item: FeedChunk) => void
}

export function ChunkCard({
  item,
  showExploreFlag,
  onRated,
  onDoneWithSource,
  onViewDocument,
}: ChunkCardProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [annotation, setAnnotation] = useState('')
  const [savingRating, setSavingRating] = useState(false)
  const [showAnnotation, setShowAnnotation] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [context, setContext] = useState('')
  const [contextLoading, setContextLoading] = useState(false)
  const [error, setError] = useState('')

  const domain = useMemo(() => {
    try {
      return new URL(item.article_url).hostname.replace('www.', '')
    } catch {
      return item.article_url
    }
  }, [item.article_url])

  const html = useMemo(() => marked.parse(item.content, { async: false }) as string, [item.content])

  const submitRating = async (value: number) => {
    if (rating !== null || savingRating) return
    setSavingRating(true)
    setError('')
    try {
      await onRated(item.chunk_id, value, annotation.trim() || undefined)
      setRating(value)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save rating')
    } finally {
      setSavingRating(false)
    }
  }

  const loadContext = async () => {
    if (contextLoading || context) return
    setContextLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/chunks/${item.chunk_id}/context`)
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load context')
      }
      setContext(payload.context || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load context')
    } finally {
      setContextLoading(false)
    }
  }

  return (
    <article className="rounded-2xl border border-warmLine bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">{item.article_title}</p>
          <p className="text-xs text-ash">{domain}</p>
        </div>
        {showExploreFlag && item.was_explore && (
          <span className="rounded-full border border-teal/40 bg-teal/10 px-2 py-1 text-[10px] uppercase tracking-wide text-teal">
            explore
          </span>
        )}
      </div>

      <div className="article-content text-[1rem]" dangerouslySetInnerHTML={{ __html: html }} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => submitRating(value)}
            disabled={rating !== null || savingRating}
            className={`h-8 w-8 rounded-full border text-sm transition ${
              rating !== null && value <= rating
                ? 'border-teal bg-teal text-paper'
                : 'border-warmLine bg-paper text-ash hover:border-teal hover:text-ink'
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {value}
          </button>
        ))}
        {rating !== null && <span className="text-xs text-ash">Saved ({rating}/5)</span>}
      </div>

      <div className="mt-3">
        {!showAnnotation ? (
          <button
            onClick={() => setShowAnnotation(true)}
            disabled={rating !== null}
            className="text-xs text-ash underline underline-offset-2 hover:text-ink disabled:no-underline"
          >
            Add note
          </button>
        ) : (
          <textarea
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            placeholder="Optional annotation..."
            disabled={rating !== null}
            className="w-full rounded-xl border border-warmLine bg-paper px-3 py-2 text-sm focus:border-teal focus:outline-none"
            rows={2}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setShowContext((prev) => !prev)
            if (!showContext) void loadContext()
          }}
          className="rounded-full border border-warmLine px-3 py-1 text-xs text-ash hover:border-teal hover:text-ink"
        >
          {showContext ? 'Hide context' : 'Show context'}
        </button>
        <button
          onClick={() => onViewDocument(item)}
          className="rounded-full border border-warmLine px-3 py-1 text-xs text-ash hover:border-teal hover:text-ink"
        >
          View in document
        </button>
        <button
          onClick={() => onDoneWithSource(item.article_id)}
          className="rounded-full border border-warmLine px-3 py-1 text-xs text-ash hover:border-teal hover:text-ink"
        >
          Done with source
        </button>
      </div>

      {showContext && (
        <div className="mt-4 rounded-xl border border-warmLine bg-paper px-4 py-3 text-sm text-ink">
          {contextLoading && <p className="text-ash">Generating context...</p>}
          {!contextLoading && context && <pre className="whitespace-pre-wrap font-sans">{context}</pre>}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </article>
  )
}

