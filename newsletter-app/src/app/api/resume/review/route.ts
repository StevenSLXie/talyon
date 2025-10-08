import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'

// Configure route for streaming
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const RESUME_REVIEW_PROMPT = `You are an experienced career advisor in Singapore. Analyze this resume critically and provide exactly 10 bullet points.

Context: Singapore job market expectations, local hiring practices, and regional career standards.

Provide a balanced mix covering:
- Key strengths and standout qualities (3-4 points)
- Critical gaps or weaknesses that could hurt job prospects (3-4 points)  
- Specific, actionable improvements (2-3 points)

Guidelines:
- Be objective and sharp, but constructive
- Reference Singapore market context (e.g., "Most SG employers expect...", "For the local market...")
- Be specific with examples from the resume
- Avoid generic advice - make it personal to THIS candidate
- Each bullet should be 1-2 sentences max
- Use clear, direct language

Format: Return exactly 10 bullets, one per line, starting with "• "

Resume:
{resumeText}`

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const nowIso = new Date().toISOString()
    const { data: session } = await supabaseAdmin()
      .from('user_sessions')
      .select('user_id')
      .eq('session_token', sessionToken)
      .gt('expires_at', nowIso)
      .single()

    if (!session?.user_id) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { data: subscriber } = await supabaseAdmin()
      .from('subscribers')
      .select('email')
      .eq('id', session.user_id)
      .single()

    if (!subscriber?.email) {
      return new Response(JSON.stringify({ error: 'User not found' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { data: userRow } = await supabaseAdmin()
      .from('users')
      .select('id')
      .eq('email', subscriber.email)
      .single()

    if (!userRow?.id) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userId = userRow.id as string

    // Get the most recent resume
    const { data: resume } = await supabaseAdmin()
      .from('resumes')
      .select('raw_text')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!resume?.raw_text) {
      return new Response(JSON.stringify({ error: 'No resume found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.info('[ResumeReview] Starting streaming review for user:', userId)

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const prompt = RESUME_REVIEW_PROMPT.replace('{resumeText}', resume.raw_text)

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an experienced career advisor in Singapore providing honest, constructive resume feedback.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 1000,
            stream: true
          })

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              // Send each chunk as it arrives
              const data = JSON.stringify({ content })
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`))
            }
          }

          // Send completion signal
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()

          console.info('[ResumeReview] Streaming complete for user:', userId)
        } catch (error) {
          console.error('[ResumeReview] Streaming error:', error)
          const errorData = JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Streaming failed' 
          })
          controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })

  } catch (error) {
    console.error('[ResumeReview] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate review' 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
