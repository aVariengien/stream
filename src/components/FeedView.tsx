'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChunkCard, FeedChunk } from './ChunkCard'

type FeedViewProps = {
  onDoneWithSource: (articleId: string) => Promise<void>
  onViewDocument: (item: FeedChunk, seenChunks: string[]) => void
}

type FeedResponse = {
  items: FeedChunk[]
  queueEmpty?: boolean
  showExploreFlag?: boolean
}

export function FeedView({ onDoneWithSource, onViewDocument }: FeedViewProps) {
  const [items, setItems] = useState<FeedChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [showExploreFlag, setShowExploreFlag] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const replenishInFlight = useRef(false)

  const replenish = useCallback(async () => {
    if (replenishInFlight.current) return
    replenishInFlight.current = true
    try {
      await fetch('/api/feed/replenish', { method: 'POST' })
    } finally {
      replenishInFlight.current = false
    }
  }, [])

  const fetchBatch = useCallback(async (): Promise<FeedResponse> => {
    const res = await fetch('/api/feed')
    const payload = await res.json()
    if (!res.ok) {
      throw new Error(payload.error || 'Failed to fetch feed')
    }
    return payload as FeedResponse
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setError('')

    try {
      let payload = await fetchBatch()
      if (!payload.items || payload.items.length === 0) {
        await replenish()
        payload = await fetchBatch()
      }

      if (typeof payload.showExploreFlag === 'boolean') {
        setShowExploreFlag(payload.showExploreFlag)
      }

      if (!payload.items || payload.items.length === 0) {
        setHasMore(false)
      } else {
        setItems((prev) => [...prev, ...payload.items])
        void replenish()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [fetchBatch, hasMore, loadingMore, replenish])

  useEffect(() => {
    const run = async () => {
      await replenish()
      await loadMore()
      void replenish()
    }
    void run()
  }, [loadMore, replenish])

  useEffect(() => {
    const onScroll = () => {
      const documentHeight = document.documentElement.scrollHeight
      const scrolled = window.scrollY + window.innerHeight
      const ratio = documentHeight > 0 ? scrolled / documentHeight : 0

      if (ratio > 0.6) {
        void replenish()
      }
      if (ratio > 0.92 && !loadingMore) {
        void loadMore()
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [loadMore, loadingMore, replenish])

  const handleRated = async (chunkId: string, rating: number, annotation?: string) => {
    const res = await fetch(`/api/chunks/${chunkId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, annotation }),
    })
    const payload = await res.json()
    if (!res.ok) {
      throw new Error(payload.error || 'Failed to save rating')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {loading && <p className="text-sm text-ash">Preparing your rain feed...</p>}
      {items.map((item) => (
        <ChunkCard
          key={item.chunk_id}
          item={item}
          showExploreFlag={showExploreFlag}
          onRated={handleRated}
          onDoneWithSource={onDoneWithSource}
          onViewDocument={(selected) => onViewDocument(selected, items.map((entry) => entry.content))}
        />
      ))}
      {loadingMore && <p className="text-sm text-ash">Loading more chunks...</p>}
      {!hasMore && !loading && <p className="text-sm text-ash">No more chunks available from active sources.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

