'use client'

import { useState, useRef, useEffect } from 'react'
import type { EnhancedCandidateProfile } from '@/lib/enhanced-candidate-profile'
import { validateResumeFile } from '@/lib/file-validation'

type EnhancedProfileForMessages = Partial<
  Omit<EnhancedCandidateProfile, 'skills' | 'management_experience'>
> & {
  skills?: Array<Partial<EnhancedCandidateProfile['skills'][number]>>
  management_experience?: Partial<EnhancedCandidateProfile['management_experience']>
  company_history?: string[] | null
  experience?: Array<{ company?: string | null }> | null
}

type JsonResumeForMessages = {
  work?: Array<{ name?: string | null }>
} | null

export interface ResumeUploadResponse {
  enhancedProfile: EnhancedProfileForMessages | null
  jsonResume: JsonResumeForMessages
}

interface ResumeUploadProps {
  onUploadSuccess?: (resumeData: ResumeUploadResponse) => void
  onUploadError?: (error: string) => void
}

const FALLBACK_MESSAGES = [
  'Still crunching through your resume details…',
  'Aligning your profile with top-market roles…',
  'Cross-referencing leadership signals…',
  'Highlighting signature achievements…',
  'Calibrating recommendations for culture fit…'
] as const

type AnalysisTickerState = {
  queue: string[]
  isActive: boolean
  queueTimer: ReturnType<typeof setInterval> | null
  fallbackTimer: ReturnType<typeof setInterval> | null
  fallbackIndex: number
}

