'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import UserMenu from '@/components/UserMenu'
import JobCard from '@/components/JobCard'
import { useAuth } from '@/components/AuthProvider'
import { useState, useEffect, useCallback } from 'react'

interface SavedJob {
  id: string
  job_hash: string
  job_title: string
  company: string
  salary_low: number | null
  salary_high: number | null
  location: string | null
  industry: string | null
  job_type: string | null
  experience_level: string | null
  post_date: string | null
  application_url: string | null
  status: 'saved' | 'applied' | 'interviewed' | 'rejected' | 'offered'
  applied_at: string | null
  notes: string | null
  created_at: string
}

export default function SavedJobsPage() {
  const { user } = useAuth()
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const jobsPerPage = 12

  const loadSavedJobs = useCallback(async (page: number, status: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: jobsPerPage.toString(),
        status
      })

      const response = await fetch(`/api/jobs/saved?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSavedJobs(data.jobs || [])
        setTotalPages(data.totalPages || 1)
      } else {
        console.error('Failed to load saved jobs')
      }
    } catch (error) {
      console.error('Error loading saved jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSavedJobs(currentPage, statusFilter)
  }, [currentPage, statusFilter, loadSavedJobs])

  const handleRemoveJob = async (jobHash: string) => {
    try {
      const response = await fetch(`/api/jobs/save?job_hash=${jobHash}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSavedJobs(prev => prev.filter(job => job.job_hash !== jobHash))
      } else {
        console.error('Failed to remove saved job')
      }
    } catch (error) {
      console.error('Error removing saved job:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'saved': 'bg-blue-100 text-blue-800',
      'applied': 'bg-yellow-100 text-yellow-800',
      'interviewed': 'bg-purple-100 text-purple-800',
      'rejected': 'bg-red-100 text-red-800',
      'offered': 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const paginatedJobs = savedJobs.slice(0, jobsPerPage)

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

        {/* Saved Jobs Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Saved Jobs</h1>
            <p className="text-gray-600">Your saved job opportunities</p>
          </div>

          {/* Status Filter */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({savedJobs.length})
              </button>
              <button
                onClick={() => setStatusFilter('saved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === 'saved'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Saved
              </button>
              <button
                onClick={() => setStatusFilter('applied')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === 'applied'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Applied
              </button>
              <button
                onClick={() => setStatusFilter('interviewed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === 'interviewed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Interviewed
              </button>
              <button
                onClick={() => setStatusFilter('offered')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === 'offered'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Offered
              </button>
            </div>
          </div>

          {/* Jobs Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : savedJobs.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Saved Jobs</h3>
              <p className="text-gray-600 mb-6">Start browsing jobs and save the ones you&apos;re interested in.</p>
              <button
                onClick={() => router.push('/jobs')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Browse Jobs
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-gray-600">
                  Showing {paginatedJobs.length} of {savedJobs.length} saved jobs
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {paginatedJobs.map((job) => (
                  <div key={job.id} className="relative">
                    <JobCard
                      job={{
                        company: job.company,
                        title: job.job_title,
                        location: job.location || 'Singapore',
                        salary_low: job.salary_low || 0,
                        salary_high: job.salary_high || 0,
                        industry: job.industry || 'General',
                        job_type: job.job_type || 'Full Time',
                        experience_level: job.experience_level || 'Mid Level',
                        job_hash: job.job_hash
                      }}
                    />
                    
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveJob(job.job_hash)}
                      className="absolute top-4 left-4 p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
                      title="Remove from saved jobs"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* Applied Date */}
                    {job.applied_at && (
                      <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded">
                        Applied {new Date(job.applied_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
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

