import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validate } from 'email-validator'
import { randomInt } from 'crypto'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || !validate(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // Generate 6-digit code
    const code = randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    // Clean up any existing codes for this email
    await supabase()
      .from('login_codes')
      .delete()
      .eq('email', email)
      .is('used_at', null)

    // Insert new login code
    const { data: insertedCode, error } = await supabase()
      .from('login_codes')
      .insert({
        email,
        code,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    console.log('Code inserted:', { email, code, insertedCode, error })

    if (error) {
      console.error('Error creating login code:', error)
      return NextResponse.json(
        { error: 'Failed to create login code' },
        { status: 500 }
      )
    }

    // Send email with login code
    try {
      const resendApiKey = process.env.RESEND_API_KEY
      
      if (!resendApiKey || resendApiKey === 'your_resend_api_key_here') {
        // No API key configured, fallback to console logging
        console.log(`Login code for ${email}: ${code}`)
        return NextResponse.json({
          message: 'Login code generated successfully (email not configured, check console)',
          email,
          expiresIn: 10 * 60,
          code: code // Include code in response for development
        })
      }
      
      const resend = new Resend(resendApiKey)
      
      const { error: emailError } = await resend.emails.send({
        from: 'Talyon <onboarding@resend.dev>',
        to: [email],
        subject: 'Your Login Code - Talyon',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #000000;">Talyon</h2>
            <p>Hello!</p>
            <p>Your login code is:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #1f2937; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">Talyon - AI-powered job matching for Singapore</p>
          </div>
        `
      })

      if (emailError) {
        console.error('Email sending error:', emailError)
        
        // Check if it's a domain verification error (403)
        const isDomainError = emailError && typeof emailError === 'object' && 'statusCode' in emailError && emailError.statusCode === 403
        
        // Log to console as fallback
        console.log(`⚠️  Login code for ${email}: ${code}`)
        
        if (isDomainError) {
          console.warn('⚠️  Resend domain not verified. Email sent to console only.')
        }
        
        return NextResponse.json({
          message: isDomainError 
            ? 'Login code generated (domain verification required for email delivery)' 
            : 'Login code generated successfully (email failed, check console)',
          email,
          expiresIn: 10 * 60,
          code: code // Include code in response for development/testing
        })
      }

      console.log(`Login code sent via email to ${email}: ${code}`)
      
      return NextResponse.json({
        message: 'Login code sent successfully via email',
        email,
        expiresIn: 10 * 60 // 10 minutes in seconds
      })
    } catch (emailError) {
      console.error('Email service error:', emailError)
      // Fallback: log to console
      console.log(`Login code for ${email}: ${code}`)
      
      return NextResponse.json({
        message: 'Login code generated successfully (email service unavailable, check console)',
        email,
        expiresIn: 10 * 60,
        code: code // Include code in response for development
      })
    }
  } catch (error) {
    console.error('Send code API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
