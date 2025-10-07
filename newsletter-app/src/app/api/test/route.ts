import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Test Supabase connection by fetching subscribers
    const { data, error } = await supabase
      .from('subscribers')
      .select('id, email, status')
      .limit(5)

    if (error) {
      console.error('Supabase connection error:', error)
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: error.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful',
      data: data,
      count: data?.length || 0
    })

  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
