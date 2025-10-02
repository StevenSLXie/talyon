import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const industry = searchParams.get('industry')
    const location = searchParams.get('location')
    const search = searchParams.get('search')

    // Build query
    let query = supabaseAdmin()
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (industry && industry !== 'all') {
      query = query.ilike('industry', `%${industry}%`)
    }

    if (location && location !== 'all') {
      query = query.ilike('location', `%${location}%`)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,industry.ilike.%${search}%`)
    }

    // Get total count for pagination
    const { count } = await query.select('*', { count: 'exact', head: true })

    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit - 1
    query = query.range(startIndex, endIndex)

    const { data: jobs, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error) {
    console.error('Jobs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
