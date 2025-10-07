import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { randomBytes } from 'crypto'
import { validate } from 'email-validator'

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()

    if (!email || !validate(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Valid 6-digit code is required' }, { status: 400 })
    }

    // Find the login code
    const { data: loginCode, error: fetchError } = await supabase()
      .from('login_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .is('used_at', null)
      .not('expires_at', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    console.log('Verification attempt:', { email, code, loginCode, fetchError })

    if (fetchError || !loginCode) {
      console.log('Verification failed:', { fetchError, loginCode })
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      )
    }

    // Check if too many attempts
    if (loginCode.attempts >= 5) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new code.' },
        { status: 429 }
      )
    }

    // Mark code as used
    await supabase()
      .from('login_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', loginCode.id)

    // Check if subscriber exists, create if not
    const { data: existingSubscriber, error: subscriberError } = await supabase()
      .from('subscribers')
      .select('*')
      .eq('email', email)
      .single()

    let subscriber = existingSubscriber

    if (subscriberError && subscriberError.code === 'PGRST116') {
      // Subscriber doesn't exist, create new
      const { data: newSubscriber, error: createError } = await supabase()
        .from('subscribers')
        .insert({
          email,
          status: 'active',
          confirmed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating subscriber:', createError)
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        )
      }
      subscriber = newSubscriber
    } else if (subscriberError) {
      console.error('Error fetching subscriber:', subscriberError)
      return NextResponse.json(
        { error: 'Failed to verify user' },
        { status: 500 }
      )
    } else {
      // Update existing subscriber to active if needed
      if (subscriber && subscriber.status !== 'active') {
        const { data: updatedSubscriber, error: updateError } = await supabase()
          .from('subscribers')
          .update({
            status: 'active',
            confirmed_at: new Date().toISOString()
          })
          .eq('id', subscriber.id)
          .select()
          .single()

        if (updateError) {
          console.error('Error updating subscriber:', updateError)
        } else {
          subscriber = updatedSubscriber
        }
      }
    }

    // Mirror into users table for resume/profile features
    const { data: existingUser } = await supabase()
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (!existingUser) {
      // Create user row if missing
      await supabase()
        .from('users')
        .insert({ email, status: 'active' })
    }

    // Create session (FK to subscribers.id)
    const sessionToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const { error: sessionError } = await supabase()
      .from('user_sessions')
      .insert({
        user_id: subscriber.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        user_agent: req.headers.get('user-agent'),
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      })

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Set session cookie
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: subscriber.id,
        email: subscriber.email,
        name: subscriber.name,
        status: subscriber.status
      }
    })

    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    })

    return response
  } catch (error) {
    console.error('Verify code API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

