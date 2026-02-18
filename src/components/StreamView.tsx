'use client'

import { useCallback, useEffect, useState } from 'react'
import { Article } from '@/lib/supabase'
import { ArticleCard } from './ArticleCard'
import { AddLinkModal } from './AddLinkModal'
import { OceanModal } from './OceanModal'
import { AuthModal } from './AuthModal'
import { FeedView } from './FeedView'
import { Dashboard } from './Dashboard'
import { DocumentView } from './DocumentView'
import { FeedChunk } from './ChunkCard'
import { demoArticles } from '@/lib/demo-data'

type Tab = 'rain' | 'cloud' | 'ocean'

interface StreamViewProps {
  initialAuth: boolean
  initialUsername?: string
}

type DocumentState = {
  article: { id: string; title: string; url: string }
  focusChunk: string
  seenChunks: string[]
}

export function StreamView({ initialAuth, initialUsername }: StreamViewProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth)
  const [username, setUsername] = useState(initialUsername || '')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('rain')
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [oceanModal, setOceanModal] = useState<{ open: boolean; article: Article | null }>({
    open: false,
    article: null,
  })
  const [documentState, setDocumentState] = useState<DocumentState | null>(null)
  const [addingCount, setAddingCount] = useState(0)

  useEffect(() => {
    if (isAuthenticated) {
      void loadArticles()
    } else {
      const demo = demoArticles.map((a, i) => ({
        ...a,
        id: `demo-${i}`,
        created_at: new Date().toISOString(),
      })) as Article[]
      setArticles(demo)
      setLoading(false)
    }
  }, [isAuthenticated])

  const loadArticles = async () => {
    try {
      const res = await fetch('/api/articles')
      if (res.ok) {
        const data = await res.json()
        setArticles(data)
      } else if (res.status === 401) {
        setIsAuthenticated(false)
        setUsername('')
        setArticles([])
      }
    } catch (error) {
      console.error('Failed to load articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const addMultipleArticles = useCallback((urls: string[]) => {
    setAddingCount(urls.length)
    urls.forEach(async (url) => {
      try {
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        if (res.ok) {
          const article = await res.json()
          setArticles((prev) => [article, ...prev])
        }
      } catch (err) {
        console.error('Failed to add article:', url, err)
      } finally {
        setAddingCount((prev) => prev - 1)
      }
    })
  }, [])

  const moveToOcean = async (article: Article, finished: boolean, notes?: string, reason?: string) => {
    const res = await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ocean',
        finished,
        notes,
        unread_reason: reason,
      }),
    })

    if (res.ok) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id
            ? {
                ...a,
                status: 'ocean',
                finished,
                notes,
                unread_reason: reason,
                moved_to_ocean_at: new Date().toISOString(),
              }
            : a
        )
      )
    }
  }

  const deleteArticle = async (article: Article) => {
    const res = await fetch(`/api/articles/${article.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setArticles((prev) => prev.filter((a) => a.id !== article.id))
    }
  }

  const cloudArticles = articles.filter((a) => a.status === 'cloud')
  const oceanArticles = articles.filter((a) => a.status === 'ocean')

  return (
    <div className="min-h-screen bg-paper">
      <AuthModal
        isOpen={showAuthModal}
        onSuccess={(user) => {
          setIsAuthenticated(true)
          setUsername(user)
          setShowAuthModal(false)
        }}
        onClose={() => setShowAuthModal(false)}
      />
      <Dashboard isOpen={showDashboard} onClose={() => setShowDashboard(false)} />

      {documentState && (
        <DocumentView
          article={documentState.article}
          focusChunk={documentState.focusChunk}
          seenChunks={documentState.seenChunks}
          onClose={() => setDocumentState(null)}
        />
      )}

      <header className="border-b border-warmLine bg-card px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">STREAM</h1>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-ash">@{username}</span>
              <button
                onClick={() => setShowDashboard(true)}
                className="rounded-full border border-warmLine px-3 py-2 text-xs text-ash hover:border-teal hover:text-ink"
              >
                Dashboard
              </button>
              <button
                onClick={() => setAddModalOpen(true)}
                className="rounded-full border border-teal bg-teal px-4 py-2 text-xs text-paper hover:bg-paper hover:text-teal"
              >
                + Add Link
              </button>
              <button
                onClick={async () => {
                  await fetch('/api/auth', { method: 'DELETE' })
                  setIsAuthenticated(false)
                  setUsername('')
                  setArticles([])
                }}
                className="text-xs text-ash hover:text-ink"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full border border-warmLine px-3 py-2 text-xs text-ash hover:border-teal hover:text-ink"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <nav className="border-b border-warmLine px-6">
        <div className="mx-auto flex max-w-6xl gap-8">
          {(['rain', 'cloud', 'ocean'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-4 text-xs uppercase tracking-wider ${
                activeTab === tab ? 'text-ink' : 'text-ash hover:text-ink'
              }`}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal" />}
            </button>
          ))}
        </div>
      </nav>

      {!isAuthenticated && (
        <div className="border-b border-warmLine bg-paper px-6 py-3">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs text-ash">
              Demo mode: sign in to enable rain scoring, ratings, and dashboard controls.
            </p>
          </div>
        </div>
      )}

      <main className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="py-20 text-center text-sm text-ash">Loading...</div>
          ) : activeTab === 'rain' ? (
            isAuthenticated ? (
              <FeedView
                onDoneWithSource={async (articleId) => {
                  const article = articles.find((a) => a.id === articleId)
                  if (article) {
                    await moveToOcean(article, true)
                  }
                }}
                onViewDocument={(item: FeedChunk, seenChunks: string[]) =>
                  setDocumentState({
                    article: {
                      id: item.article_id,
                      title: item.article_title,
                      url: item.article_url,
                    },
                    focusChunk: item.content,
                    seenChunks,
                  })
                }
              />
            ) : (
              <div className="rounded-2xl border border-warmLine bg-card p-6 text-sm text-ash">
                Rain feed requires sign in because it uses personalized scoring and ratings.
              </div>
            )
          ) : activeTab === 'cloud' ? (
            cloudArticles.length === 0 ? (
              <div className="py-20 text-center text-sm text-ash">No active sources in cloud.</div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {cloudArticles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
                    onMoveToOcean={(finished, notes, reason) => moveToOcean(article, finished, notes, reason)}
                    onDelete={() => deleteArticle(article)}
                    isDemo={!isAuthenticated}
                    activeTab="cloud"
                  />
                ))}
              </div>
            )
          ) : oceanArticles.length === 0 ? (
            <div className="py-20 text-center text-sm text-ash">The ocean awaits.</div>
          ) : (
            <div className="flex max-w-3xl flex-col gap-4">
              {oceanArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
                  onDelete={() => deleteArticle(article)}
                  isDemo={!isAuthenticated}
                  activeTab="ocean"
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {addingCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50 rounded-full border border-teal bg-card px-4 py-2 text-xs text-ink shadow">
          Adding {addingCount} link{addingCount !== 1 ? 's' : ''}...
        </div>
      )}

      <AddLinkModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} onAdd={addMultipleArticles} />

      <OceanModal
        isOpen={oceanModal.open}
        articleTitle={oceanModal.article?.title || ''}
        onClose={() => setOceanModal({ open: false, article: null })}
        onSubmit={async (finished, notes, reason) => {
          if (oceanModal.article) {
            await moveToOcean(oceanModal.article, finished, notes, reason)
            setOceanModal({ open: false, article: null })
          }
        }}
      />
    </div>
  )
}

