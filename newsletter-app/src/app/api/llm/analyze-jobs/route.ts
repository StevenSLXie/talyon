import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { prompt, model = 'gpt-5-mini' } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    console.log('🤖 Calling OpenAI API for job analysis...')

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert career advisor who provides detailed, personalized job analysis. Always respond with valid JSON format as requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenAI')
    }

    console.log('✅ OpenAI API call successful')

    return NextResponse.json({
      content,
      usage: completion.usage,
      model: completion.model
    })

  } catch (error) {
    console.error('❌ OpenAI API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
