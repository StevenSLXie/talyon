import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest) {
  try {
    const db = supabaseAdmin()

    // Total jobs
    const { count: totalJobs, error: totalErr } = await db
      .from('jobs')
      .select('*', { count: 'exact', head: true })

    if (totalErr) {
      console.error('[Stats] total jobs error:', totalErr)
      return NextResponse.json({ error: 'Failed to fetch total jobs' }, { status: 500 })
    }

    // New jobs today (Singapore timezone naive: use local server date-start)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const { count: newJobsToday, error: newErr } = await db
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfToday.toISOString())

    if (newErr) {
      console.error('[Stats] new jobs today error:', newErr)
      return NextResponse.json({ error: 'Failed to fetch new jobs' }, { status: 500 })
    }

    // Companies (distinct). PostgREST distinct can be emulated via `select('company', { count: 'exact', head: true })`
    // Note: This counts rows, not strictly distinct in some setups; adjust to RPC if exact distinct is needed.
    const { count: totalCompaniesCount, error: companiesErr } = await db
      .from('jobs')
      .select('company', { count: 'exact', head: true })
      .not('company', 'is', null)

    if (companiesErr) {
      console.error('[Stats] companies count error:', companiesErr)
      return NextResponse.json({ error: 'Failed to fetch companies count' }, { status: 500 })
    }

    return NextResponse.json({
      totalJobs: totalJobs || 0,
      totalCompanies: totalCompaniesCount || 0,
      newJobsToday: newJobsToday || 0,
    })
  } catch (error) {
    console.error('[Stats] API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


