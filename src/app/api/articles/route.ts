import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { urlToSeed } from '@/lib/utils'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabase()
    .from('articles')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Fetch metadata from the URL using Jina reader
    let title = new URL(url).hostname
    let description = ''
    let imageUrl = ''

    try {
      const jinaUrl = `https://r.jina.ai/${url}`
      const jinaRes = await fetch(jinaUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (jinaRes.ok) {
        const json = await jinaRes.json()
        if (json.data) {
          if (json.data.title) {
            title = json.data.title.substring(0, 200)
          }
          if (json.data.description) {
            description = json.data.description.substring(0, 300)
          }
        }
      }
    } catch {
      // Fallback to URL hostname as title
    }

    // Try to get Open Graph image
    try {
      const ogRes = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StreamBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      if (ogRes.ok) {
        const html = await ogRes.text()
        const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
        if (ogMatch) {
          imageUrl = ogMatch[1]
        }
        if (title === new URL(url).hostname) {
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            || html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
          if (titleMatch) {
            title = titleMatch[1].trim().substring(0, 200)
          }
        }
      }
    } catch {
      // Fallback
    }

    const gradientSeed = urlToSeed(url)

    // If no OG image found, generate one with Runware
    let generatedImageUrl = ''
    if (!imageUrl && process.env.RUNWARE_API_KEY) {
      try {
        const { generateImagePrompt } = await import('@/lib/prompt-generator')
        const prompt = generateImagePrompt(gradientSeed)
        
        const runwareRes = await fetch('https://api.runware.ai/v1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
          },
          body: JSON.stringify([
            {
              taskType: 'imageInference',
              taskUUID: crypto.randomUUID(),
              positivePrompt: prompt,
              model: 'runware:101@1',
              width: 512,
              height: 512,
              numberResults: 1,
              outputFormat: 'WEBP',
              outputType: 'URL',
            }
          ]),
          signal: AbortSignal.timeout(30000),
        })

        if (runwareRes.ok) {
          const result = await runwareRes.json()
          const imageResult = result.data?.find((r: { taskType: string }) => r.taskType === 'imageInference')
          if (imageResult?.imageURL) {
            generatedImageUrl = imageResult.imageURL
          }
        }
      } catch (e) {
        console.error('Runware image generation failed:', e)
      }
    }

    const { data, error } = await getSupabase()
      .from('articles')
      .insert({
        user_id: session.userId,
        url,
        title,
        description: description || null,
        image_url: imageUrl || null,
        generated_image_url: generatedImageUrl || null,
        gradient_seed: gradientSeed,
        status: 'cloud',
        reading_progress: 0,
        finished: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('POST /api/articles error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid request' }, { status: 400 })
  }
}
