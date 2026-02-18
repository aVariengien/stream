'use client'

import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'

type DocumentViewProps = {
  article: {
    id: string
    title: string
    url: string
  }
  focusChunk: string
  seenChunks: string[]
  onClose: () => void
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightContent(markdown: string, focusChunk: string, seenChunks: string[]): string {
  let output = markdown
  const safeSeen = seenChunks
    .filter((chunk) => chunk && chunk.length > 40)
    .sort((a, b) => b.length - a.length)
    .slice(0, 40)

  for (const chunk of safeSeen) {
    const snippet = chunk.slice(0, 160).trim()
    if (!snippet) continue
    output = output.replace(
      new RegExp(escapeRegExp(snippet), 'g'),
      `<mark class="bg-mint/30 rounded px-1">${snippet}</mark>`
    )
  }

  const focusSnippet = focusChunk.slice(0, 180).trim()
  if (focusSnippet) {
    output = output.replace(
      new RegExp(escapeRegExp(focusSnippet)),
      `<mark id="focus-chunk-anchor" class="bg-salmon/40 rounded px-1">${focusSnippet}</mark>`
    )
  }

  return output
}

export function DocumentView({ article, focusChunk, seenChunks, onClose }: DocumentViewProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const response = await fetch(`/api/jina?url=${encodeURIComponent(article.url)}`)
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load document')
        }
        if (mounted) {
          setContent(payload.content || '')
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load document')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
  }, [article.url])

  const html = useMemo(() => {
    if (!content) return ''
    const withHighlights = highlightContent(content, focusChunk, seenChunks)
    return marked.parse(withHighlights, { async: false }) as string
  }, [content, focusChunk, seenChunks])

  useEffect(() => {
    if (!html) return
    const timer = setTimeout(() => {
      const anchor = document.getElementById('focus-chunk-anchor')
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [html])

  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <header className="sticky top-0 z-10 border-b border-warmLine bg-paper/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="rounded-full border border-warmLine px-3 py-1 text-xs text-ash hover:border-teal hover:text-ink"
          >
            Back
          </button>
          <h2 className="truncate text-sm font-semibold text-ink">{article.title}</h2>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-warmLine px-3 py-1 text-xs text-ash hover:border-teal hover:text-ink"
          >
            Open source
          </a>
        </div>
      </header>

      <main className="px-6 py-8">
        <article className="article-content mx-auto max-w-4xl rounded-2xl border border-warmLine bg-card p-8 shadow-sm">
          {loading && <p className="text-sm text-ash">Loading document...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && <div dangerouslySetInnerHTML={{ __html: html }} />}
        </article>
      </main>
    </div>
  )
}

