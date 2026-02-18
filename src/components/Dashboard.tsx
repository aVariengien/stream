'use client'

import { useEffect, useState } from 'react'

type Settings = {
  chunk_size: number
  explore_ratio: number
  feed_batch_size: number
  candidate_pool_size: number
  scoring_batch_size: number
  num_few_shot: number
  scoring_model: string
  context_model: string
  show_explore_flag: boolean
}

type AccuracyPayload = {
  overallMae: number | null
  exploreMae: number | null
  exploitMae: number | null
  totalRatings: number
  exploreRatings: number
  exploitRatings: number
  timeline: {
    overall: Array<{ date: string; mae: number }>
    explore: Array<{ date: string; mae: number }>
    exploit: Array<{ date: string; mae: number }>
  }
}

type DashboardProps = {
  isOpen: boolean
  onClose: () => void
}

export function Dashboard({ isOpen, onClose }: DashboardProps) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accuracy, setAccuracy] = useState<AccuracyPayload | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const load = async () => {
      try {
        const [settingsRes, accuracyRes] = await Promise.all([fetch('/api/settings'), fetch('/api/accuracy')])
        const settingsPayload = await settingsRes.json()
        const accuracyPayload = await accuracyRes.json()
        if (!settingsRes.ok) throw new Error(settingsPayload.error || 'Failed to load settings')
        if (!accuracyRes.ok) throw new Error(accuracyPayload.error || 'Failed to load accuracy')
        setSettings(settingsPayload)
        setAccuracy(accuracyPayload)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      }
    }
    void load()
  }, [isOpen])

  if (!isOpen) return null

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to save settings')
      setSettings(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const setNumber =
    (key: keyof Settings) =>
    (value: number): void => {
      if (!settings) return
      setSettings({ ...settings, [key]: value })
    }

  const renderLineChart = (
    title: string,
    points: Array<{ date: string; mae: number }>,
    stroke: string
  ) => {
    if (points.length === 0) {
      return (
        <div className="rounded-lg border border-warmLine bg-card p-3">
          <p className="mb-1 text-xs font-medium text-ink">{title}</p>
          <p className="text-[11px] text-ash">Not enough ratings yet.</p>
        </div>
      )
    }

    const width = 360
    const height = 110
    const values = points.map((point) => point.mae)
    const maxValue = Math.max(...values, 1)
    const minValue = Math.min(...values, 0)
    const range = maxValue - minValue || 1
    const path = points
      .map((point, index) => {
        const x = (index / Math.max(points.length - 1, 1)) * width
        const y = height - ((point.mae - minValue) / range) * height
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')

    return (
      <div className="rounded-lg border border-warmLine bg-card p-3">
        <p className="mb-2 text-xs font-medium text-ink">{title}</p>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full">
          <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="mt-2 flex items-center justify-between text-[10px] text-ash">
          <span>{points[0].date}</span>
          <span>{points[points.length - 1].date}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-warmLine bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Dashboard</h2>
          <button onClick={onClose} className="text-sm text-ash hover:text-ink">
            Close
          </button>
        </div>

        {!settings ? (
          <p className="text-sm text-ash">Loading settings...</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-ink">
                Chunk size ({settings.chunk_size})
                <input
                  type="range"
                  min={50}
                  max={500}
                  value={settings.chunk_size}
                  onChange={(e) => setNumber('chunk_size')(Number(e.target.value))}
                  className="mt-2 w-full accent-teal"
                />
              </label>
              <label className="text-sm text-ink">
                Explore ratio ({settings.explore_ratio.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.explore_ratio}
                  onChange={(e) => setNumber('explore_ratio')(Number(e.target.value))}
                  className="mt-2 w-full accent-teal"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="text-xs text-ash">
                Feed batch
                <input
                  type="number"
                  value={settings.feed_batch_size}
                  onChange={(e) => setNumber('feed_batch_size')(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-warmLine bg-paper px-2 py-1 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-ash">
                Candidate pool
                <input
                  type="number"
                  value={settings.candidate_pool_size}
                  onChange={(e) => setNumber('candidate_pool_size')(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-warmLine bg-paper px-2 py-1 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-ash">
                Scoring batch
                <input
                  type="number"
                  value={settings.scoring_batch_size}
                  onChange={(e) => setNumber('scoring_batch_size')(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-warmLine bg-paper px-2 py-1 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-ash">
                Few-shot count
                <input
                  type="number"
                  value={settings.num_few_shot}
                  onChange={(e) => setNumber('num_few_shot')(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-warmLine bg-paper px-2 py-1 text-sm text-ink"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-ink">
                Scoring model
                <input
                  type="text"
                  value={settings.scoring_model}
                  onChange={(e) => setSettings({ ...settings, scoring_model: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-warmLine bg-paper px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-ink">
                Context model
                <input
                  type="text"
                  value={settings.context_model}
                  onChange={(e) => setSettings({ ...settings, context_model: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-warmLine bg-paper px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={settings.show_explore_flag}
                onChange={(e) => setSettings({ ...settings, show_explore_flag: e.target.checked })}
              />
              Show explore/exploit badge on chunks (can bias future ratings)
            </label>

            <div className="rounded-xl border border-warmLine bg-paper p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">Accuracy</h3>
              {!accuracy ? (
                <p className="text-xs text-ash">Loading...</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 text-xs text-ash md:grid-cols-3">
                    <p>Overall MAE: {accuracy.overallMae?.toFixed(3) || 'N/A'}</p>
                    <p>Explore MAE: {accuracy.exploreMae?.toFixed(3) || 'N/A'}</p>
                    <p>Exploit MAE: {accuracy.exploitMae?.toFixed(3) || 'N/A'}</p>
                    <p>Total ratings: {accuracy.totalRatings}</p>
                    <p>Explore ratings: {accuracy.exploreRatings}</p>
                    <p>Exploit ratings: {accuracy.exploitRatings}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {renderLineChart('Explore MAE over time', accuracy.timeline.explore, '#5bb5a2')}
                    {renderLineChart('Exploit MAE over time', accuracy.timeline.exploit, '#f3b49f')}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-full border border-teal bg-teal px-4 py-2 text-sm text-paper hover:bg-paper hover:text-teal disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

