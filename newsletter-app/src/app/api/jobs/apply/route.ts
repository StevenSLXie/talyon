import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const { 
      job_hash, 
      application_url, 
      notes 
    } = await req.json()

    if (!job_hash) {
      return NextResponse.json(
        { error: 'Job hash is required' },
        { status: 400 }
      )
    }

    // Check if application already exists
    const { data: existingApplication } = await supabase
      .from('job_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('job_hash', job_hash)
      .single()

    if (existingApplication) {
      return NextResponse.json(
        { error: 'Application already exists for this job' },
        { status: 409 }
      )
    }

    // Create application record
    const { data, error } = await supabase
      .from('job_applications')
      .insert({
        user_id: user.id,
        job_hash,
        application_url: application_url || null,
        status: 'applied',
        notes: notes || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating application:', error)
      return NextResponse.json(
        { error: 'Failed to create application record' },
        { status: 500 }
      )
    }

    // Update saved job status if it exists
    await supabase
      .from('saved_jobs')
      .update({ 
        status: 'applied',
        applied_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('job_hash', job_hash)

    return NextResponse.json({
      message: 'Application recorded successfully',
      application: data
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    console.error('Apply job API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const { 
      job_hash, 
      status, 
      notes, 
      follow_up_date 
    } = await req.json()

    if (!job_hash || !status) {
      return NextResponse.json(
        { error: 'Job hash and status are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('job_applications')
      .update({
        status,
        notes: notes || null,
        follow_up_date: follow_up_date || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('job_hash', job_hash)
      .select()
      .single()

    if (error) {
      console.error('Error updating application:', error)
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Application updated successfully',
      application: data
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    console.error('Update application API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

