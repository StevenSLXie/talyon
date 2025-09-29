import { NextRequest, NextResponse } from 'next/server'
import { jobMatchingService } from '@/lib/job-matching'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { limit = 3 } = await request.json().catch(() => ({ limit: 3 }))

    const sessionToken = request.cookies.get('session_token')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const nowIso = new Date().toISOString()
    const { data: session } = await supabaseAdmin()
      .from('user_sessions')
      .select('user_id')
      .eq('session_token', sessionToken)
      .gt('expires_at', nowIso)
      .single()

    if (!session?.user_id) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })

    const { data: subscriber } = await supabaseAdmin()
      .from('subscribers')
      .select('email')
      .eq('id', session.user_id)
      .single()

    if (!subscriber?.email) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    const { data: userRow } = await supabaseAdmin()
      .from('users')
      .select('id')
      .eq('email', subscriber.email)
      .single()

    if (!userRow?.id) return NextResponse.json({ error: 'User profile not initialized. Upload resume first.' }, { status: 404 })

    const usersId = userRow.id as string

    // Build comprehensive candidate profile
    const candidateProfile = await jobMatchingService.buildCandidateProfile(usersId)

    if (candidateProfile.titles.length === 0) {
      return NextResponse.json({ error: 'No work experience found. Upload a resume first.' }, { status: 404 })
    }

    // Use enhanced matching algorithm
    const recommendations = await jobMatchingService.getEnhancedRecommendations(candidateProfile, limit, usersId)

    return NextResponse.json({ 
      success: true, 
      recommendations, 
      candidateProfile: {
        titles: candidateProfile.titles.slice(0, 3),
        skills: candidateProfile.skills.slice(0, 5),
        experience_years: candidateProfile.experience_years,
        salary_range: `${candidateProfile.salary_range_min}-${candidateProfile.salary_range_max}`
      }
    })
  } catch (error) {
    console.error('Job recommendations error:', error)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}