import { NextRequest, NextResponse } from 'next/server'
import { ResumeParser } from '@/lib/resume-parser'
import { llmAnalysisService } from '@/lib/llm-analysis'
import { supabaseAdmin } from '@/lib/supabase'
import { EnhancedCandidateProfileService } from '@/lib/enhanced-candidate-profile'

async function saveFlatJsonResume(userId: string, resumeId: string, jsonResume: any) {
  const db = supabaseAdmin()
  const counts: Record<string, number> = {}

  // Destructively clear previous rows for this (user,resume)
  const tables = [
    'candidate_basics',
    'candidate_profiles_social',
    'candidate_work',
    'candidate_volunteer',
    'candidate_education',
    'candidate_awards',
    'candidate_certificates',
    'candidate_publications',
    'candidate_skills',
    'candidate_languages',
    'candidate_interests',
    'candidate_references',
    'candidate_projects'
  ]
  for (const table of tables) {
    const { error } = await db.from(table).delete().eq('user_id', userId).eq('resume_id', resumeId)
    if (error) console.error(`[Upload] clear ${table} error`, error)
  }

  // Basics
  const basics = jsonResume?.basics || {}
  const loc = basics?.location || {}
  {
    const { error } = await db.from('candidate_basics').insert({
      user_id: userId,
      resume_id: resumeId,
      name: basics?.name || null,
      label: basics?.label || null,
      image: basics?.image || null,
      email: basics?.email || null,
      phone: basics?.phone || null,
      url: basics?.url || null,
      summary: basics?.summary || null,
      address: loc?.address || null,
      postal_code: loc?.postalCode || null,
      city: loc?.city || null,
      country_code: loc?.countryCode || null,
      region: loc?.region || null
    })
    if (error) console.error('[Upload] insert candidate_basics error', error)
    counts.basics = 1
  }

  // Social profiles
  const profiles = basics?.profiles || []
  if (Array.isArray(profiles) && profiles.length) {
    const rows = profiles.map((p: any) => ({
      user_id: userId,
      resume_id: resumeId,
      network: p?.network || null,
      username: p?.username || null,
      url: p?.url || null
    }))
    const { error } = await db.from('candidate_profiles_social').insert(rows)
    if (error) console.error('[Upload] insert candidate_profiles_social error', error)
    counts.profiles = rows.length
  } else counts.profiles = 0

  // Work
  const work = jsonResume?.work || []
  console.debug('[Upload] work sample', JSON.stringify(work?.slice?.(0, 2) || [], null, 2))
  if (Array.isArray(work) && work.length) {
    const rows = work.map((w: any) => ({
      user_id: userId,
      resume_id: resumeId,
      company: w?.name || null,
      position: w?.position || null,
      url: w?.url || null,
      start_date: w?.startDate || null,
      end_date: w?.endDate || null,
      summary: w?.summary || null,
      highlights: Array.isArray(w?.highlights) ? w.highlights : []
    }))
    const { error } = await db.from('candidate_work').insert(rows)
    if (error) console.error('[Upload] insert candidate_work error', error)
    counts.work = rows.length
  } else counts.work = 0

  // Volunteer
  const volunteer = jsonResume?.volunteer || []
  if (Array.isArray(volunteer) && volunteer.length) {
    const rows = volunteer.map((v: any) => ({
      user_id: userId,
      resume_id: resumeId,
      organization: v?.organization || null,
      position: v?.position || null,
      url: v?.url || null,
      start_date: v?.startDate || null,
      end_date: v?.endDate || null,
      summary: v?.summary || null,
      highlights: Array.isArray(v?.highlights) ? v.highlights : []
    }))
    const { error } = await db.from('candidate_volunteer').insert(rows)
    if (error) console.error('[Upload] insert candidate_volunteer error', error)
    counts.volunteer = rows.length
  } else counts.volunteer = 0

  // Education
  const education = jsonResume?.education || []
  if (Array.isArray(education) && education.length) {
    const rows = education.map((e: any) => ({
      user_id: userId,
      resume_id: resumeId,
      institution: e?.institution || null,
      url: e?.url || null,
      area: e?.area || null,
      study_type: e?.studyType || null,
      start_date: e?.startDate || null,
      end_date: e?.endDate || null,
      score: e?.score || null,
      courses: Array.isArray(e?.courses) ? e.courses : []
    }))
    const { error } = await db.from('candidate_education').insert(rows)
    if (error) console.error('[Upload] insert candidate_education error', error)
    counts.education = rows.length
  } else counts.education = 0

  // Awards
  const awards = jsonResume?.awards || []
  if (Array.isArray(awards) && awards.length) {
    const rows = awards.map((a: any) => ({
      user_id: userId,
      resume_id: resumeId,
      title: a?.title || null,
      date: a?.date || null,
      awarder: a?.awarder || null,
      summary: a?.summary || null
    }))
    const { error } = await db.from('candidate_awards').insert(rows)
    if (error) console.error('[Upload] insert candidate_awards error', error)
    counts.awards = rows.length
  } else counts.awards = 0

  // Certificates
  const certificates = jsonResume?.certificates || []
  if (Array.isArray(certificates) && certificates.length) {
    const rows = certificates.map((c: any) => ({
      user_id: userId,
      resume_id: resumeId,
      name: c?.name || null,
      date: c?.date || null,
      issuer: c?.issuer || null,
      url: c?.url || null
    }))
    const { error } = await db.from('candidate_certificates').insert(rows)
    if (error) console.error('[Upload] insert candidate_certificates error', error)
    counts.certificates = rows.length
  } else counts.certificates = 0

  // Publications
  const publications = jsonResume?.publications || []
  if (Array.isArray(publications) && publications.length) {
    const rows = publications.map((p: any) => ({
      user_id: userId,
      resume_id: resumeId,
      name: p?.name || null,
      publisher: p?.publisher || null,
      release_date: p?.releaseDate || null,
      url: p?.url || null,
      summary: p?.summary || null
    }))
    const { error } = await db.from('candidate_publications').insert(rows)
    if (error) console.error('[Upload] insert candidate_publications error', error)
    counts.publications = rows.length
  } else counts.publications = 0

  // Skills
  const skills = jsonResume?.skills || []
  if (Array.isArray(skills) && skills.length) {
    const rows = skills.map((s: any) => ({
      user_id: userId,
      resume_id: resumeId,
      name: s?.name || null,
      level: s?.level || null,
      keywords: Array.isArray(s?.keywords) ? s.keywords : []
    }))
    const { error } = await db.from('candidate_skills').insert(rows)
    if (error) console.error('[Upload] insert candidate_skills error', error)
    counts.skills = rows.length
  } else counts.skills = 0

  // Languages
  const languages = jsonResume?.languages || []
  if (Array.isArray(languages) && languages.length) {
    const rows = languages.map((l: any) => ({
      user_id: userId,
      resume_id: resumeId,
      language: l?.language || null,
      fluency: l?.fluency || null
    }))
    const { error } = await db.from('candidate_languages').insert(rows)
    if (error) console.error('[Upload] insert candidate_languages error', error)
    counts.languages = rows.length
  } else counts.languages = 0

  // Interests
  const interests = jsonResume?.interests || []
  if (Array.isArray(interests) && interests.length) {
    const rows = interests.map((i: any) => ({
      user_id: userId,
      resume_id: resumeId,
      name: i?.name || null,
      keywords: Array.isArray(i?.keywords) ? i.keywords : []
    }))
    const { error } = await db.from('candidate_interests').insert(rows)
    if (error) console.error('[Upload] insert candidate_interests error', error)
    counts.interests = rows.length
  } else counts.interests = 0

  // References
  const references = jsonResume?.references || []
  if (Array.isArray(references) && references.length) {
    const rows = references.map((r: any) => ({
      user_id: userId,
      resume_id: resumeId,
      name: r?.name || null,
      reference: r?.reference || null
    }))
    const { error } = await db.from('candidate_references').insert(rows)
    if (error) console.error('[Upload] insert candidate_references error', error)
    counts.references = rows.length
  } else counts.references = 0

  // Projects
  const projects = jsonResume?.projects || []
  if (Array.isArray(projects) && projects.length) {
    const rows = projects.map((p: any) => ({
      user_id: userId,
      resume_id: resumeId,
      name: p?.name || null,
      start_date: p?.startDate || null,
      end_date: p?.endDate || null,
      description: p?.description || null,
      highlights: Array.isArray(p?.highlights) ? p.highlights : [],
      url: p?.url || null
    }))
    const { error } = await db.from('candidate_projects').insert(rows)
    if (error) console.error('[Upload] insert candidate_projects error', error)
    counts.projects = rows.length
  } else counts.projects = 0

  console.debug('[Upload] flat insert counts', counts)
  return counts
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('resume') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Resolve authenticated user from session cookie
    const sessionToken = request.cookies.get('session_token')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const nowIso = new Date().toISOString()
    const { data: session, error: sessionError } = await supabaseAdmin()
      .from('user_sessions')
      .select('user_id')
      .eq('session_token', sessionToken)
      .gt('expires_at', nowIso)
      .single()

    if (sessionError || !session?.user_id) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const subscriberId = session.user_id as string

    // Fetch subscriber to get email
    const { data: subscriber, error: subscriberError } = await supabaseAdmin()
      .from('subscribers')
      .select('email, status')
      .eq('id', subscriberId)
      .single()

    if (subscriberError || !subscriber?.email) {
      return NextResponse.json({ error: 'User not found. Please sign out and sign in again.' }, { status: 401 })
    }

    // Ensure a users row exists for this email and get its id
    const { data: existingUser, error: findUserError } = await supabaseAdmin()
      .from('users')
      .select('id')
      .eq('email', subscriber.email)
      .single()

    let usersId = existingUser?.id as string | undefined

    if (findUserError && (findUserError as any).code === 'PGRST116') {
      const { data: createdUser, error: createUserError } = await supabaseAdmin()
        .from('users')
        .insert({ email: subscriber.email, status: 'active' })
        .select('id')
        .single()

      if (createUserError || !createdUser?.id) {
        return NextResponse.json({ error: 'Failed to initialize user profile.' }, { status: 500 })
      }
      usersId = createdUser.id
    } else if (!usersId) {
      return NextResponse.json({ error: 'Failed to resolve user profile.' }, { status: 500 })
    }

    const userId = usersId as string

    // Process the resume (upload to storage + save metadata)
    const { resumeId, filePath } = await ResumeParser.processResume(userId, file)

    // Generate enhanced candidate profile directly from file using OpenAI
    const enhancedProfile = await llmAnalysisService.generateEnhancedProfileFromFile(file)
    console.debug('[Upload] Enhanced Profile', JSON.stringify(enhancedProfile, null, 2))
    
    // Save enhanced profile to database
    const { success, counts } = await EnhancedCandidateProfileService.saveEnhancedProfile(userId, resumeId, enhancedProfile)
    
    if (!success) {
      throw new Error('Failed to save enhanced profile')
    }

    // Also generate legacy JSON Resume for backward compatibility
    const jsonResume = await llmAnalysisService.generateResumeJsonFromFile(file)
    const legacyCounts = await saveFlatJsonResume(userId, resumeId, jsonResume)

    return NextResponse.json({
      success: true,
      resumeId,
      filePath,
      counts: {
        enhanced: counts,
        legacy: legacyCounts
      },
      enhancedProfile,
      jsonResume
    })

  } catch (error) {
    console.error('Resume upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
