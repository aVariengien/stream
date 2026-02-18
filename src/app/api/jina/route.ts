import { NextRequest, NextResponse } from 'next/server'
import { fetchJinaMarkdown } from '@/lib/jina'

export async function GET(request: NextRequest) {
  // Allow demo users to read articles too
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const content = await fetchJinaMarkdown(url)
    return NextResponse.json({ content })
  } catch (error) {
    console.error('Jina fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article content' },
      { status: 500 }
    )
  }
}

