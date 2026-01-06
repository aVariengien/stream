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
  status TEXT NOT NULL DEFAULT 'cloud' CHECK (status IN ('cloud', 'river', 'ocean')),
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

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Allow all operations (API routes handle authentication)
CREATE POLICY "Allow all operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations" ON articles
  FOR ALL
  USING (true)
  WITH CHECK (true);

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
