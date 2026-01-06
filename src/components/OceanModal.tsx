'use client'

import { useState } from 'react'

interface OceanModalProps {
  isOpen: boolean
  articleTitle: string
  onClose: () => void
  onSubmit: (finished: boolean, notes?: string, reason?: string) => Promise<void>
}

export function OceanModal({ isOpen, articleTitle, onClose, onSubmit }: OceanModalProps) {
  const [finished, setFinished] = useState(true)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(finished, notes || undefined, finished ? undefined : reason || undefined)
      setNotes('')
      setReason('')
      setFinished(true)
      onClose()
    } catch {
      // Handle error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-paper border border-ink/20 p-8 w-full max-w-md mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ash hover:text-ink transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-lg font-medium mb-2">Move to Ocean</h2>
        <p className="text-xs text-ash mb-6 line-clamp-1">{articleTitle}</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Finished toggle */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setFinished(true)}
              className={`flex-1 py-3 border text-sm transition-colors ${
                finished 
                  ? 'border-ink bg-ink text-paper' 
                  : 'border-ink/20 hover:border-ink/40'
              }`}
            >
              Finished ✓
            </button>
            <button
              type="button"
              onClick={() => setFinished(false)}
              className={`flex-1 py-3 border text-sm transition-colors ${
                !finished 
                  ? 'border-ink bg-ink text-paper' 
                  : 'border-ink/20 hover:border-ink/40'
              }`}
            >
              Didn't read
            </button>
          </div>
          
          {/* Reason for not reading */}
          {!finished && (
            <div>
              <label className="block text-xs text-ash mb-2">Why didn't you finish?</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Not relevant, too long, etc."
                className="w-full px-4 py-3 border border-ink/20 bg-transparent focus:border-ink focus:outline-none transition-colors text-sm"
              />
            </div>
          )}
          
          {/* Notes */}
          <div>
            <label className="block text-xs text-ash mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you think? Key takeaways..."
              rows={3}
              className="w-full px-4 py-3 border border-ink/20 bg-transparent focus:border-ink focus:outline-none transition-colors text-sm resize-none"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 border border-ink bg-ink text-paper hover:bg-paper hover:text-ink transition-colors text-sm disabled:opacity-50"
          >
            {loading ? 'Moving...' : 'Move to Ocean →'}
          </button>
        </form>
      </div>
    </div>
  )
}

