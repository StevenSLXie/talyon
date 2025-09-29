import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get user from session (you'll need to implement session handling)
    const userId = 'temp-user-id' // Replace with actual user ID from session

    // Fetch candidate profile data from all related tables
    const [
      { data: profile, error: profileError },
      { data: skills, error: skillsError },
      { data: workExperience, error: workError },
      { data: education, error: educationError },
      { data: certifications, error: certError }
    ] = await Promise.all([
      supabase()
        .from('candidate_basics')
        .select('*')
        .eq('user_id', userId)
        .single(),
      
      supabase()
        .from('candidate_skills')
        .select('*')
        .eq('user_id', userId),
      
      supabase()
        .from('candidate_work')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false }),
      
      supabase()
        .from('candidate_education')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false }),
      
      supabase()
        .from('candidate_certifications')
        .select('*')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false })
    ])

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Profile fetch failed: ${profileError.message}`)
    }

    if (skillsError) {
      throw new Error(`Skills fetch failed: ${skillsError.message}`)
    }

    if (workError) {
      throw new Error(`Work experience fetch failed: ${workError.message}`)
    }

    if (educationError) {
      throw new Error(`Education fetch failed: ${educationError.message}`)
    }

    if (certError) {
      throw new Error(`Certifications fetch failed: ${certError.message}`)
    }

    return NextResponse.json({
      profile: profile || null,
      skills: skills || [],
      workExperience: workExperience || [],
      education: education || [],
      certifications: certifications || []
    })

  } catch (error) {
    console.error('Candidate profile fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch candidate profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = 'temp-user-id' // Replace with actual user ID from session
    const { profile, skills, workExperience, education, certifications } = await request.json()

    // Update candidate basics
    if (profile) {
      const { error: profileError } = await supabase()
        .from('candidate_basics')
        .upsert({
          user_id: userId,
          ...profile,
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        throw new Error(`Profile update failed: ${profileError.message}`)
      }
    }

    // Update skills
    if (skills && Array.isArray(skills)) {
      // Delete existing skills
      await supabase()
        .from('candidate_skills')
        .delete()
        .eq('user_id', userId)

      // Insert new skills
      if (skills.length > 0) {
        const skillsWithUserId = skills.map(skill => ({
          ...skill,
          user_id: userId
        }))

        const { error: skillsError } = await supabase()
          .from('candidate_skills')
          .insert(skillsWithUserId)

        if (skillsError) {
          throw new Error(`Skills update failed: ${skillsError.message}`)
        }
      }
    }

    // Update work experience
    if (workExperience && Array.isArray(workExperience)) {
      // Delete existing work experience
      await supabase()
        .from('candidate_work')
        .delete()
        .eq('user_id', userId)

      // Insert new work experience
      if (workExperience.length > 0) {
        const workWithUserId = workExperience.map(work => ({
          ...work,
          user_id: userId
        }))

        const { error: workError } = await supabase()
          .from('candidate_work')
          .insert(workWithUserId)

        if (workError) {
          throw new Error(`Work experience update failed: ${workError.message}`)
        }
      }
    }

    // Update education
    if (education && Array.isArray(education)) {
      // Delete existing education
      await supabase()
        .from('candidate_education')
        .delete()
        .eq('user_id', userId)

      // Insert new education
      if (education.length > 0) {
        const educationWithUserId = education.map(edu => ({
          ...edu,
          user_id: userId
        }))

        const { error: educationError } = await supabase()
          .from('candidate_education')
          .insert(educationWithUserId)

        if (educationError) {
          throw new Error(`Education update failed: ${educationError.message}`)
        }
      }
    }

    // Update certifications
    if (certifications && Array.isArray(certifications)) {
      // Delete existing certifications
      await supabase()
        .from('candidate_certifications')
        .delete()
        .eq('user_id', userId)

      // Insert new certifications
      if (certifications.length > 0) {
        const certsWithUserId = certifications.map(cert => ({
          ...cert,
          user_id: userId
        }))

        const { error: certError } = await supabase()
          .from('candidate_certifications')
          .insert(certsWithUserId)

        if (certError) {
          throw new Error(`Certifications update failed: ${certError.message}`)
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Candidate profile update error:', error)
    return NextResponse.json(
      { error: 'Failed to update candidate profile' },
      { status: 500 }
    )
  }
}
