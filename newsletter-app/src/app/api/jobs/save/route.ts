import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const { 
      job_hash, 
      job_title, 
      company, 
      salary_low, 
      salary_high, 
      location, 
      industry, 
      job_type, 
      experience_level, 
      post_date, 
      application_url 
    } = await req.json()

    if (!job_hash || !job_title || !company) {
      return NextResponse.json(
        { error: 'Missing required job information' },
        { status: 400 }
      )
    }

    // Check if job is already saved
    const { data: existingJob } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_id', user.id)
      .eq('job_hash', job_hash)
      .single()

    if (existingJob) {
      return NextResponse.json(
        { error: 'Job already saved' },
        { status: 409 }
      )
    }

    // Save the job
    const { data, error } = await supabase
      .from('saved_jobs')
      .insert({
        user_id: user.id,
        job_hash,
        job_title,
        company,
        salary_low: salary_low || null,
        salary_high: salary_high || null,
        location: location || null,
        industry: industry || null,
        job_type: job_type || null,
        experience_level: experience_level || null,
        post_date: post_date || null,
        application_url: application_url || null,
        status: 'saved'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving job:', error)
      return NextResponse.json(
        { error: 'Failed to save job' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Job saved successfully',
      savedJob: data
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    console.error('Save job API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const jobHash = searchParams.get('job_hash')

    if (!jobHash) {
      return NextResponse.json(
        { error: 'Job hash is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('user_id', user.id)
      .eq('job_hash', jobHash)

    if (error) {
      console.error('Error removing saved job:', error)
      return NextResponse.json(
        { error: 'Failed to remove saved job' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Job removed from saved jobs'
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    console.error('Remove saved job API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

