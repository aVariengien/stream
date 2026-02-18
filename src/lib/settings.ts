import { DEFAULT_SETTINGS, UserSettings, getSupabase } from '@/lib/supabase'

export type SettingsPayload = Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(min, Math.min(max, num))
}

export function sanitizeSettings(input: Partial<SettingsPayload>): SettingsPayload {
  return {
    chunk_size: Math.round(clampNumber(input.chunk_size, 50, 500, DEFAULT_SETTINGS.chunk_size)),
    explore_ratio: clampNumber(input.explore_ratio, 0, 1, DEFAULT_SETTINGS.explore_ratio),
    feed_batch_size: Math.round(clampNumber(input.feed_batch_size, 1, 100, DEFAULT_SETTINGS.feed_batch_size)),
    candidate_pool_size: Math.round(
      clampNumber(input.candidate_pool_size, 10, 1000, DEFAULT_SETTINGS.candidate_pool_size)
    ),
    scoring_batch_size: Math.round(clampNumber(input.scoring_batch_size, 1, 100, DEFAULT_SETTINGS.scoring_batch_size)),
    num_few_shot: Math.round(clampNumber(input.num_few_shot, 0, 100, DEFAULT_SETTINGS.num_few_shot)),
    scoring_model: String(input.scoring_model || DEFAULT_SETTINGS.scoring_model),
    context_model: String(input.context_model || DEFAULT_SETTINGS.context_model),
    show_explore_flag: Boolean(input.show_explore_flag),
  }
}

export async function getOrCreateSettings(userId: string): Promise<UserSettings> {
  const client = getSupabase()
  const { data } = await client.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (data) return data as UserSettings

  const settings = sanitizeSettings(DEFAULT_SETTINGS)
  const { data: inserted, error } = await client
    .from('user_settings')
    .insert({
      user_id: userId,
      ...settings,
    })
    .select('*')
    .single()
  if (error || !inserted) {
    throw new Error(error?.message || 'Failed to initialize user settings')
  }
  return inserted as UserSettings
}

