import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
    const { data: subscriber, error: fetchError } = await supabase
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
    const body = await request.json()
    const { email, preferences, name } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find subscriber by email
    const { data: subscriber, error: fetchError } = await supabase
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

    // Update subscriber preferences
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (preferences) {
      updateData.preferences = preferences
    }

    if (name !== undefined) {
      updateData.name = name
    }

    const { error: updateError } = await supabase
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

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use PUT to update preferences.' },
    { status: 405 }
  )
}

