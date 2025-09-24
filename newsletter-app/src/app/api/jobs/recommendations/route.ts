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

    // Pull candidate titles from candidate_work
    const { data: workRows } = await supabaseAdmin()
      .from('candidate_work')
      .select('position')
      .eq('user_id', usersId)
      .order('start_date', { ascending: false })
      .limit(10)

    const candidateTitles = (workRows || [])
      .map(w => w?.position)
      .filter(Boolean) as string[]

    if (candidateTitles.length === 0) {
      return NextResponse.json({ error: 'No work titles found. Upload a resume first.' }, { status: 404 })
    }

    const recommendations = await jobMatchingService.getRecommendationsFromTitles(candidateTitles, limit, usersId)

    return NextResponse.json({ success: true, recommendations, titlesUsed: candidateTitles.slice(0, 3) })
  } catch (error) {
    console.error('Job recommendations error:', error)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}