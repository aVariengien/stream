-- Stream: Reading Flow Application
-- Supabase Schema

-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster username lookups
CREATE INDEX idx_users_username ON users(username);

-- Create articles table with user_id
CREATE TABLE articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  generated_image_url TEXT,
  gradient_seed INTEGER,
  status TEXT NOT NULL DEFAULT 'cloud' CHECK (status IN ('cloud', 'ocean')),
  reading_progress INTEGER NOT NULL DEFAULT 0 CHECK (reading_progress >= 0 AND reading_progress <= 100),
  notes TEXT,
  unread_reason TEXT,
  finished BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  moved_to_river_at TIMESTAMP WITH TIME ZONE,
  moved_to_ocean_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster queries by user and status
CREATE INDEX idx_articles_user_status ON articles(user_id, status);

-- Create index for ordering by creation date
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);

-- Store text chunks generated from each article
CREATE TABLE chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chunks_user_created ON chunks(user_id, created_at DESC);
CREATE INDEX idx_chunks_article_index ON chunks(article_id, chunk_index);

-- Queue of pre-scored chunks ready to serve to the user
CREATE TABLE feed_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  predicted_score DOUBLE PRECISION NOT NULL,
  was_explore BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, chunk_id)
);

CREATE INDEX idx_feed_queue_user_created ON feed_queue(user_id, created_at ASC);

-- Permanent record of chunks that were shown (a chunk must be shown only once)
CREATE TABLE feed_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  predicted_score DOUBLE PRECISION NOT NULL,
  was_explore BOOLEAN NOT NULL DEFAULT FALSE,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, chunk_id)
);

CREATE INDEX idx_feed_items_user_shown ON feed_items(user_id, shown_at DESC);

-- User ratings on shown chunks (a chunk can only be rated once)
CREATE TABLE chunk_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  annotation TEXT,
  predicted_score DOUBLE PRECISION,
  was_explore BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, chunk_id)
);

CREATE INDEX idx_chunk_ratings_user_created ON chunk_ratings(user_id, created_at DESC);

-- User-adjustable recommendation settings
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  chunk_size INTEGER NOT NULL DEFAULT 200,
  explore_ratio DOUBLE PRECISION NOT NULL DEFAULT 0.2 CHECK (explore_ratio >= 0 AND explore_ratio <= 1),
  feed_batch_size INTEGER NOT NULL DEFAULT 20 CHECK (feed_batch_size > 0),
  candidate_pool_size INTEGER NOT NULL DEFAULT 200 CHECK (candidate_pool_size > 0),
  scoring_batch_size INTEGER NOT NULL DEFAULT 20 CHECK (scoring_batch_size > 0),
  num_few_shot INTEGER NOT NULL DEFAULT 50 CHECK (num_few_shot >= 0),
  scoring_model TEXT NOT NULL DEFAULT 'zai-glm-4.7',
  context_model TEXT NOT NULL DEFAULT 'gpt-oss-120b',
  show_explore_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (API routes handle authentication)
CREATE POLICY "Allow all operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations" ON articles
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations" ON chunks
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations" ON feed_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations" ON feed_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations" ON chunk_ratings
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations" ON user_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Migration: Stable feed ordering
--
-- Run these statements in Supabase SQL editor to add stable ordering to feed_items
-- and create the user_feed_state table used for position tracking.
--
-- 1. Add a sequential position column to feed_items:
-- CREATE SEQUENCE IF NOT EXISTS feed_items_position_seq;
-- ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS position BIGINT DEFAULT nextval('feed_items_position_seq');
-- UPDATE feed_items SET position = nextval('feed_items_position_seq') WHERE position IS NULL;
-- ALTER TABLE feed_items ALTER COLUMN position SET NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_feed_items_user_position ON feed_items(user_id, position ASC);
--
-- 2. Create user_feed_state table (tracks each user's reading cursor):
-- CREATE TABLE IF NOT EXISTS user_feed_state (
--   user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
--   last_seen_feed_item_id UUID REFERENCES feed_items(id) ON DELETE SET NULL,
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
-- ALTER TABLE user_feed_state ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations" ON user_feed_state FOR ALL USING (true) WITH CHECK (true);
--
-- Migration: If you already have the articles table, run these commands:
-- 
-- 1. Create users table:
-- CREATE TABLE users (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   username TEXT NOT NULL UNIQUE,
--   password_hash TEXT NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
-- CREATE INDEX idx_users_username ON users(username);
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations" ON users FOR ALL USING (true) WITH CHECK (true);
--
-- 2. Add user_id column to articles:
-- ALTER TABLE articles ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- CREATE INDEX idx_articles_user_status ON articles(user_id, status);
--
-- 3. After creating your first user, update existing articles:
-- UPDATE articles SET user_id = 'your-user-uuid-here' WHERE user_id IS NULL;
--
-- 4. Make user_id NOT NULL:
-- ALTER TABLE articles ALTER COLUMN user_id SET NOT NULL;
