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

  console.log('supabaseUrl', supabaseUrl)
  console.log('supabaseKey', supabaseKey)
  
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
  status: 'cloud' | 'river' | 'ocean'
  reading_progress: number
  notes?: string
  unread_reason?: string
  created_at: string
  moved_to_river_at?: string
  moved_to_ocean_at?: string
  finished: boolean
}
