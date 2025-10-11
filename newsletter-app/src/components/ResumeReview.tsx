'use client'

import { useEffect, useState } from 'react'

interface ResumeReviewProps {
  userId: string
  triggerReview: number // Increment this to trigger a new review
}

export default function ResumeReview({ userId, triggerReview }: ResumeReviewProps) {
  const [bullets, setBullets] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string>('')
  const [currentBuffer, setCurrentBuffer] = useState<string>('')

  useEffect(() => {
    if (!userId || triggerReview === 0) return

    const fetchReview = async () => {
      setIsStreaming(true)
      setError('')
      setBullets([])
      setCurrentBuffer('')

      try {
        console.log('[ResumeReview] Fetching review...')
        const response = await fetch('/api/resume/review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        console.log('[ResumeReview] Response status:', response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('[ResumeReview] Error response:', errorText)
          
          try {
            const errorJson = JSON.parse(errorText)
            throw new Error(errorJson.error || 'Failed to load resume review')
          } catch {
            throw new Error(`Failed to load resume review (${response.status})`)
          }
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No response body')
        }

        let buffer = ''
        const extractedBullets: string[] = []

        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          // Process SSE format: data: {...}\n\n
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6) // Remove 'data: ' prefix
              
              if (data === '[DONE]') {
                setIsStreaming(false)
                continue
              }

              try {
                const parsed = JSON.parse(data)
                
                if (parsed.error) {
                  setError(parsed.error)
                  setIsStreaming(false)
                  break
                }

                if (parsed.content) {
                  setCurrentBuffer(prev => {
                    const newBuffer = prev + parsed.content
                    
                    // Extract complete bullets (lines starting with •)
                    const bulletRegex = /•[^\n•]+/g
                    const matches = newBuffer.match(bulletRegex)
                    
                    if (matches) {
                      const newBullets = matches.map(b => b.trim())
                      if (newBullets.length > extractedBullets.length) {
                        extractedBullets.length = 0
                        extractedBullets.push(...newBullets)
                        setBullets([...newBullets])
                      }
                    }
                    
                    return newBuffer
                  })
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', e)
              }
            }
          }
        }

        console.log('[ResumeReview] Streaming complete')
        setIsStreaming(false)

      } catch (err) {
        console.error('[ResumeReview] Error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load review')
        setIsStreaming(false)
      }
    }

    fetchReview()
  }, [userId, triggerReview])

  if (!userId || triggerReview === 0) return null

  return (
    <div className="max-w-4xl mx-auto mb-12">
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Agent Resume Scoring & Analysis</h2>
            <p className="text-sm text-gray-600">Honest feedback for the Singapore job market</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {bullets.length === 0 && isStreaming && (
            <div className="flex items-center gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm">Analyzing your resume...</span>
            </div>
          )}

          {bullets.map((bullet, index) => (
            <div
              key={index}
              className="flex items-start gap-3 animate-fadeIn"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <span className="text-gray-400 mt-1">•</span>
              <p className="text-gray-700 leading-relaxed flex-1">
                {bullet.replace(/^•\s*/, '')}
              </p>
            </div>
          ))}

          {isStreaming && bullets.length > 0 && bullets.length < 10 && (
            <div className="flex items-center gap-3 text-gray-400 text-sm pl-6">
              <div className="animate-pulse">Loading more insights...</div>
            </div>
          )}
        </div>

        {!isStreaming && bullets.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              💡 Use this feedback to improve your resume and increase your match scores
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
