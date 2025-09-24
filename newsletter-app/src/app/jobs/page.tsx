'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import UserMenu from '@/components/UserMenu'
import JobCard from '@/components/JobCard'
import JobFilters, { FilterState } from '@/components/JobFilters'
import { useAuth } from '@/components/AuthProvider'
import { useState, useEffect } from 'react'

interface Job {
  company: string
  title: string
  location: string
  salary_low: number
  salary_high: number
  industry: string
  job_type: string
  experience_level: string
  post_date: string
  job_hash: string
  application_url?: string
}

export default function JobsPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    industry: 'All Industries',
    location: 'All Locations',
    salaryMin: null,
    salaryMax: null,
    jobType: 'All Types',
    experienceLevel: 'All Levels',
    sortBy: 'newest'
  })
  const jobsPerPage = 12

  useEffect(() => {
    loadJobs()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [jobs, filters])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [filters])

  const loadJobs = async () => {
    setLoading(true)
    try {
      // In a real app, this would be an API call
      // For now, we'll simulate loading from the refined JSON
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      } else {
        // Fallback to mock data if API fails
        setJobs(getMockJobs())
      }
    } catch (error) {
      console.error('Error loading jobs:', error)
      // Fallback to mock data
      setJobs(getMockJobs())
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...jobs]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(job =>
        job.title?.toLowerCase().includes(searchLower) ||
        job.company?.toLowerCase().includes(searchLower) ||
        job.industry?.toLowerCase().includes(searchLower)
      )
    }

    // Industry filter
    if (filters.industry !== 'All Industries') {
      filtered = filtered.filter(job =>
        job.industry?.toLowerCase().includes(filters.industry.toLowerCase())
      )
    }

    // Location filter
    if (filters.location !== 'All Locations') {
      filtered = filtered.filter(job =>
        job.location?.toLowerCase().includes(filters.location.toLowerCase())
      )
    }

    // Salary filters
    if (filters.salaryMin !== null) {
      filtered = filtered.filter(job => job.salary_low >= filters.salaryMin!)
    }
    if (filters.salaryMax !== null) {
      filtered = filtered.filter(job => job.salary_high <= filters.salaryMax!)
    }

    // Job type filter
    if (filters.jobType !== 'All Types') {
      filtered = filtered.filter(job =>
        job.job_type?.toLowerCase().includes(filters.jobType.toLowerCase())
      )
    }

    // Experience level filter
    if (filters.experienceLevel !== 'All Levels') {
      filtered = filtered.filter(job =>
        job.experience_level?.toLowerCase().includes(filters.experienceLevel.toLowerCase())
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.post_date).getTime() - new Date(a.post_date).getTime()
        case 'oldest':
          return new Date(a.post_date).getTime() - new Date(b.post_date).getTime()
        case 'salary_high':
          return b.salary_high - a.salary_high
        case 'salary_low':
          return a.salary_low - b.salary_low
        case 'company':
          return a.company.localeCompare(b.company)
        default:
          return 0
      }
    })

    setFilteredJobs(filtered)
    setTotalPages(Math.ceil(filtered.length / jobsPerPage))
  }

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
  }

  const getMockJobs = (): Job[] => {
    // Mock data based on our refined jobs
    return [
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
      },
      // Add more mock jobs...
      ...Array.from({ length: 20 }, (_, i) => ({
        company: `Company ${i + 4}`,
        title: `Software Engineer ${i + 4}`,
        location: "Singapore",
        salary_low: 5000 + (i * 500),
        salary_high: 8000 + (i * 500),
        industry: "IT",
        job_type: "Full Time",
        experience_level: "Mid Level",
        post_date: "2025-09-18",
        job_hash: `hash${i + 4}`,
        application_url: `https://example.com/apply${i + 4}`
      }))
    ]
  }

  const paginatedJobs = filteredJobs.slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-blue-600">Singapore Jobs</h1>
            </div>
            
            <UserMenu user={user!} />
          </div>
        </header>

        {/* Jobs Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Listings</h1>
            <p className="text-gray-600">Find your next opportunity in Singapore</p>
          </div>

          {/* Search and Filters */}
          <JobFilters onFiltersChange={handleFiltersChange} loading={loading} />

          {/* Jobs Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-gray-600">
                  Showing {paginatedJobs.length} of {filteredJobs.length} jobs
                  {filteredJobs.length !== jobs.length && ` (filtered from ${jobs.length} total)`}
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {paginatedJobs.map((job, index) => {
                  // Debug logging
                  if (!job) {
                    console.error('Undefined job at index:', index, job);
                    return <div key={index}>Error: No job data</div>;
                  }
                  
                  return (
                    <JobCard
                      key={job.job_hash || index}
                      job={job}
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-lg ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
