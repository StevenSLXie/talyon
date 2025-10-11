import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validate } from 'email-validator'
import { randomInt } from 'crypto'
import nodemailer from 'nodemailer'

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

    // Send email with login code using Gmail only
    try {
      const gmailUser = process.env.GMAIL_USER
      const gmailPass = process.env.GMAIL_APP_PASSWORD
      
      if (!gmailUser || !gmailPass) {
        console.error('Gmail credentials not configured')
        console.log(`⚠️  Gmail not configured. Login code for ${email}: ${code}`)
        return NextResponse.json({
          message: 'Login code generated (Gmail not configured, check console)',
          email,
          expiresIn: 10 * 60,
          code: code // Include code in response for development
        })
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      })

      await transporter.sendMail({
        from: `"Talyon" <${gmailUser}>`,
        to: email,
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
            <p style="color: #6b7280; font-size: 14px;">Talyon - Find your perfect job match in minutes</p>
          </div>
        `
      })

      console.log(`✅ Login code sent via Gmail to ${email}`)
      return NextResponse.json({
        message: 'Login code sent successfully via email',
        email,
        expiresIn: 10 * 60
      })
      
    } catch (emailError) {
      console.error('Gmail sending error:', emailError)
      // Fallback: log to console
      console.log(`⚠️  Gmail failed. Login code for ${email}: ${code}`)
      
      return NextResponse.json({
        message: 'Login code generated (email failed, check console)',
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