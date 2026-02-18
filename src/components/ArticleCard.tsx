'use client'

import { Article } from '@/lib/supabase'
import { MeshGradient, urlToSeed } from './MeshGradient'
import Image from 'next/image'
import { useState } from 'react'

interface ArticleCardProps {
  article: Article | { 
    id: string
    url: string
    title: string
    description?: string
    image_url?: string
    generated_image_url?: string
    gradient_seed?: number
    status: 'cloud' | 'ocean'
    reading_progress: number
    notes?: string
    unread_reason?: string
    finished?: boolean
    created_at?: string
    moved_to_ocean_at?: string
  }
  onClick?: () => void
  onMoveToOcean?: (finished: boolean, notes?: string, reason?: string) => void
  onDelete?: () => void
  showActions?: boolean
  isDemo?: boolean
  activeTab?: 'cloud' | 'ocean'
}

function formatDate(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

export function ArticleCard({
  article,
  onClick,
  onMoveToOcean,
  onDelete,
  showActions = true,
  isDemo = false,
  activeTab = 'cloud',
}: ArticleCardProps) {
  const [imageError, setImageError] = useState(false)
  const seed = article.gradient_seed ?? urlToSeed(article.url)
  
  // Use OG image, or generated image, or fallback to mesh gradient
  const imageUrl = article.image_url || (article as Article).generated_image_url
  const hasImage = imageUrl && !imageError
  
  // Get the appropriate date based on current tab
  const getDisplayDate = () => {
    const art = article as Article
    switch (activeTab) {
      case 'cloud':
        return art.created_at ? `Added ${formatDate(art.created_at)}` : ''
      case 'ocean':
        return art.moved_to_ocean_at ? `Archived ${formatDate(art.moved_to_ocean_at)}` : ''
      default:
        return ''
    }
  }
  
  const displayDate = getDisplayDate()
  const isOcean = activeTab === 'ocean'
  
  // Horizontal layout for Ocean articles
  if (isOcean) {
    return (
      <article 
        className="group relative border border-ink/10 bg-paper hover:border-ink/30 transition-all duration-300 cursor-pointer flex"
        onClick={onClick}
        tabIndex={0}
        role="button"
        aria-label={`Read ${article.title}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        }}
      >
        {/* Square Thumbnail on left */}
        <div className="w-32 h-32 sm:w-40 sm:h-40 relative overflow-hidden shrink-0">
          {hasImage ? (
            <Image
              src={imageUrl!}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImageError(true)}
              sizes="160px"
            />
          ) : (
            <MeshGradient seed={seed} className="w-full h-full" />
          )}
        </div>
        
        {/* Content on right */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div className="space-y-2">
            <h3 className="font-medium text-sm leading-tight group-hover:underline underline-offset-2">
              {article.title}
            </h3>
            
            <p className="text-xs text-ash">
              {(article as Article).finished ? '✓ Finished' : `✗ Didn't finish${(article as Article).unread_reason ? `: ${(article as Article).unread_reason}` : ''}`}
            </p>
            
            {article.notes && (
              <p className="text-xs text-ash/70 italic">
                "{article.notes}"
              </p>
            )}
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-3">
            <p className="text-[10px] text-ash/60 truncate">
              {new URL(article.url).hostname.replace('www.', '')}
            </p>
            {displayDate && (
              <p className="text-[10px] text-ash/40 shrink-0">
                {displayDate}
              </p>
            )}
          </div>
        </div>
        
        {/* Actions - right side buttons */}
        {showActions && !isDemo && (
          <div className="absolute right-2 top-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this article?')) {
                    onDelete()
                  }
                }}
                className="w-7 h-7 flex items-center justify-center bg-paper border border-ink/20 text-ash hover:text-ink hover:border-ink transition-all"
                aria-label="Delete article"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
            {onMoveToOcean && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveToOcean(true)
                }}
                className="w-7 h-7 flex items-center justify-center bg-paper border border-ink/20 text-ash hover:text-ink hover:border-ink transition-all text-xs"
                aria-label="Move to ocean"
                title="Move to ocean"
              >
                ⇢
              </button>
            )}
          </div>
        )}
      </article>
    )
  }
  
  // Vertical layout for Cloud articles
  return (
    <article 
      className="group relative border border-ink/10 bg-paper hover:border-ink/30 transition-all duration-300 cursor-pointer"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Read ${article.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {/* Delete button */}
      {showActions && !isDemo && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Delete this article?')) {
              onDelete()
            }
          }}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-paper/80 border border-ink/20 text-ash hover:text-ink hover:border-ink opacity-0 group-hover:opacity-100 transition-all duration-200"
          aria-label="Delete article"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Thumbnail */}
      <div className="aspect-[4/3] relative overflow-hidden">
        {hasImage ? (
          <Image
            src={imageUrl!}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <MeshGradient seed={seed} className="w-full h-full" />
        )}
        
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:underline underline-offset-2">
          {article.title}
        </h3>
        
        {article.description && (
          <p className="text-xs text-ash line-clamp-2">
            {article.description}
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-ash/60 truncate">
            {new URL(article.url).hostname.replace('www.', '')}
          </p>
          {displayDate && (
            <p className="text-[10px] text-ash/40 shrink-0">
              {displayDate}
            </p>
          )}
        </div>
      </div>
      
      {/* Actions overlay (only when not demo) */}
      {showActions && !isDemo && (
        <div className="absolute inset-0 bg-paper/90 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Read button - always available */}
          <button
            onClick={onClick}
            className="px-4 py-2 text-xs border border-ink bg-ink text-paper hover:bg-paper hover:text-ink transition-colors"
          >
            Read
          </button>
          
          {/* Move to Ocean - for cloud articles */}
          {article.status === 'cloud' && onMoveToOcean && (
            <button
              onClick={() => onMoveToOcean(true)}
              className="px-4 py-2 text-xs border border-ink bg-paper hover:bg-ink hover:text-paper transition-colors"
            >
              → Ocean
            </button>
          )}
        </div>
      )}
    </article>
  )
}
