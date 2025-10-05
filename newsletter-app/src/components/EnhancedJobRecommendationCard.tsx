'use client'


import { useMemo, useState } from 'react'

const formatSalaryRange = (low?: number, high?: number) => {
  if (typeof low === 'number' && typeof high === 'number') {
    return `$${low.toLocaleString()} - $${high.toLocaleString()}`
  }
  if (typeof low === 'number') {
    return `$${low.toLocaleString()}`
  }
  if (typeof high === 'number') {
    return `$${high.toLocaleString()}`
  }
  return null
}

interface JobRecommendation {
  job: any
  match_score: number
  match_reasons: string[]
  llm_analysis: {
    final_score: number
    matching_reasons: string[]
    non_matching_points: string[]
    key_highlights: string[]
    personalized_assessment: string
  }
}

export default function EnhancedJobRecommendationCard({ recommendation }: { recommendation: JobRecommendation }) {
  const [showDetails, setShowDetails] = useState(false)

  const jobDescription = useMemo(() => {
    return recommendation.job?.job_description || recommendation.job?.raw_text || 'Job description not available'
  }, [recommendation.job?.job_description, recommendation.job?.raw_text])

  const externalUrl = useMemo(() => {
    return recommendation.job?.url || recommendation.job?.application_url || recommendation.job?.redirect_url || '#'
  }, [recommendation.job?.url, recommendation.job?.application_url, recommendation.job?.redirect_url])

  const salaryDisplay = formatSalaryRange(recommendation.job?.salary_low, recommendation.job?.salary_high)

  const matchBadgeColor = useMemo(() => {
    const score = recommendation.match_score
    if (score >= 80) return 'bg-black text-white'
    if (score >= 60) return 'bg-gray-900 text-white'
    if (score >= 40) return 'bg-gray-700 text-white'
    return 'bg-gray-500 text-white'
  }, [recommendation.match_score])

  return (
    <div className="border border-gray-200">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <div className={`inline-block px-3 py-1 text-xs uppercase tracking-wide ${matchBadgeColor}`}>
                {recommendation.match_score}% match
              </div>
              <h3 className="text-xl font-semibold text-black mt-3 mb-1 sm:max-w-md">
                {recommendation.job?.title}
              </h3>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">
                {recommendation.job?.company}
              </p>
            </div>
            <div className="text-sm text-gray-600 sm:text-right">
              {salaryDisplay && <div className="font-medium">{salaryDisplay}</div>}
              <div>{recommendation.job?.location}</div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <div className="font-semibold uppercase tracking-wide text-xs text-gray-500">Why it fits</div>
              <ul className="space-y-1">
                {recommendation.llm_analysis.matching_reasons.slice(0, 3).map((reason, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="mr-2 text-black">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {recommendation.llm_analysis.key_highlights?.length > 0 && (
              <div>
                <div className="font-semibold uppercase tracking-wide text-xs text-gray-500">Highlights</div>
                <ul className="space-y-1">
                  {recommendation.llm_analysis.key_highlights.slice(0, 3).map((highlight, idx) => (
                    <li key={idx} className="flex items-start text-gray-600">
                      <span className="mr-2">+</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommendation.llm_analysis.non_matching_points.length > 0 && (
              <div>
                <div className="font-semibold uppercase tracking-wide text-xs text-gray-500">Watch out for</div>
                <ul className="space-y-1">
                  {recommendation.llm_analysis.non_matching_points.slice(0, 2).map((point, idx) => (
                    <li key={idx} className="flex items-start text-gray-500">
                      <span className="mr-2">–</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-72 p-6 flex flex-col justify-between bg-white gap-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Summary</div>
              <div className="text-sm text-gray-600 leading-relaxed">
                {recommendation.llm_analysis.personalized_assessment}
              </div>
            </div>

            {recommendation.llm_analysis.non_matching_points.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Gaps</div>
                <ul className="space-y-1 text-sm text-gray-600">
                  {recommendation.llm_analysis.non_matching_points.map((point, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2 text-gray-400">–</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowDetails((prev) => !prev)}
              className="flex-1 border border-black text-black py-2 text-sm uppercase tracking-wide hover:bg-black hover:text-white transition"
            >
              {showDetails ? 'Hide Details' : 'View Details'}
            </button>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-black text-white py-2 text-sm uppercase tracking-wide text-center hover:bg-gray-900 transition"
            >
              Apply Now
            </a>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-6 max-h-80 overflow-y-auto text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {jobDescription}
          </div>
        </div>
      )}
    </div>
  )
}
