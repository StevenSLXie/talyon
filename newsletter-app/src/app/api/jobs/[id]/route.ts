import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface RouteContext {
  params: { id: string }
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await Promise.resolve(context.params)
    const client: SupabaseClient = supabase()
    const { data, error } = await client
      .from('jobs')
      .select('*')
      .eq('job_hash', params.id)
      .single()

    if (error) {
      console.error('Error fetching job:', error)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ job: data })
  } catch (error) {
    console.error('Error in jobs/[id] API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
