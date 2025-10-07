'use client'

import { useState } from 'react'

interface MatchFilterProps {
  onFilterChange: (filters: MatchFilters) => void
}

interface MatchFilters {
  minScore: number
  maxScore: number
  showHighProbability: boolean
  showMediumProbability: boolean
  showLowProbability: boolean
}

export default function MatchFilter({ onFilterChange }: MatchFilterProps) {
  const [filters, setFilters] = useState<MatchFilters>({
    minScore: 0,
    maxScore: 100,
    showHighProbability: true,
    showMediumProbability: true,
    showLowProbability: false
  })

  const handleFilterChange = (newFilters: Partial<MatchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)
    onFilterChange(updatedFilters)
  }

  const handleScoreRangeChange = (min: number, max: number) => {
    handleFilterChange({ minScore: min, maxScore: max })
  }

  const handleProbabilityToggle = (type: 'high' | 'medium' | 'low') => {
    const key = `show${type.charAt(0).toUpperCase() + type.slice(1)}Probability` as keyof typeof filters
    handleFilterChange({ [key]: !filters[key] })
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Recommendations</h3>
      
      <div className="space-y-4">
        {/* Score Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Match Score Range: {filters.minScore}% - {filters.maxScore}%
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="0"
              max="100"
              value={filters.minScore}
              onChange={(e) => handleScoreRangeChange(parseInt(e.target.value), filters.maxScore)}
              className="flex-1"
            />
            <input
              type="range"
              min="0"
              max="100"
              value={filters.maxScore}
              onChange={(e) => handleScoreRangeChange(filters.minScore, parseInt(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>

        {/* Probability Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Match Probability
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.showHighProbability}
                onChange={() => handleProbabilityToggle('high')}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span>
                High (≥70%)
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.showMediumProbability}
                onChange={() => handleProbabilityToggle('medium')}
                className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-1"></span>
                Medium (50-69%)
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.showLowProbability}
                onChange={() => handleProbabilityToggle('low')}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-1"></span>
                Low (&lt;50%)
              </span>
            </label>
          </div>
        </div>

        {/* Quick Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Filters
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => handleScoreRangeChange(70, 100)}
              className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200"
            >
              High Matches Only
            </button>
            <button
              onClick={() => handleScoreRangeChange(50, 100)}
              className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200"
            >
              Medium+ Matches
            </button>
            <button
              onClick={() => handleScoreRangeChange(0, 100)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
            >
              Show All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
