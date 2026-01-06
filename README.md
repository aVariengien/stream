# Stream — Reading Flow

A mindful way to manage your reading list. Articles flow from **Cloud** → **River** → **Ocean**.

## Concept

- **Cloud**: Your reading backlog. Drop links here to save for later.
- **River**: Active reading. Only 5 slots available. These are what you're currently reading.
- **Ocean**: The archive. Finished articles live here, with optional notes and reflections.

## Features

- Beautiful procedural mesh gradient thumbnails for articles without images
- Formatted article reading with Jina AI's reader API
- Reading progress tracking
- Simple password-based authentication (persisted via cookie)
- Demo mode for visitors

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Run the SQL in `supabase-schema.sql` in the SQL Editor
3. Copy your project URL and anon key from Settings → API

### 2. Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
AUTH_SECRET=your_secret_password_here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the demo mode.

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your repo to [Vercel](https://vercel.com)
3. Add environment variables in Vercel's project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `AUTH_SECRET`
4. Deploy!

## Authentication

The app uses a simple password-based authentication:

1. Visit the app (you'll see demo mode)
2. Enter your password (the value of `AUTH_SECRET`)
3. A cookie is set that persists for 1 year
4. You won't need to log in again on that browser

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- Jina AI Reader API (for article content)
- Vercel (hosting)

