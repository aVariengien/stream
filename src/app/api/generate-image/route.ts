import { NextRequest, NextResponse } from 'next/server'
import { generateImagePrompt } from '@/lib/prompt-generator'

const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY

export async function POST(request: NextRequest) {
  if (!RUNWARE_API_KEY) {
    return NextResponse.json(
      { error: 'Runware API key not configured' },
      { status: 500 }
    )
  }

  try {
    const { seed } = await request.json()
    
    if (typeof seed !== 'number') {
      return NextResponse.json(
        { error: 'Seed is required and must be a number' },
        { status: 400 }
      )
    }

    const prompt = generateImagePrompt(seed)
    
    // Call Runware API using their REST endpoint
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: 'imageInference',
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: 'runware:101@1', // Flux Dev
          width: 512,
          height: 512,
          numberResults: 1,
          outputFormat: 'WEBP',
          outputType: 'URL',
        }
      ]),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Runware API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 }
      )
    }

    const result = await response.json()
    
    // Runware returns an array of results
    const imageResult = result.data?.find((r: { taskType: string }) => r.taskType === 'imageInference')
    
    if (!imageResult?.imageURL) {
      console.error('No image URL in response:', result)
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      imageUrl: imageResult.imageURL,
      prompt,
    })
  } catch (error) {
    console.error('Generate image error:', error)
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    )
  }
}



