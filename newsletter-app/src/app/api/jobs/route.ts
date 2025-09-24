import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  try {
    // Try to load the refined jobs JSON file
    const jobsFilePath = path.join(process.cwd(), 'data', 'refined_jobs_20250918_222615.json')
    
    let jobs = []
    
    try {
      if (fs.existsSync(jobsFilePath)) {
        const fileContent = fs.readFileSync(jobsFilePath, 'utf8')
        const jobsData = JSON.parse(fileContent)
        jobs = jobsData.jobs || jobsData || []
      }
    } catch (fileError) {
      console.error('Error reading jobs file:', fileError)
    }

    // If no jobs loaded from file, return mock data
    if (jobs.length === 0) {
      jobs = [
        {
          company: "MICHAEL PAGE INTERNATIONAL PTE LTD",
          title: "Product Reliability & Validation Director",
          location: "Islandwide",
          salary_low: 10000,
          salary_high: 13000,
          industry: "Engineering",
          job_type: "Full Time",
          experience_level: "Director",
          post_date: "2025-09-18",
          job_hash: "hash1",
          application_url: "https://example.com/apply1"
        },
        {
          company: "AEROSPEC SUPPLIES PTE LTD",
          title: "Head of Production (Operation)",
          location: "Islandwide",
          salary_low: 10000,
          salary_high: 15000,
          industry: "Engineering",
          job_type: "Full Time",
          experience_level: "Senior Executive",
          post_date: "2025-09-18",
          job_hash: "hash2",
          application_url: "https://example.com/apply2"
        },
        {
          company: "RAINBOW HUES PTE. LTD.",
          title: "Admin / Secretarial",
          location: "Islandwide",
          salary_low: 1500,
          salary_high: 2500,
          industry: "Admin",
          job_type: "Part Time",
          experience_level: "Executive",
          post_date: "2025-09-18",
          job_hash: "hash3",
          application_url: "https://example.com/apply3"
        }
      ]
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const industry = searchParams.get('industry')
    const location = searchParams.get('location')
    const search = searchParams.get('search')

    // Apply filters
    let filteredJobs = jobs

    if (industry && industry !== 'all') {
      filteredJobs = filteredJobs.filter(job => 
        job.industry?.toLowerCase().includes(industry.toLowerCase())
      )
    }

    if (location && location !== 'all') {
      filteredJobs = filteredJobs.filter(job => 
        job.location?.toLowerCase().includes(location.toLowerCase())
      )
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filteredJobs = filteredJobs.filter(job => 
        job.title?.toLowerCase().includes(searchLower) ||
        job.company?.toLowerCase().includes(searchLower) ||
        job.industry?.toLowerCase().includes(searchLower)
      )
    }

    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex)

    return NextResponse.json({
      jobs: paginatedJobs,
      total: filteredJobs.length,
      page,
      limit,
      totalPages: Math.ceil(filteredJobs.length / limit)
    })
  } catch (error) {
    console.error('Jobs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
