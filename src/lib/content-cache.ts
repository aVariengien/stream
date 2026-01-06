// LocalStorage cache for article markdown content

const CACHE_PREFIX = 'stream_article_'
const CACHE_VERSION = 'v1_'
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CachedContent {
  content: string
  timestamp: number
  url: string
}

function getCacheKey(url: string): string {
  // Create a simple hash from the URL for the key
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return `${CACHE_PREFIX}${CACHE_VERSION}${Math.abs(hash)}`
}

export function getCachedContent(url: string): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const key = getCacheKey(url)
    const cached = localStorage.getItem(key)
    
    if (!cached) return null
    
    const parsed: CachedContent = JSON.parse(cached)
    
    // Check if cache is still valid
    if (Date.now() - parsed.timestamp > MAX_CACHE_AGE_MS) {
      localStorage.removeItem(key)
      return null
    }
    
    // Verify URL matches (collision protection)
    if (parsed.url !== url) {
      return null
    }
    
    return parsed.content
  } catch {
    return null
  }
}

export function setCachedContent(url: string, content: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const key = getCacheKey(url)
    const cached: CachedContent = {
      content,
      timestamp: Date.now(),
      url,
    }
    localStorage.setItem(key, JSON.stringify(cached))
  } catch (e) {
    // localStorage might be full or disabled
    console.warn('Failed to cache article content:', e)
    // Try to clear old caches
    clearOldCaches()
  }
}

export function clearOldCaches(): void {
  if (typeof window === 'undefined') return
  
  try {
    const keysToRemove: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) {
        // Remove old version caches or expired ones
        if (!key.startsWith(`${CACHE_PREFIX}${CACHE_VERSION}`)) {
          keysToRemove.push(key)
        } else {
          try {
            const cached = localStorage.getItem(key)
            if (cached) {
              const parsed: CachedContent = JSON.parse(cached)
              if (Date.now() - parsed.timestamp > MAX_CACHE_AGE_MS) {
                keysToRemove.push(key)
              }
            }
          } catch {
            keysToRemove.push(key)
          }
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch {
    // Ignore errors
  }
}

// Scroll position cache - stores the actual scroll position for each article
const SCROLL_PREFIX = 'stream_scroll_'

function getScrollKey(articleId: string): string {
  return `${SCROLL_PREFIX}${articleId}`
}

export function getScrollPosition(articleId: string): number {
  if (typeof window === 'undefined') return 0
  
  try {
    const saved = localStorage.getItem(getScrollKey(articleId))
    return saved ? parseFloat(saved) : 0
  } catch {
    return 0
  }
}

export function setScrollPosition(articleId: string, position: number): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(getScrollKey(articleId), position.toString())
  } catch {
    // Ignore errors
  }
}

