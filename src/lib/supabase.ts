import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey)
  return supabaseInstance
}

export type Article = {
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
  created_at: string
  moved_to_ocean_at?: string
  finished: boolean
}

export type Chunk = {
  id: string
  article_id: string
  user_id: string
  chunk_index: number
  content: string
  word_count: number
  created_at: string
}

export type FeedItem = {
  id: string
  chunk_id: string
  user_id: string
  predicted_score: number
  was_explore: boolean
  shown_at: string
}

export type FeedQueueItem = {
  id: string
  chunk_id: string
  user_id: string
  predicted_score: number
  was_explore: boolean
  created_at: string
}

export type ChunkRating = {
  id: string
  chunk_id: string
  user_id: string
  rating: number
  annotation?: string | null
  predicted_score?: number | null
  was_explore: boolean
  created_at: string
}

export type UserSettings = {
  id: string
  user_id: string
  chunk_size: number
  explore_ratio: number
  feed_batch_size: number
  candidate_pool_size: number
  scoring_batch_size: number
  num_few_shot: number
  scoring_model: string
  context_model: string
  show_explore_flag: boolean
  created_at: string
  updated_at: string
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  chunk_size: 200,
  explore_ratio: 0.2,
  feed_batch_size: 20,
  candidate_pool_size: 200,
  scoring_batch_size: 20,
  num_few_shot: 50,
  scoring_model: 'zai-glm-4.7',
  context_model: 'gpt-oss-120b',
  show_explore_flag: false,
}
