import { Article } from './supabase'

export const demoArticles: Omit<Article, 'id' | 'created_at'>[] = [
  {
    url: 'https://www.paulgraham.com/superlinear.html',
    title: 'Superlinear Returns',
    description: 'Paul Graham on how returns in technology and startups are superlinear.',
    gradient_seed: 42,
    status: 'cloud',
    reading_progress: 0,
    finished: false,
  },
  {
    url: 'https://blog.samaltman.com/what-i-wish-someone-had-told-me',
    title: 'What I Wish Someone Had Told Me',
    description: 'Sam Altman shares lessons learned about startups and life.',
    gradient_seed: 137,
    status: 'cloud',
    reading_progress: 0,
    finished: false,
  },
  {
    url: 'https://waitbutwhy.com/2014/05/fermi-paradox.html',
    title: 'The Fermi Paradox',
    description: 'Where is everybody? A deep dive into one of the biggest questions.',
    gradient_seed: 256,
    status: 'cloud',
    reading_progress: 0,
    finished: false,
  },
  {
    url: 'https://www.gwern.net/Spaced-repetition',
    title: 'Spaced Repetition for Efficient Learning',
    description: 'A comprehensive guide to spaced repetition and memory.',
    gradient_seed: 789,
    status: 'cloud',
    reading_progress: 0,
    finished: false,
  },
  {
    url: 'https://patrickcollison.com/fast',
    title: 'Fast',
    description: 'Examples of people quickly accomplishing ambitious things.',
    gradient_seed: 1024,
    status: 'ocean',
    reading_progress: 100,
    notes: 'Incredibly inspiring. Keep this list for when I need motivation.',
    finished: true,
    moved_to_ocean_at: new Date().toISOString(),
  },
]

