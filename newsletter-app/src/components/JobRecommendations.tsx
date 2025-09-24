'use client'

import { useState, useEffect } from 'react'
import JobCard from './JobCard'

interface JobRecommendation {
  job: any
  match_score: number
  match_reasons: string[]
}

interface JobRecommendationsProps {
  limit?: number
  userId?: string
}

export default function JobRecommendations({ limit = 3, userId }: JobRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRecommendations()
  }, [userId])

  const loadRecommendations = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/jobs/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId || 'temp-user-id', // This should come from auth
          limit
        })
      })

      if (!response.ok) {
        throw new Error('Failed to load recommendations')
      }

      const data = await response.json()
      setRecommendations(data.recommendations || [])
    } catch (error) {
      console.error('Error loading recommendations:', error)
      setError('Failed to load job recommendations')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Your Personalized Job Recommendations
        </h2>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600">Analyzing your profile...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Your Personalized Job Recommendations
        </h2>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadRecommendations}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Your Personalized Job Recommendations
        </h2>
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">
            No personalized recommendations available yet.
          </p>
          <p className="text-sm text-gray-500">
            Upload your resume to get targeted job recommendations based on your experience and skills.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Your Personalized Job Recommendations
        </h2>
        <p className="text-gray-600">
          Based on your resume analysis, here are the top {recommendations.length} jobs that match your profile
        </p>
      </div>

      <div className="space-y-6">
        {recommendations.map((recommendation, index) => (
          <div key={recommendation.job.id} className="relative">
            {/* Match Score Badge */}
            <div className="absolute -top-2 -right-2 z-10">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                {recommendation.match_score}% Match
              </div>
            </div>

            {/* Job Card */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              <JobCard job={recommendation.job} />
              
              {/* Match Reasons */}
              <div className="px-6 pb-6">
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Why this job matches you:
                  </h4>
                  <ul className="space-y-1">
                    {recommendation.match_reasons.map((reason, reasonIndex) => (
                      <li key={reasonIndex} className="flex items-start text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="text-center mt-8">
        <div className="flex justify-center space-x-4">
          <button
            onClick={loadRecommendations}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            Refresh Recommendations
          </button>
          <a
            href="/jobs"
            className="bg-white text-blue-600 px-6 py-3 rounded-lg border border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            Browse All Jobs
          </a>
        </div>
      </div>
    </div>
  )
}