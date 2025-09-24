import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find session and user
    const { data: session, error: sessionError } = await supabase()
      .from('user_sessions')
      .select(`
        *,
        users:user_id (
          id,
          email,
          name,
          status,
          created_at
        )
      `)
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Update last accessed time
    await supabase()
      .from('user_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', session.id)

    return NextResponse.json({
      user: session.users,
      session: {
        id: session.id,
        created_at: session.created_at,
        last_accessed_at: session.last_accessed_at
      }
    })
  } catch (error) {
    console.error('Me API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

