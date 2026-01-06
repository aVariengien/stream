import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const AUTH_COOKIE = 'stream_auth'
const AUTH_SECRET = process.env.AUTH_SECRET || 'default-secret-change-me'

async function isAuthenticated() {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get(AUTH_COOKIE)
  return authCookie?.value === AUTH_SECRET
}

export async function GET(request: NextRequest) {
  // Allow demo users to read articles too
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // Use Jina Reader API to get markdown content
    const jinaUrl = `https://r.jina.ai/${url}`
    
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch article content' },
        { status: response.status }
      )
    }

    let content = await response.text()

    // Strip Jina metadata header if present
    const markdownContentMatch = content.match(/Markdown Content:\s*\n([\s\S]*)/)
    if (markdownContentMatch) {
      content = markdownContentMatch[1].trim()
    }

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Jina fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article content' },
      { status: 500 }
    )
  }
}

