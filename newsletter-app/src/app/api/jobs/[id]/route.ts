import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase()
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
