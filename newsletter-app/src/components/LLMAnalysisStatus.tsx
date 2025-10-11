'use client'

import { useState, useEffect } from 'react'
import { llmAnalysisService } from '@/lib/llm-analysis-service'

interface LLMAnalysisStatusProps {
  userId: string
  onAnalysisComplete?: (result: any) => void
  onAnalysisError?: (error: string) => void
}

export default function LLMAnalysisStatus({ userId, onAnalysisComplete, onAnalysisError }: LLMAnalysisStatusProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStage, setAnalysisStage] = useState('')
  const [isBackgroundMode, setIsBackgroundMode] = useState(false)
  const [hasPendingAnalyses, setHasPendingAnalyses] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)

  useEffect(() => {
    // Check for pending analyses on mount
    const checkPendingAnalyses = async () => {
      try {
        const stats = await llmAnalysisService.getAnalysisStats()
        setHasPendingAnalyses(stats.pending > 0)
        
        if (stats.pending > 0) {
          console.log('Found pending analyses:', stats.pending)
          // Resume pending analyses
          await llmAnalysisService.checkPendingAnalyses()
        }
      } catch (error) {
        console.error('Error checking pending analyses:', error)
      }
    }

    checkPendingAnalyses()
  }, [])

  const startAnalysis = async (limit: number = 8) => {
    try {
      setIsAnalyzing(true)
      setAnalysisProgress(0)
      setAnalysisStage('Starting LLM analysis...')
      
      // Check if we should use background mode
      const shouldUseBackground = (typeof document !== 'undefined' && !document.visibilityState) || 
        (typeof navigator !== 'undefined' && (navigator as any).connection?.effectiveType === 'slow-2g')
      
      if (shouldUseBackground) {
        setIsBackgroundMode(true)
        setAnalysisStage('Queuing analysis for background processing...')
      } else {
        setAnalysisStage('Analyzing jobs with LLM...')
      }
      
      const id = await llmAnalysisService.startAnalysis({
        userId,
        limit,
        useBackground: shouldUseBackground
      })
      
      setAnalysisId(id)
      
      // Register callbacks
      llmAnalysisService.onAnalysisCompleted(id, (result) => {
        console.log('Analysis completed:', result)
        setIsAnalyzing(false)
        setIsBackgroundMode(false)
        setAnalysisProgress(100)
        setAnalysisStage('Analysis complete!')
        setAnalysisId(null)
        onAnalysisComplete?.(result)
      })
      
      llmAnalysisService.onAnalysisFailed(id, (error) => {
        console.error('Analysis failed:', error)
        setIsAnalyzing(false)
        setIsBackgroundMode(false)
        setAnalysisProgress(0)
        setAnalysisStage('Analysis failed')
        setAnalysisId(null)
        onAnalysisError?.(error)
      })
      
    } catch (error) {
      console.error('Analysis start failed:', error)
      setIsAnalyzing(false)
      setIsBackgroundMode(false)
      setAnalysisProgress(0)
      setAnalysisStage('Analysis failed')
      onAnalysisError?.(error instanceof Error ? error.message : 'Analysis failed')
    }
  }

  const cancelAnalysis = async () => {
    if (analysisId) {
      try {
        await llmAnalysisService.cancelAnalysis(analysisId)
        setIsAnalyzing(false)
        setIsBackgroundMode(false)
        setAnalysisProgress(0)
        setAnalysisStage('')
        setAnalysisId(null)
      } catch (error) {
        console.error('Error cancelling analysis:', error)
      }
    }
  }

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-black mb-2">AI Agent Scoring & Matching Status</h3>
        <p className="text-sm text-gray-600">AI that connects the right people, instantly</p>
      </div>

      {hasPendingAnalyses && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
          <div className="flex items-center text-xs text-orange-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Resuming pending analyses from previous session...</span>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{analysisStage}</span>
            <span>{Math.round(analysisProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded-full">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${analysisProgress}%` }} 
            />
          </div>
          
          {isBackgroundMode && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded">
              <div className="flex items-center text-xs text-purple-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>Analysis running in background - you can safely lock your phone</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {!isAnalyzing ? (
          <button
            onClick={() => startAnalysis(8)}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200"
          >
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Start AI Agent Scoring & Matching
            </div>
          </button>
        ) : (
          <button
            onClick={cancelAnalysis}
            className="w-full py-3 px-6 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
          >
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel Scoring & Matching
            </div>
          </button>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-500">
            AI agent scoring and matching may take up to 5 minutes as we process thousands of job opportunities
          </p>
        </div>
      </div>

      {/* Mobile-specific optimizations */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <div className="flex items-start text-xs text-blue-700">
          <svg className="w-4 h-4 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="font-medium">Mobile Optimized</p>
            <p className="mt-1">AI agent scoring and matching continues in background even if you lock your phone or switch apps.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
