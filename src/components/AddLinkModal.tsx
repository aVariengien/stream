'use client'

import { useState, useCallback } from 'react'

interface AddLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (urls: string[]) => void
}

// Extract all URLs from text
function extractUrls(text: string): string[] {
  // Match URLs starting with http:// or https://
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
  const matches = text.match(urlRegex) || []
  
  // Clean up URLs - remove trailing punctuation that might have been captured
  const cleaned = matches.map(url => {
    // Remove trailing punctuation like ), ], ., , etc. that are often at end of URLs in text
    return url.replace(/[.,;:!?)>\]]+$/, '')
  })
  
  // Deduplicate
  return [...new Set(cleaned)]
}

export function AddLinkModal({ isOpen, onClose, onAdd }: AddLinkModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [extractedUrls, setExtractedUrls] = useState<string[]>([])

  // Extract URLs as user types/pastes
  const handleInputChange = useCallback((value: string) => {
    setInput(value)
    setError('')
    const urls = extractUrls(value)
    setExtractedUrls(urls)
  }, [])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Re-extract URLs from current input at submit time
    let urlsToAdd = extractUrls(input)
    
    // If no URLs extracted, check if the input itself is a valid URL
    if (urlsToAdd.length === 0) {
      try {
        new URL(input.trim())
        urlsToAdd = [input.trim()]
      } catch {
        setError('No valid URLs found')
        return
      }
    }
    
    // Always add in background - close modal immediately
    onAdd(urlsToAdd)
    setInput('')
    setExtractedUrls([])
    onClose()
  }

  const removeUrl = (urlToRemove: string) => {
    setExtractedUrls(prev => prev.filter(url => url !== urlToRemove))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-paper border border-ink/20 p-8 w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ash hover:text-ink transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-lg font-medium mb-2">Add to Cloud</h2>
        <p className="text-xs text-ash mb-6">Paste a URL or text containing multiple URLs</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <label className="block text-xs text-ash mb-2">URLs or text containing URLs</label>
            <textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Paste a URL, or text with multiple links..."
              className="w-full h-32 px-4 py-3 border border-ink/20 bg-transparent focus:border-ink focus:outline-none transition-colors text-sm resize-none"
              autoFocus
            />
          </div>
          
          {/* Extracted URLs preview */}
          {extractedUrls.length > 0 && (
            <div className="max-h-40 overflow-y-auto border border-ink/10 p-3 space-y-2">
              <p className="text-xs text-ash mb-2">
                {extractedUrls.length} URL{extractedUrls.length !== 1 ? 's' : ''} found:
              </p>
              {extractedUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 text-xs group">
                  <span className="truncate flex-1 text-ink/80">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeUrl(url)}
                    className="text-ash hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          
          <button
            type="submit"
            className="w-full py-3 border border-ink bg-ink text-paper hover:bg-paper hover:text-ink transition-colors text-sm"
          >
            {extractedUrls.length > 1 ? `Add ${extractedUrls.length} links to Cloud` : 'Add to Cloud'}
          </button>
        </form>
      </div>
    </div>
  )
}