export default function ResumeUpload({ onUploadSuccess, onUploadError }: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [salaryMin, setSalaryMin] = useState(9000)
  const [salaryMax, setSalaryMax] = useState(12000)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState('')
  const analysisTickerRef = useRef<AnalysisTickerState>({
    queue: [],
    isActive: false,
    queueTimer: null,
    fallbackTimer: null,
    fallbackIndex: 0
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const clearTimers = (ticker: AnalysisTickerState) => {
    if (ticker.queueTimer) {
      clearInterval(ticker.queueTimer)
      ticker.queueTimer = null
    }
    if (ticker.fallbackTimer) {
      clearInterval(ticker.fallbackTimer)
      ticker.fallbackTimer = null
    }
  }

  const stopTimers = () => {
    clearTimers(analysisTickerRef.current)
  }

  const showMessage = (message: string) => {
    setAnalysisMessage(message)
  }

  const startFallbackLoop = () => {
    const ticker = analysisTickerRef.current
    if (!ticker.isActive || ticker.fallbackTimer) return
    ticker.fallbackTimer = setInterval(() => {
      if (FALLBACK_MESSAGES.length === 0) return
      const idx = ticker.fallbackIndex % FALLBACK_MESSAGES.length
      ticker.fallbackIndex += 1
      showMessage(FALLBACK_MESSAGES[idx])
    }, 4000)
  }

  const startQueueLoop = () => {
    const ticker = analysisTickerRef.current
    if (ticker.queueTimer) return
    ticker.queueTimer = setInterval(() => {
      const next = ticker.queue.shift()
      if (next) {
        showMessage(next)
      }
      if (!ticker.queue.length) {
        clearInterval(ticker.queueTimer as ReturnType<typeof setInterval>)
        ticker.queueTimer = null
        startFallbackLoop()
      }
    }, 1800)
  }

  const enqueueMessages = (messages: string[], options?: { reset?: boolean }) => {
    if (!messages.length) return
    const ticker = analysisTickerRef.current
    const shouldReset = options?.reset ?? true
    ticker.isActive = true
    if (shouldReset) {
      stopTimers()
      ticker.queue = []
      ticker.fallbackIndex = 0
    }
    ticker.queue.push(...messages)
    const immediate = ticker.queue.shift()
    if (immediate) {
      showMessage(immediate)
    }
    if (ticker.queue.length) {
      startQueueLoop()
    } else {
      startFallbackLoop()
    }
  }

  const showFinalMessage = (message: string) => {
    const ticker = analysisTickerRef.current
    clearTimers(ticker)
    ticker.queue = []
    ticker.fallbackIndex = 0
    ticker.isActive = true
    showMessage(message)
    startFallbackLoop()
  }

  const resetAnalysis = () => {
    const ticker = analysisTickerRef.current
    ticker.isActive = false
    ticker.queue = []
    ticker.fallbackIndex = 0
    stopTimers()
    setAnalysisMessage('')
  }

  const buildProfileMessages = (
    enhancedProfile: EnhancedProfileForMessages | null,
    jsonResume: JsonResumeForMessages
  ) => {
    if (!enhancedProfile) return []
    const messages: string[] = []
    const recentTitle = enhancedProfile.current_title || enhancedProfile.titles?.[0]
    if (recentTitle) {
      messages.push(`Reviewing recent role: ${recentTitle}.`)
    }
    if (typeof enhancedProfile.experience_years === 'number') {
      messages.push(`Detected around ${enhancedProfile.experience_years} years of experience.`)
    }
    const highlightedSkills = enhancedProfile.skills
      ?.slice?.(0, 3)
      ?.map(skill => skill?.name)
      ?.filter((name): name is string => Boolean(name))
    if (highlightedSkills && highlightedSkills.length > 0) {
      messages.push(`Highlighting core skills: ${highlightedSkills.join(', ')}.`)
    }
    if (enhancedProfile.management_experience?.has_management) {
      const yrs = enhancedProfile.management_experience.management_years
      messages.push(`Flagged strong team leadership${yrs ? ` with about ${yrs} years managing` : ''}.`)
    }
    const industries = enhancedProfile.intent?.target_industries?.length
      ? enhancedProfile.intent.target_industries
      : enhancedProfile.industries
    if (industries && industries.length > 0) {
      messages.push(`Focusing on opportunities in ${industries.slice(0, 2).join(', ')}.`)
    }
    const company =
      jsonResume?.work?.[0]?.name ||
      enhancedProfile.company_history?.[0] ||
      enhancedProfile.experience?.[0]?.company ||
      null
    if (company) {
      messages.push(`Analyzing impact at ${company}.`)
    }
    messages.push('Matching against 20 shortlisted roles…')
    messages.push('LLM fine-tuning the final recommendations…')
    return messages
  }

  const buildCompletionMessage = (enhancedProfile: EnhancedProfileForMessages | null): string => {
    if (!enhancedProfile) {
      return 'Resume parsed. Generating job matches with AI…'
    }

    const highlights: string[] = []

    if (enhancedProfile.current_title) {
      highlights.push(`current role ${enhancedProfile.current_title}`)
    }

    if (typeof enhancedProfile.experience_years === 'number') {
      highlights.push(`${Math.round(enhancedProfile.experience_years)} years experience`)
    }

    const topSkills = enhancedProfile.skills
      ?.map(skill => skill?.name)
      ?.filter((name): name is string => Boolean(name))
      ?.slice(0, 2)

    if (topSkills && topSkills.length > 0) {
      highlights.push(`key skills ${topSkills.join(', ')}`)
    }

    if (enhancedProfile.leadership_level && enhancedProfile.leadership_level !== 'IC') {
      highlights.push(`${enhancedProfile.leadership_level} leadership`)
    }

    const baseMessage = highlights.length > 0
      ? `Resume parsed: ${highlights.join(' • ')}`
      : 'Resume parsed successfully'

    return `${baseMessage}. Generating tailored job matches…`
  }

  useEffect(() => {
    const ticker = analysisTickerRef.current
    return () => {
      ticker.isActive = false
      clearTimers(ticker)
    }
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0])
  }

  const handleFile = (file: File) => {
    const validation = validateResumeFile(file)
    if (!validation.valid) {
      onUploadError?.(validation.error || 'Invalid file')
      return
    }
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setUploadProgress(0)
    setUploadStage('Uploading file...')
    resetAnalysis()
    enqueueMessages([
      'Uploading resume securely…',
      'Extracting text and structure…',
      'Identifying education and certifications…'
    ])

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      const formData = new FormData()
      formData.append('resume', selectedFile)
      formData.append('salaryMin', salaryMin.toString())
      formData.append('salaryMax', salaryMax.toString())

      setUploadStage('Analyzing resume with AI...')
      const response = await fetch('/api/resume/upload', { method: 'POST', body: formData })

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadStage('Analysis complete!')

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Upload failed')
      }

      const resumeData: ResumeUploadResponse = await response.json()
      enqueueMessages(buildProfileMessages(resumeData.enhancedProfile, resumeData.jsonResume), { reset: true })
      onUploadSuccess?.(resumeData)
      showFinalMessage(buildCompletionMessage(resumeData.enhancedProfile))
      
      // Reset after success
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setUploadStage('')
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }, 2000)
    } catch (error) {
      console.error('Upload error:', error)
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed')
      setIsUploading(false)
      setUploadProgress(0)
      setUploadStage('')
      resetAnalysis()
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="bg-white border border-gray-200 p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-black mb-2">Upload Your Resume</h2>
        <p className="text-gray-600">Get personalized job recommendations based on your experience</p>
      </div>

      <div
        className={`border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-black">{selectedFile ? selectedFile.name : 'Drop your resume here'}</p>
            <p className="text-sm text-gray-500">or click to browse files</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileInput} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white text-black px-6 py-2 border border-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">Choose File</button>
        </div>
      </div>

      {selectedFile && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-black">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={removeFile} className="text-red-600 hover:text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{uploadStage}</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 h-2">
            <div className="bg-black h-2 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {analysisMessage && (
        <div className="mt-6 bg-gray-50 border border-gray-200 p-4">
          <div className="flex items-center text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
            Live AI Analysis
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{analysisMessage}</p>
        </div>
      )}

      {/* Salary Expectation Range */}
      {selectedFile && !isUploading && (
        <div className="mt-6 p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-black mb-3">Monthly Salary Expectation (SGD) - Optional</h3>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Min Salary</label>
              <input
                type="number"
                min="0"
                step="500"
                value={salaryMin}
                onChange={(e) => setSalaryMin(Number(e.target.value) || 0)}
                placeholder="9000"
                className="w-full px-3 py-2 border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Max Salary</label>
              <input
                type="number"
                min="0"
                step="500"
                value={salaryMax}
                onChange={(e) => setSalaryMax(Number(e.target.value) || 0)}
                placeholder="12000"
                className="w-full px-3 py-2 border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Your input will override AI inference. Leave blank to use AI-estimated range.</p>
        </div>
      )}

      {/* Terms and Consent */}
      {selectedFile && !isUploading && (
        <div className="mt-6 p-4 border border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 border-gray-300 text-black focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">
                You understand and agree that:
                <ul className="mt-2 space-y-1 text-xs text-gray-600 list-disc list-inside">
                  <li><strong>Talyon will NEVER share your contact information</strong> with employers or recruiters without your explicit consent</li>
                  <li>Talyon may use your resume data to analyze your profile and recommend relevant job opportunities that match your skills and experience</li>
                </ul>
              </span>
            </label>
          </div>
        </div>
      )}

      {selectedFile && !isUploading && (
        <div className="mt-6">
          <button 
            onClick={handleUpload} 
            disabled={!termsAccepted}
            className={`w-full py-3 px-6 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors ${
              termsAccepted 
                ? 'bg-black text-white hover:bg-gray-800' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Upload & Analyze Resume
          </button>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">Supported formats: PDF, DOC, DOCX (max 10MB)</p>
      </div>
    </div>
  )
}
