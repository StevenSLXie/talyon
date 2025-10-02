'use client'

import { useState, useEffect, useMemo } from 'react'
import EnhancedJobRecommendationCard from './EnhancedJobRecommendationCard'
import MatchFilter from './MatchFilter'
import { AdvancedJobRecommendation } from '@/lib/advanced-job-matching'

interface JobRecommendation {
  job: any
  match_score: number
  match_reasons: string[]
  breakdown: {
    title_match: number
    salary_match: number
    skills_match: number
    experience_match: number
    education_match: number
    certification_match: number
    job_family_match: number
    work_prefs_match: number
    industry_match: number
  }
  why_match: {
    strengths: string[]
    concerns: string[]
    overall_assessment: string
  }
  gaps_and_actions: {
    skill_gaps: Array<{ skill: string; current_level: number; required_level: number; action: string }>
    experience_gap?: { gap_years: number; action: string }
    education_gaps: Array<{ requirement: string; action: string }>
    certification_gaps: Array<{ requirement: string; action: string }>
    interview_prep: string[]
  }
  personalized_suggestions?: any
}

interface JobRecommendationsProps {
  limit?: number
  userId?: string
  refreshTrigger?: number // Add refresh trigger prop
}

export default function JobRecommendations({ limit = 3, userId, refreshTrigger = 0 }: JobRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<AdvancedJobRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    minScore: 0,
    maxScore: 100,
    showHighProbability: true,
    showMediumProbability: true,
    showLowProbability: false
  })
  const [sortBy, setSortBy] = useState<'score' | 'salary' | 'company'>('score')
  const [showAdvancedAnalysis, setShowAdvancedAnalysis] = useState(false)

  useEffect(() => {
    if (userId && refreshTrigger > 0) { // Only load when userId exists and refreshTrigger is valid
      loadRecommendations()
    }
  }, [userId, refreshTrigger])

  // Filter and sort recommendations
  const filteredAndSortedRecommendations = useMemo(() => {
    let filtered = recommendations.filter(rec => {
      const score = rec.match_score
      
      // Score range filter
      if (score < filters.minScore || score > filters.maxScore) {
        return false
      }
      
      // Probability category filter
      if (score >= 70 && !filters.showHighProbability) return false
      if (score >= 50 && score < 70 && !filters.showMediumProbability) return false
      if (score < 50 && !filters.showLowProbability) return false
      
      return true
    })

    // Sort recommendations
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.match_score - a.match_score
        case 'salary':
          return (b.job.salary_high + b.job.salary_low) - (a.job.salary_high + a.job.salary_low)
        case 'company':
          return a.job.company.localeCompare(b.job.company)
        default:
          return b.match_score - a.match_score
      }
    })

    return filtered
  }, [recommendations, filters, sortBy])

  const loadRecommendations = async () => {
    if (!userId) {
      setError('User ID is required')
      return
    }
    
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/jobs/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId, // This should come from auth
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
          Based on your resume analysis, here are the top {filteredAndSortedRecommendations.length} jobs that match your profile
        </p>
      </div>

      {/* Filter and Sort Controls */}
      <MatchFilter onFilterChange={setFilters} />
      
      {/* Sort Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          <div className="flex space-x-2">
            {[
              { key: 'score', label: 'Match Score' },
              { key: 'salary', label: 'Salary' },
              { key: 'company', label: 'Company' }
            ].map((option) => (
          <button
                key={option.key}
                onClick={() => setSortBy(option.key as any)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  sortBy === option.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
          </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Showing {filteredAndSortedRecommendations.length} of {recommendations.length} recommendations
        </p>
            </div>

      <div className="space-y-6">
        {filteredAndSortedRecommendations.map((recommendation, index) => (
          <EnhancedJobRecommendationCard
            key={recommendation.job.id || index}
            recommendation={recommendation}
            index={index}
          />
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