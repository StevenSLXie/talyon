import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'

const preferenceSchema = z.object({
  industries: z.array(z.string()).optional(),
  salary_range: z.string().optional(),
  job_types: z.array(z.string()).optional(),
  experience_levels: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  frequency: z.enum(['daily', 'weekly']).optional(),
  max_jobs_per_email: z.number().min(1).max(20).optional()
})

const updateSchema = z.object({
  email: z.string().email(),
  preferences: preferenceSchema.optional(),
  name: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find subscriber by email
    const { data: subscriber, error: fetchError } = await supabaseAdmin()
      .from('subscribers_test')
      .select('id, email, name, status, preferences, created_at, confirmed_at')
      .eq('email', email)
      .single()

    if (fetchError || !subscriber) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      subscriber: {
        id: subscriber.id,
        email: subscriber.email,
        name: subscriber.name,
        status: subscriber.status,
        preferences: subscriber.preferences,
        created_at: subscriber.created_at,
        confirmed_at: subscriber.confirmed_at
      }
    })

  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = updateSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data provided', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { email, preferences, name } = parsed.data

    const { data: subscriber, error: fetchError } = await supabaseAdmin()
      .from('subscribers_test')
      .select('id, email, status')
      .eq('email', email)
      .single()

    if (fetchError || !subscriber) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      )
    }

    if (subscriber.status === 'unsubscribed') {
      return NextResponse.json(
        { error: 'Cannot update preferences for unsubscribed email' },
        { status: 409 }
      )
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (preferences !== undefined) {
      updateData.preferences = preferences
    }

    if (typeof name === 'string') {
      updateData.name = name
    }

    const { error: updateError } = await supabaseAdmin()
      .from('subscribers_test')
      .update(updateData)
      .eq('id', subscriber.id)

    if (updateError) {
      console.error('Error updating preferences:', updateError)
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Preferences updated successfully',
      email: subscriber.email
    })

  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use PUT to update preferences.' },
    { status: 405 }
  )
}

