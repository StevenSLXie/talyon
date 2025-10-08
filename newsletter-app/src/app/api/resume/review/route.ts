import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'

// Configure route for streaming
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const RESUME_REVIEW_PROMPT = `You are an experienced career advisor in Singapore. Analyze this candidate profile critically and provide exactly 10 bullet points.

Context: Singapore job market expectations, local hiring practices, and regional career standards.

Provide a balanced mix covering:
- Key strengths and standout qualities (3-4 points)
- Critical gaps or weaknesses that could hurt job prospects (3-4 points)  
- Specific, actionable improvements (2-3 points)

Guidelines:
- Be objective and sharp, but constructive
- Reference Singapore market context (e.g., "Most SG employers expect...", "For the local market...")
- Be specific with examples from the profile data
- Avoid generic advice - make it personal to THIS candidate
- Each bullet should be 1-2 sentences max
- Use clear, direct language

Format: Return exactly 10 bullets, one per line, starting with "• "

Candidate Profile:
{profileData}`

export async function POST(request: NextRequest) {
  console.info('[ResumeReview] POST request received')
  
  try {
    const sessionToken = request.cookies.get('session_token')?.value
    console.info('[ResumeReview] Session token present:', !!sessionToken)
    
    if (!sessionToken) {
      console.warn('[ResumeReview] No session token found')
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const nowIso = new Date().toISOString()
    console.info('[ResumeReview] Checking session validity')
    
    const { data: session, error: sessionError } = await supabaseAdmin()
      .from('user_sessions')
      .select('user_id')
      .eq('session_token', sessionToken)
      .gt('expires_at', nowIso)
      .single()

    if (sessionError) {
      console.error('[ResumeReview] Session query error:', sessionError)
    }

    if (!session?.user_id) {
      console.warn('[ResumeReview] Invalid or expired session')
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.info('[ResumeReview] Session valid, user_id:', session.user_id)

    const { data: subscriber, error: subscriberError } = await supabaseAdmin()
      .from('subscribers')
      .select('email')
      .eq('id', session.user_id)
      .single()

    if (subscriberError) {
      console.error('[ResumeReview] Subscriber query error:', subscriberError)
    }

    if (!subscriber?.email) {
      console.warn('[ResumeReview] Subscriber not found for user_id:', session.user_id)
      return new Response(JSON.stringify({ error: 'User not found' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.info('[ResumeReview] Subscriber found:', subscriber.email)

    const { data: userRow, error: userError } = await supabaseAdmin()
      .from('users')
      .select('id')
      .eq('email', subscriber.email)
      .single()

    if (userError) {
      console.error('[ResumeReview] User query error:', userError)
    }

    if (!userRow?.id) {
      console.warn('[ResumeReview] User profile not found for email:', subscriber.email)
      return new Response(JSON.stringify({ error: 'User profile not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userId = userRow.id as string
    console.info('[ResumeReview] User ID resolved:', userId)

    // Get the enhanced profile data instead of raw resume text
    console.info('[ResumeReview] Fetching enhanced profile')
    const { data: profile, error: profileError } = await supabaseAdmin()
      .from('candidate_basics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (profileError) {
      console.error('[ResumeReview] Profile query error:', profileError)
    }

    if (!profile) {
      console.warn('[ResumeReview] No enhanced profile found for user:', userId)
      return new Response(JSON.stringify({ error: 'No profile found. Please upload a resume first.' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.info('[ResumeReview] Enhanced profile found')
    
    // Build a comprehensive profile summary for LLM analysis
    const profileSummary = {
      name: profile.name,
      current_title: profile.current_title,
      target_titles: profile.target_titles,
      seniority_level: profile.seniority_level,
      industries: profile.industries,
      company_tiers: profile.company_tiers,
      salary_expect_min: profile.salary_expect_min,
      salary_expect_max: profile.salary_expect_max,
      work_auth: profile.work_auth,
      work_prefs: profile.work_prefs,
      intent: profile.intent,
      leadership_level: profile.leadership_level,
      has_management: profile.has_management,
      direct_reports_count: profile.direct_reports_count,
      management_years: profile.management_years,
      management_evidence: profile.management_evidence
    }

    console.info('[ResumeReview] Profile summary built, starting streaming review for user:', userId)

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const prompt = RESUME_REVIEW_PROMPT.replace('{profileData}', JSON.stringify(profileSummary, null, 2))

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
