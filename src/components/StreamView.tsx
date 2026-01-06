'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { marked } from 'marked'
import { Article } from '@/lib/supabase'
import { ArticleCard } from './ArticleCard'
import { AddLinkModal } from './AddLinkModal'
import { OceanModal } from './OceanModal'
import { AuthModal } from './AuthModal'
import { demoArticles } from '@/lib/demo-data'
import { getCachedContent, setCachedContent, getScrollPosition, setScrollPosition } from '@/lib/content-cache'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
})

type Tab = 'cloud' | 'river' | 'ocean'

interface StreamViewProps {
  initialAuth: boolean
  initialUsername?: string
}

export function StreamView({ initialAuth, initialUsername }: StreamViewProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth)
  const [username, setUsername] = useState(initialUsername || '')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('river')
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [oceanModal, setOceanModal] = useState<{ open: boolean; article: Article | null }>({
    open: false,
    article: null,
  })
  const [readingArticle, setReadingArticle] = useState<Article | null>(null)

  // Load articles
  useEffect(() => {
    if (isAuthenticated) {
      loadArticles()
    } else {
      // Load demo articles
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
        // Session expired or invalid - switch to demo mode
        setIsAuthenticated(false)
        setUsername('')
        const demo = demoArticles.map((a, i) => ({
          ...a,
          id: `demo-${i}`,
          created_at: new Date().toISOString(),
        })) as Article[]
        setArticles(demo)
      }
    } catch (error) {
      console.error('Failed to load articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const [addingCount, setAddingCount] = useState(0)

  // Add articles in background
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

  const moveToRiver = async (article: Article) => {
    const riverCount = articles.filter((a) => a.status === 'river').length
    if (riverCount >= 5) {
      alert('River is full! Move an article to Ocean first.')
      return
    }

    const res = await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'river' }),
    })

    if (res.ok) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id ? { ...a, status: 'river', moved_to_river_at: new Date().toISOString() } : a
        )
      )
      setActiveTab('river')
    }
  }

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

  const moveBackToRiver = async (article: Article) => {
    const riverCount = articles.filter((a) => a.status === 'river').length
    if (riverCount >= 5) {
      alert('River is full! Move an article to Ocean first.')
      return
    }

    const res = await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'river', moved_to_river_at: new Date().toISOString() }),
    })

    if (res.ok) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id ? { ...a, status: 'river', moved_to_river_at: new Date().toISOString() } : a
        )
      )
      setActiveTab('river')
    }
  }

  const moveToCloud = async (article: Article) => {
    const res = await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cloud' }),
    })

    if (res.ok) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id ? { ...a, status: 'cloud' } : a
        )
      )
      setActiveTab('cloud')
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

  const filteredArticles = articles.filter((a) => a.status === activeTab)
  const riverCount = articles.filter((a) => a.status === 'river').length

  if (readingArticle) {
    return (
      <>
        <ReaderView
          article={readingArticle}
          onBack={() => setReadingArticle(null)}
          onMoveToOcean={() => {
            setOceanModal({ open: true, article: readingArticle })
          }}
          onProgressUpdate={async (progress) => {
            await fetch(`/api/articles/${readingArticle.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reading_progress: progress }),
            })
            setArticles((prev) =>
              prev.map((a) =>
                a.id === readingArticle.id ? { ...a, reading_progress: progress } : a
              )
            )
          }}
          isDemo={!isAuthenticated}
        />
        
        {/* Ocean Modal - also rendered in reader view */}
        <OceanModal
          isOpen={oceanModal.open}
          articleTitle={oceanModal.article?.title || ''}
          onClose={() => setOceanModal({ open: false, article: null })}
          onSubmit={async (finished, notes, reason) => {
            if (oceanModal.article) {
              await moveToOcean(oceanModal.article, finished, notes, reason)
              setOceanModal({ open: false, article: null })
              setReadingArticle(null)
            }
          }}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen">
      <AuthModal 
        isOpen={showAuthModal} 
        onSuccess={(user) => {
          setIsAuthenticated(true)
          setUsername(user)
          setShowAuthModal(false)
        }}
        onClose={() => setShowAuthModal(false)}
      />
      
      {/* Header */}
      <header className="border-b border-ink/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-sm font-medium tracking-wide">STREAM</h1>
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-ash">@{username}</span>
              <button
                onClick={() => setAddModalOpen(true)}
                className="text-xs border border-ink/20 px-4 py-2 hover:border-ink hover:bg-ink hover:text-paper transition-colors"
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
                className="text-xs text-ash hover:text-ink transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-ink/10 px-6">
        <div className="max-w-6xl mx-auto flex gap-8">
          {(['cloud', 'river', 'ocean'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-xs uppercase tracking-wider transition-colors relative ${
                activeTab === tab ? 'text-ink' : 'text-ash hover:text-ink'
              }`}
            >
              {tab}
              {tab === 'river' && (
                <span className="ml-2 text-[10px] text-ash">
                  {riverCount}/5
                </span>
              )}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-px bg-ink" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Demo banner */}
      {!isAuthenticated && (
        <div className="bg-smoke/50 border-b border-ink/10 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <p className="text-xs text-ash">
              You're viewing a demo. Sign in or create an account to start your reading flow.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs underline underline-offset-2"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-4 h-4 border border-ink/30 border-t-ink rounded-full animate-spin" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-ash text-sm">
                {activeTab === 'cloud' && "No articles in your cloud. Add some links to get started."}
                {activeTab === 'river' && "Your river is empty. Move articles from the cloud to start reading."}
                {activeTab === 'ocean' && "The ocean awaits. Finished articles will appear here."}
              </p>
            </div>
          ) : (
            <div className={`${
              activeTab === 'ocean'
                ? 'flex flex-col gap-4 max-w-3xl'
                : `grid gap-6 ${
                    activeTab === 'river' 
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' 
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  }`
            }`}>
              {filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => setReadingArticle(article)}
                  onMoveToRiver={() => activeTab === 'ocean' ? moveBackToRiver(article) : moveToRiver(article)}
                  onMoveToCloud={() => moveToCloud(article)}
                  onMoveToOcean={(finished, notes, reason) => moveToOcean(article, finished, notes, reason)}
                  onDelete={() => deleteArticle(article)}
                  isDemo={!isAuthenticated}
                  activeTab={activeTab}
                />
              ))}
              
            </div>
          )}
          
        </div>
      </main>

      {/* Adding indicator */}
      {addingCount > 0 && (
        <div className="fixed bottom-6 right-6 bg-ink text-paper px-4 py-2 text-xs flex items-center gap-2 z-50">
          <div className="w-3 h-3 border border-paper/30 border-t-paper rounded-full animate-spin" />
          Adding {addingCount} link{addingCount !== 1 ? 's' : ''}...
        </div>
      )}

      {/* Modals */}
      <AddLinkModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={addMultipleArticles}
      />
      
      <OceanModal
        isOpen={oceanModal.open}
        articleTitle={oceanModal.article?.title || ''}
        onClose={() => setOceanModal({ open: false, article: null })}
        onSubmit={async (finished, notes, reason) => {
          if (oceanModal.article) {
            await moveToOcean(oceanModal.article, finished, notes, reason)
            setReadingArticle(null)
          }
        }}
      />
    </div>
  )
}

