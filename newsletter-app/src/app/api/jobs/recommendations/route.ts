import { NextRequest, NextResponse } from 'next/server'
import { advancedJobMatchingService } from '@/lib/advanced-job-matching'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { limit = 8 } = await request.json().catch(() => ({ limit: 8 }))

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

    console.log('🚀 Starting advanced job recommendations for user:', usersId)

    // Use advanced two-stage matching system
    const recommendations = await advancedJobMatchingService.getEnhancedJobRecommendations(usersId, limit)

    console.log('✅ Advanced recommendations generated:', recommendations.length)

    return NextResponse.json({ 
      success: true, 
      recommendations,
      system: 'advanced_two_stage',
      stage1_jobs_analyzed: recommendations.length > 0 ? 20 : 0,
      stage2_llm_analysis: recommendations.length > 0 ? 'completed' : 'skipped'
    })
  } catch (error) {
    console.error('❌ Advanced job recommendations error:', error)
    return NextResponse.json({ 
      error: 'Failed to get advanced recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}