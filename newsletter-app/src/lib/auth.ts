import { NextRequest } from 'next/server'
import { supabase } from './supabase'

export interface User {
  id: string
  email: string
  name: string | null
  status: 'pending' | 'active' | 'unsubscribed'
  preferences: Record<string, unknown> | null
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  session_token: string
  expires_at: string
  created_at: string
  last_accessed_at: string
}

export async function getCurrentUser(req: NextRequest): Promise<User | null> {
  try {
    const sessionToken = req.cookies.get('session_token')?.value

    if (!sessionToken) {
      return null
    }

    const { data: session, error } = await supabase
      .from('user_sessions')
      .select(`
        *,
        subscribers:user_id (
          id,
          email,
          name,
          status,
          preferences,
          created_at
        )
      `)
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !session) {
      return null
    }

    return session.subscribers as User
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

export async function requireAuth(req: NextRequest): Promise<User> {
  const user = await getCurrentUser(req)
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

export type AuthResponse = Response

export function createAuthResponse<T>(data: T, status: number = 200): AuthResponse {
  return Response.json(data, { status })
}

export function createUnauthorizedResponse(message: string = 'Authentication required'): AuthResponse {
  return Response.json({ error: message }, { status: 401 })
}

