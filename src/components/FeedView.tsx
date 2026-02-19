'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChunkCard, FeedChunk } from './ChunkCard'

type FeedViewProps = {
  onDoneWithSource: (articleId: string) => Promise<void>
  onViewDocument: (item: FeedChunk, seenChunks: string[]) => void
}

type FeedResponse = {
  items: FeedChunk[]
  hasMore?: boolean
  hasBefore?: boolean
  showExploreFlag?: boolean
}

export function FeedView({ onDoneWithSource, onViewDocument }: FeedViewProps) {
  const [items, setItems] = useState<FeedChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBefore, setLoadingBefore] = useState(false)
  const [loadingAfter, setLoadingAfter] = useState(false)
  const [error, setError] = useState('')
  const [showExploreFlag, setShowExploreFlag] = useState(false)
  const [hasBefore, setHasBefore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const replenishInFlight = useRef(false)
  // Tracks which feed_item_id is at the top of the viewport (for position saving)
  const topItemIdRef = useRef<string | null>(null)
  // Used to preserve scroll position when items are prepended
  const scrollAnchorRef = useRef<{ id: string; docTop: number } | null>(null)

  const replenish = useCallback(async () => {
    if (replenishInFlight.current) return
    replenishInFlight.current = true
    try {
      await fetch('/api/feed/replenish', { method: 'POST' })
    } finally {
      replenishInFlight.current = false
    }
  }, [])

  // Save user's position (debounced to avoid spamming the API)
  const savePositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePosition = useCallback((feedItemId: string) => {
    if (savePositionTimer.current) clearTimeout(savePositionTimer.current)
    savePositionTimer.current = setTimeout(() => {
      void fetch('/api/feed/position', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_item_id: feedItemId }),
      })
    }, 800)
  }, [])

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      await replenish()
      setLoading(true)
      setError('')
      try {
        // No params → API resolves user's saved position automatically
        const res = await fetch('/api/feed')
        const payload: FeedResponse = await res.json()
        if (!res.ok) throw new Error((payload as { error?: string }).error || 'Failed to fetch feed')

        if (typeof payload.showExploreFlag === 'boolean') setShowExploreFlag(payload.showExploreFlag)
        setItems(payload.items ?? [])
        setHasBefore(payload.hasBefore ?? false)
        setHasMore(payload.hasMore ?? false)

        if ((payload.items ?? []).length > 0) void replenish()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load feed')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [replenish])

  // ── Load older items (above current top) ─────────────────────────────────
  const loadBefore = useCallback(async () => {
    if (loadingBefore || items.length === 0) return
    const firstItem = items[0]

    // Capture anchor before state update so we can restore scroll after prepend
    const anchorEl = document.querySelector(`[data-feed-item-id="${firstItem.feed_item_id}"]`)
    scrollAnchorRef.current = anchorEl
      ? { id: firstItem.feed_item_id, docTop: anchorEl.getBoundingClientRect().top + window.scrollY }
      : null

    setLoadingBefore(true)
    setError('')
    try {
      const res = await fetch(`/api/feed?before=${firstItem.feed_item_id}`)
      const payload: FeedResponse = await res.json()
      if (!res.ok) throw new Error((payload as { error?: string }).error || 'Failed to load earlier')

      const newItems = payload.items ?? []
      setHasBefore(payload.hasBefore ?? false)
      if (newItems.length > 0) {
        setItems((prev) => [...newItems, ...prev])
      }
    } catch (e) {
      scrollAnchorRef.current = null
      setError(e instanceof Error ? e.message : 'Failed to load earlier chunks')
    } finally {
      setLoadingBefore(false)
    }
  }, [items, loadingBefore])

  // After items are prepended, restore scroll so the anchor item stays in place
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current
    if (!anchor) return
    scrollAnchorRef.current = null

    const el = document.querySelector(`[data-feed-item-id="${anchor.id}"]`)
    if (!el) return

    const newDocTop = el.getBoundingClientRect().top + window.scrollY
    const delta = newDocTop - anchor.docTop
    if (delta !== 0) window.scrollBy(0, delta)
  }, [items])

  // ── Load newer items (scroll down) ───────────────────────────────────────
  const loadAfter = useCallback(async () => {
    if (loadingAfter || !hasMore || items.length === 0) return
    const lastItem = items[items.length - 1]

    setLoadingAfter(true)
    setError('')
    try {
      const res = await fetch(`/api/feed?after=${lastItem.feed_item_id}`)
      const payload: FeedResponse = await res.json()
      if (!res.ok) throw new Error((payload as { error?: string }).error || 'Failed to load more')

      const newItems = payload.items ?? []
      if (newItems.length === 0) {
        setHasMore(false)
      } else {
        setItems((prev) => [...prev, ...newItems])
        setHasMore(payload.hasMore ?? true)
        void replenish()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more chunks')
    } finally {
      setLoadingAfter(false)
    }
  }, [items, loadingAfter, hasMore, replenish])

  // ── Scroll handler: trigger load-after + replenish ────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight
      const scrolled = window.scrollY + window.innerHeight
      const ratio = docHeight > 0 ? scrolled / docHeight : 0

      if (ratio > 0.6) void replenish()
      if (ratio > 0.92 && !loadingAfter) void loadAfter()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [loadAfter, loadingAfter, replenish])

  // ── Track top-visible item for position saving ────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const cards = document.querySelectorAll<HTMLElement>('[data-feed-item-id]')
      for (const card of cards) {
        const rect = card.getBoundingClientRect()
        if (rect.top >= 0 && rect.top < window.innerHeight) {
          const id = card.dataset.feedItemId
          if (id && id !== topItemIdRef.current) {
            topItemIdRef.current = id
            savePosition(id)
          }
          break
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [savePosition])

  // Save position immediately when the tab is hidden (navigation, close, etc.)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && topItemIdRef.current) {
        void fetch('/api/feed/position', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feed_item_id: topItemIdRef.current }),
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const handleRated = async (chunkId: string, rating: number, annotation?: string) => {
    const res = await fetch(`/api/chunks/${chunkId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, annotation }),
    })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload.error || 'Failed to save rating')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {hasBefore && (
        <button
          onClick={() => void loadBefore()}
          disabled={loadingBefore}
          className="w-full py-2 text-sm text-ash border border-dashed border-ash rounded hover:text-sand hover:border-sand transition-colors disabled:opacity-50"
        >
          {loadingBefore ? 'Loading earlier…' : '↑ Load earlier chunks'}
        </button>
      )}

      {loading && <p className="text-sm text-ash">Preparing your rain feed…</p>}

      {items.map((item) => (
        <div key={item.feed_item_id} data-feed-item-id={item.feed_item_id}>
          <ChunkCard
            item={item}
            showExploreFlag={showExploreFlag}
            onRated={handleRated}
            onDoneWithSource={onDoneWithSource}
            onViewDocument={(selected) =>
              onViewDocument(
                selected,
                items.map((e) => e.content)
              )
            }
          />
        </div>
      ))}

      {loadingAfter && <p className="text-sm text-ash">Loading more chunks…</p>}

      {!hasMore && !loading && items.length === 0 && (
        <p className="text-sm text-ash">No chunks available from active sources.</p>
      )}
      {!hasMore && !loading && items.length > 0 && (
        <p className="text-sm text-ash">You're all caught up.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
