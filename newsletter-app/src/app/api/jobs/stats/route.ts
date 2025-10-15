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

    // Companies (distinct): fetch company column and dedupe in memory (MVP-safe)
    const { data: companyRows, error: companiesErr } = await db
      .from('jobs')
      .select('company')
      .not('company', 'is', null)
      .neq('company', '')
      .limit(10000)

    if (companiesErr) {
      console.error('[Stats] companies fetch error:', companiesErr)
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
    }

    const totalCompaniesCount = new Set(
      (companyRows || [])
        .map((r: any) => (typeof r.company === 'string' ? r.company.trim().toLowerCase() : ''))
        .filter(Boolean)
    ).size

    return NextResponse.json({
      totalJobs: totalJobs || 0,
      totalCompanies: totalCompaniesCount,
      newJobsToday: newJobsToday || 0,
    })
  } catch (error) {
    console.error('[Stats] API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


