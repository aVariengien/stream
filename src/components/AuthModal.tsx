'use client'

import { useState } from 'react'

interface AuthModalProps {
  isOpen: boolean
  onSuccess: (username: string) => void
  onClose?: () => void
}

export function AuthModal({ isOpen, onSuccess, onClose }: AuthModalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required')
      return
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          password,
          action: mode === 'register' ? 'register' : undefined
        }),
      })

      const data = await res.json()

      if (res.ok) {
        onSuccess(data.username)
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      {onClose && (
        <div 
          className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {!onClose && <div className="absolute inset-0 bg-paper" />}
      
      <div className="relative w-full max-w-sm mx-4 p-8 border border-ink/10 bg-paper">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-ash hover:text-ink transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <h2 className="text-lg font-medium mb-2">
          {mode === 'login' ? 'Enter Stream' : 'Create Account'}
        </h2>
        <p className="text-xs text-ash mb-6">
          {mode === 'login' 
            ? 'Sign in to access your reading flow.' 
            : 'Create an account to start your reading journey.'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="Username"
              className="w-full px-4 py-3 border border-ink/20 bg-transparent focus:border-ink focus:outline-none transition-colors text-sm"
              autoFocus
              autoComplete="username"
            />
          </div>
          
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-ink/20 bg-transparent focus:border-ink focus:outline-none transition-colors text-sm"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 border border-ink bg-ink text-paper hover:bg-paper hover:text-ink transition-colors text-sm disabled:opacity-50"
          >
            {loading 
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...') 
              : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-xs text-ash hover:text-ink transition-colors"
          >
            {mode === 'login' 
              ? "Don't have an account? Create one" 
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
