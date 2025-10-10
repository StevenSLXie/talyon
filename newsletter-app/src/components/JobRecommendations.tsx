'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import EnhancedJobRecommendationCard from './EnhancedJobRecommendationCard'
import { AdvancedJobRecommendation } from '@/lib/advanced-job-matching'

interface JobRecommendationsProps {
  userId?: string
  refreshTrigger?: number
}

export default function JobRecommendations({ userId, refreshTrigger = 0 }: JobRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<AdvancedJobRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const storageKey = typeof window !== 'undefined' && userId ? `talyon_recommendations_${userId}` : null

  const loadRecommendations = useCallback(async (silent: boolean = false) => {
    if (!userId) {
      setError('User ID is required')
      return
    }

    try {
      if (!silent) setLoading(true)
      setError('')

      const response = await fetch('/api/jobs/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          limit: 8
        })
      })

      if (!response.ok) {
        throw new Error('Failed to load recommendations')
      }

      const data = await response.json()
      const recs = data.recommendations || []
      setRecommendations(recs)

      if (storageKey) {
        try {
          window.sessionStorage.setItem(storageKey, JSON.stringify(recs))
        } catch (error) {
          console.warn('Failed to cache recommendations', error)
        }
      }
    } catch (error) {
      console.error('Error loading recommendations:', error)
      setError('Failed to load job recommendations')
    } finally {
      setLoading(false)
    }
  }, [storageKey, userId])

  useEffect(() => {
    if (!userId) return

    let cacheUsed = false
    if (storageKey) {
      const cached = window.sessionStorage.getItem(storageKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecommendations(parsed)
            setLoading(false)
            cacheUsed = true
          }
        } catch (error) {
          console.warn('Failed to parse cached recommendations', error)
        }
      }
    }

    const silent = cacheUsed && refreshTrigger === 0
    loadRecommendations(silent)
  }, [userId, refreshTrigger, storageKey, loadRecommendations])

  const limitedRecommendations = useMemo(() => {
    return recommendations
      .slice()
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 8)
  }, [recommendations])


  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Your Personalized Job Recommendations
        </h2>
        <div className="flex flex-col items-center py-12">
          <div className="flex items-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-gray-600">Analyzing your profile...</span>
          </div>
          <p className="text-sm text-gray-500 text-center max-w-md">
            ⏱️ This process may take up to 5 minutes as we analyze and score thousands of job opportunities to find your perfect matches.
          </p>
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
          Based on your resume analysis, here are the top {limitedRecommendations.length} jobs that match your profile
        </p>
      </div>

      <div className="space-y-6">
        {limitedRecommendations.map((recommendation, index) => (
          <EnhancedJobRecommendationCard
            key={recommendation.job.id || index}
            recommendation={recommendation}
          />
        ))}
      </div>
    </div>
  )
}