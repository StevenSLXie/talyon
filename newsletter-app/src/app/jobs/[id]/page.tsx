'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import UserMenu from '@/components/UserMenu'
import { useAuth } from '@/components/AuthProvider'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
  raw_text?: string
  scraped_at?: string
}

export default function JobDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadJob(params.id as string)
    }
  }, [params.id])

  const loadJob = async (jobId: string) => {
    setLoading(true)
    try {
      // In a real app, this would be an API call to get job by ID
      // For now, we'll simulate loading from our jobs data
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const data = await response.json()
        const foundJob = data.jobs.find((j: Job) => j.job_hash === jobId)
        if (foundJob) {
          setJob(foundJob)
        } else {
          // Fallback to mock data
          setJob(getMockJob(jobId))
        }
      } else {
        setJob(getMockJob(jobId))
      }
    } catch (error) {
      console.error('Error loading job:', error)
      setJob(getMockJob(jobId))
    } finally {
      setLoading(false)
    }
  }

  const getMockJob = (jobId: string): Job => {
    return {
      company: "MICHAEL PAGE INTERNATIONAL PTE LTD",
      title: "Product Reliability & Validation Director",
      location: "Islandwide",
      salary_low: 10000,
      salary_high: 13000,
      industry: "Engineering",
      job_type: "Full Time",
      experience_level: "Director",
      post_date: "2025-09-18",
      job_hash: jobId,
      application_url: "https://example.com/apply1",
      raw_text: "We are looking for a Product Reliability & Validation Director to join our team...",
      scraped_at: "2025-09-18T22:26:15Z"
    }
  }

  const handleSaveJob = async () => {
    if (!job || !user) return

    setSaving(true)
    try {
      const response = await fetch('/api/jobs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_hash: job.job_hash,
          job_title: job.title,
          company: job.company,
          salary_low: job.salary_low,
          salary_high: job.salary_high,
          location: job.location,
          industry: job.industry,
          job_type: job.job_type,
          experience_level: job.experience_level,
          post_date: job.post_date,
          application_url: job.application_url
        })
      })

      if (response.ok) {
        setSaved(true)
      } else {
        console.error('Failed to save job')
      }
    } catch (error) {
      console.error('Error saving job:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleApply = () => {
    if (job?.application_url) {
      window.open(job.application_url, '_blank')
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading job details...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!job) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Job Not Found</h1>
            <p className="text-gray-600 mb-6">The job you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => router.push('/jobs')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Browse All Jobs
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-800 mr-4"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-blue-600">Singapore Jobs</h1>
            </div>
            
            <UserMenu user={user!} />
          </div>
        </header>

        {/* Job Details */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Job Header */}
            <div className="bg-white rounded-lg shadow p-8 mb-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
                  <p className="text-xl text-gray-600 mb-4">{job.company}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {job.location}
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      S${job.salary_low.toLocaleString()} - S${job.salary_high.toLocaleString()}
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {job.job_type}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {job.industry}
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {job.experience_level}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      Posted {new Date(job.post_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleApply}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                >
                  Apply Now
                </button>
                
                <button
                  onClick={handleSaveJob}
                  disabled={saving || saved}
                  className={`px-6 py-3 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    saved
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Job'}
                </button>
              </div>
            </div>

            {/* Job Description */}
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Job Description</h2>
              
              {job.raw_text ? (
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {job.raw_text}
                  </p>
                </div>
              ) : (
                <div className="text-gray-600">
                  <p className="mb-4">
                    We are looking for a {job.title} to join our team at {job.company}.
                  </p>
                  <p className="mb-4">
                    <strong>Requirements:</strong>
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-1">
                    <li>{job.experience_level} level experience</li>
                    <li>Strong background in {job.industry}</li>
                    <li>Excellent communication skills</li>
                    <li>Ability to work in {job.location}</li>
                  </ul>
                  <p className="mb-4">
                    <strong>What we offer:</strong>
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-1">
                    <li>Competitive salary: S${job.salary_low.toLocaleString()} - S${job.salary_high.toLocaleString()}</li>
                    <li>{job.job_type} position</li>
                    <li>Professional development opportunities</li>
                    <li>Great work environment</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Related Jobs */}
            <div className="bg-white rounded-lg shadow p-8 mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Similar Jobs</h2>
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-gray-500">No similar jobs found</p>
                <p className="text-sm text-gray-400">Try browsing all jobs to find more opportunities</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