// Reader View component
function ReaderView({
  article,
  onBack,
  onMoveToOcean,
  onProgressUpdate,
  isDemo,
}: {
  article: Article
  onBack: () => void
  onMoveToOcean: () => void
  onProgressUpdate: (progress: number) => void
  isDemo: boolean
}) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentProgress, setCurrentProgress] = useState(article.reading_progress)
  const hasScrolledToPosition = useRef(false)

  // Fetch content - check cache first
  useEffect(() => {
    const fetchContent = async () => {
      // Check localStorage cache first
      const cached = getCachedContent(article.url)
      if (cached) {
        setContent(cached)
        setLoading(false)
        return
      }

      // Fetch from API
      try {
        const res = await fetch(`/api/jina?url=${encodeURIComponent(article.url)}`)
        if (res.ok) {
          const data = await res.json()
          setContent(data.content)
          // Cache the content
          setCachedContent(article.url, data.content)
        } else {
          setError('Failed to load article content')
        }
      } catch {
        setError('Failed to load article content')
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [article.url])

  // Scroll to saved position after content loads
  useEffect(() => {
    if (!content || hasScrolledToPosition.current) return
    
    // Wait for content to render
    const timer = setTimeout(() => {
      // Get saved scroll position from localStorage (exact position, not progress)
      const savedScrollPosition = getScrollPosition(article.id)
      if (savedScrollPosition > 0) {
        window.scrollTo({ top: savedScrollPosition, behavior: 'smooth' })
      }
      hasScrolledToPosition.current = true
    }, 100)

    return () => clearTimeout(timer)
  }, [content, article.id])

  // Track scroll progress and save position
  useEffect(() => {
    if (!content) return

    let ticking = false
    let lastSavedProgress = article.reading_progress
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.scrollY
          const docHeight = document.documentElement.scrollHeight - window.innerHeight
          const progress = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0
          
          // Always update local display
          setCurrentProgress(progress)
          
          // Always save scroll position to localStorage (for exact restoration)
          if (!isDemo) {
            setScrollPosition(article.id, scrollTop)
          }
          
          // Save current progress to server (so thumbnail matches reader)
          if (!isDemo && progress !== lastSavedProgress) {
            lastSavedProgress = progress
            onProgressUpdate(progress)
          }
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [content, onProgressUpdate, isDemo, article.id])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b border-ink/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-xs text-ash hover:text-ink transition-colors flex items-center gap-2"
          >
            ← Back
          </button>
          
          {!isDemo && (
            <button
              onClick={onMoveToOcean}
              className="text-xs border border-ink/20 px-4 py-2 hover:border-ink transition-colors"
            >
              Move to Ocean →
            </button>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink/10">
          <div 
            className="h-full bg-ink transition-all duration-150"
            style={{ width: `${currentProgress}%` }}
          />
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-12">
        <article className="max-w-3xl mx-auto">
          <header className="mb-12">
            <h1 className="text-3xl font-medium leading-tight mb-4">
              {article.title}
            </h1>
            <p className="text-sm text-ash">
              {new URL(article.url).hostname.replace('www.', '')}
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ash hover:text-ink transition-colors underline underline-offset-2"
            >
              View original →
            </a>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-4 h-4 border border-ink/30 border-t-ink rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-ash text-sm mb-4">{error}</p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline underline-offset-2"
              >
                Open article in new tab
              </a>
            </div>
          ) : (
            <div 
              className="article-content"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(content || '') }}
            />
          )}
        </article>
      </main>
    </div>
  )
}

// Convert markdown to HTML using marked
function formatMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string
}

