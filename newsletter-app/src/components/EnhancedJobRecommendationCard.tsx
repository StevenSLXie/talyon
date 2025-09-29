'use client'

import { useState } from 'react'
import JobCard from './JobCard'

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
  personalized_suggestions?: {
    skill_gaps: any[]
    experience_gaps: any[]
    education_gaps: any[]
    certification_gaps: any[]
    interview_prep: any[]
    overall_strategy: string
  }
}

interface EnhancedJobRecommendationCardProps {
  recommendation: JobRecommendation
  index: number
}

export default function EnhancedJobRecommendationCard({ recommendation, index }: EnhancedJobRecommendationCardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'gaps' | 'suggestions'>('overview')
  const [isExpanded, setIsExpanded] = useState(false)

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getMatchScoreText = (score: number) => {
    if (score >= 80) return 'Excellent Match'
    if (score >= 60) return 'Good Match'
    if (score >= 40) return 'Fair Match'
    return 'Weak Match'
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Match Score Badge */}
      <div className="absolute -top-2 -right-2 z-10">
        <div className={`${getMatchScoreColor(recommendation.match_score)} text-white px-3 py-1 rounded-full text-sm font-medium`}>
          {recommendation.match_score}% Match
        </div>
      </div>

      {/* Job Card */}
      <div className="p-6">
        <JobCard job={recommendation.job} />
      </div>

      {/* Match Assessment */}
      <div className="px-6 pb-4">
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-gray-900">
              Match Assessment
            </h4>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {isExpanded ? 'Show Less' : 'Show Details'}
            </button>
          </div>
          
          <div className="mb-3">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-medium">Overall:</span> {recommendation.why_match.overall_assessment}
            </p>
            
            {recommendation.why_match.strengths.length > 0 && (
              <div className="mb-2">
                <span className="text-sm font-medium text-green-700">Strengths:</span>
                <ul className="mt-1 space-y-1">
                  {recommendation.why_match.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start text-sm text-green-600">
                      <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommendation.why_match.concerns.length > 0 && (
              <div className="mb-2">
                <span className="text-sm font-medium text-orange-700">Areas to Address:</span>
                <ul className="mt-1 space-y-1">
                  {recommendation.why_match.concerns.map((concern, idx) => (
                    <li key={idx} className="flex items-start text-sm text-orange-600">
                      <svg className="w-4 h-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Tab Navigation */}
          <div className="px-6 py-3 bg-gray-50">
            <div className="flex space-x-1">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'breakdown', label: 'Score Breakdown' },
                { key: 'gaps', label: 'Gaps & Actions' },
                { key: 'suggestions', label: 'AI Suggestions' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Why This Job Matches You:</h5>
                  <ul className="space-y-1">
                    {recommendation.match_reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'breakdown' && (
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900 mb-3">Detailed Score Breakdown:</h5>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(recommendation.breakdown).map(([key, score]) => (
                    <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700 capitalize">
                        {key.replace('_', ' ')}
                      </span>
                      <span className={`text-sm font-medium ${getScoreColor(score)}`}>
                        {score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'gaps' && (
              <div className="space-y-4">
                <h5 className="font-medium text-gray-900 mb-3">Gaps & Action Items:</h5>
                
                {recommendation.gaps_and_actions.skill_gaps.length > 0 && (
                  <div>
                    <h6 className="font-medium text-gray-800 mb-2">Skill Gaps:</h6>
                    <div className="space-y-2">
                      {recommendation.gaps_and_actions.skill_gaps.map((gap, idx) => (
                        <div key={idx} className="p-3 bg-orange-50 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-gray-800">{gap.skill}</span>
                            <span className="text-sm text-gray-600">
                              Level {gap.current_level} → {gap.required_level}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{gap.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recommendation.gaps_and_actions.experience_gap && (
                  <div>
                    <h6 className="font-medium text-gray-800 mb-2">Experience Gap:</h6>
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        {recommendation.gaps_and_actions.experience_gap.gap_years} years gap: {recommendation.gaps_and_actions.experience_gap.action}
                      </p>
                    </div>
                  </div>
                )}

                {recommendation.gaps_and_actions.education_gaps.length > 0 && (
                  <div>
                    <h6 className="font-medium text-gray-800 mb-2">Education Gaps:</h6>
                    <div className="space-y-2">
                      {recommendation.gaps_and_actions.education_gaps.map((gap, idx) => (
                        <div key={idx} className="p-3 bg-orange-50 rounded-lg">
                          <p className="font-medium text-gray-800 mb-1">{gap.requirement}</p>
                          <p className="text-sm text-gray-600">{gap.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recommendation.gaps_and_actions.interview_prep.length > 0 && (
                  <div>
                    <h6 className="font-medium text-gray-800 mb-2">Interview Preparation:</h6>
                    <ul className="space-y-1">
                      {recommendation.gaps_and_actions.interview_prep.map((tip, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-600">
                          <svg className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'suggestions' && recommendation.personalized_suggestions && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h6 className="font-medium text-blue-900 mb-2">Overall Strategy:</h6>
                  <p className="text-sm text-blue-800">{recommendation.personalized_suggestions.overall_strategy}</p>
                </div>

                {recommendation.personalized_suggestions.skill_gaps.length > 0 && (
                  <div>
                    <h6 className="font-medium text-gray-800 mb-2">Personalized Skill Development:</h6>
                    <div className="space-y-3">
                      {recommendation.personalized_suggestions.skill_gaps.map((suggestion: any, idx: number) => (
                        <div key={idx} className="p-3 bg-green-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h7 className="font-medium text-green-900">{suggestion.title}</h7>
                            <span className={`px-2 py-1 text-xs rounded ${
                              suggestion.priority === 'high' ? 'bg-red-100 text-red-800' :
                              suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {suggestion.priority}
                            </span>
                          </div>
                          <p className="text-sm text-green-800 mb-2">{suggestion.description}</p>
                          <div className="text-xs text-green-700">
                            <span className="font-medium">Timeline:</span> {suggestion.timeline}
                          </div>
                          {suggestion.specific_actions && suggestion.specific_actions.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs font-medium text-green-700">Actions:</span>
                              <ul className="mt-1 space-y-1">
                                {suggestion.specific_actions.map((action: string, actionIdx: number) => (
                                  <li key={actionIdx} className="text-xs text-green-700">• {action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recommendation.personalized_suggestions.interview_prep.length > 0 && (
                  <div>
                    <h6 className="font-medium text-gray-800 mb-2">Interview Strategy:</h6>
                    <div className="space-y-2">
                      {recommendation.personalized_suggestions.interview_prep.map((prep: any, idx: number) => (
                        <div key={idx} className="p-3 bg-purple-50 rounded-lg">
                          <h7 className="font-medium text-purple-900 mb-1">{prep.title}</h7>
                          <p className="text-sm text-purple-800 mb-2">{prep.description}</p>
                          <div className="text-xs text-purple-700">
                            <span className="font-medium">Timeline:</span> {prep.timeline}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
