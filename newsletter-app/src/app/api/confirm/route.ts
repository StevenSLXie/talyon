import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      )
    }

    // Find subscriber by confirmation token
    const { data: subscriber, error: fetchError } = await supabase
      .from('subscribers_test')
      .select('id, email, status')
      .eq('confirmation_token', token)
      .single()

    if (fetchError || !subscriber) {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 404 }
      )
    }

    if (subscriber.status === 'active') {
      return NextResponse.json(
        { error: 'Email already confirmed' },
        { status: 409 }
      )
    }

    // Update subscriber status to active
    const { error: updateError } = await supabase
      .from('subscribers_test')
      .update({
        status: 'active',
        confirmed_at: new Date().toISOString(),
        confirmation_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriber.id)

    if (updateError) {
      console.error('Error confirming subscription:', updateError)
      return NextResponse.json(
        { error: 'Failed to confirm subscription' },
        { status: 500 }
      )
    }

    // TODO: Send welcome email

    return NextResponse.json({
      message: 'Email confirmed successfully',
      email: subscriber.email,
      status: 'active'
    })

  } catch (error) {
    console.error('Confirmation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      )
    }

    // Find subscriber by confirmation token
    const { data: subscriber, error: fetchError } = await supabase
      .from('subscribers_test')
      .select('id, email, status')
      .eq('confirmation_token', token)
      .single()

    if (fetchError || !subscriber) {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 404 }
      )
    }

    if (subscriber.status === 'active') {
      return NextResponse.json({
        message: 'Email already confirmed',
        email: subscriber.email,
        status: 'active'
      })
    }

    // Update subscriber status to active
    const { error: updateError } = await supabase
      .from('subscribers_test')
      .update({
        status: 'active',
        confirmed_at: new Date().toISOString(),
        confirmation_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriber.id)

    if (updateError) {
      console.error('Error confirming subscription:', updateError)
      return NextResponse.json(
        { error: 'Failed to confirm subscription' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Email confirmed successfully',
      email: subscriber.email,
      status: 'active'
    })

  } catch (error) {
    console.error('Confirmation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

