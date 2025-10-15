import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { llmAnalysisService } from '@/lib/llm-analysis'
import { supabaseAdmin } from '@/lib/supabase'
import { EnhancedCandidateProfileService } from '@/lib/enhanced-candidate-profile'

export async function POST(request: NextRequest) {
  try {
    const { resumeText, salaryMin, salaryMax } = await request.json()
    if (typeof resumeText !== 'string' || resumeText.trim().length < 50) {
      return NextResponse.json({ error: 'Please paste at least 50 characters of resume text.' }, { status: 400 })
    }

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

    const subscriberId = session.user_id as string
    const { data: subscriber } = await supabaseAdmin()
      .from('subscribers')
      .select('email')
      .eq('id', subscriberId)
      .single()

    if (!subscriber?.email) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    const { data: existingUser } = await supabaseAdmin()
      .from('users')
      .select('id')
      .eq('email', subscriber.email)
      .single()

    const usersId = existingUser?.id as string
    if (!usersId) return NextResponse.json({ error: 'User profile not initialized.' }, { status: 404 })

    // Create a DB row in resumes to satisfy FK constraints
    const supa = supabaseAdmin()
    const syntheticPath = `text/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    const { data: resumeRow, error: resumeErr } = await supa
      .from('resumes')
      .insert({
        user_id: usersId,
        file_path: syntheticPath,
        filename: 'pasted-text.txt',
        file_type: 'text/plain',
        file_size: resumeText.length,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (resumeErr || !resumeRow?.id) {
      return NextResponse.json({ error: 'Failed to initialize resume record' }, { status: 500 })
    }

    const resumeId = resumeRow.id as string

    const { enhancedProfile, jsonResume } = await llmAnalysisService.generateCombinedProfileFromText(resumeText)

    if (salaryMin && salaryMax) {
      enhancedProfile.salary_expect = {
        min: Number(salaryMin) || null,
        max: Number(salaryMax) || null,
        currency: 'SGD',
        source: 'user_input'
      }
    }

    const { success, counts } = await EnhancedCandidateProfileService.saveEnhancedProfile(usersId, resumeId, enhancedProfile)
    if (!success) throw new Error('Failed to save enhanced profile')

    return NextResponse.json({ success: true, resumeId, enhancedProfile, jsonResume, counts })
  } catch (error) {
    console.error('Text resume upload error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 })
  }
}


