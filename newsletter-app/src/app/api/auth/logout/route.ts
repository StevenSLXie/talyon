import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session_token')?.value

    if (sessionToken) {
      // Delete session from database
      await supabaseAdmin()
        .from('user_sessions')
        .delete()
        .eq('session_token', sessionToken)
    }

    // Clear session cookie
    const response = NextResponse.json({ message: 'Logged out successfully' })
    response.cookies.delete('session_token')

    return response
  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

