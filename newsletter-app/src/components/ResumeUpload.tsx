'use client'

import { useState, useRef, useEffect } from 'react'
import type { EnhancedCandidateProfile } from '@/lib/enhanced-candidate-profile'
import { validateResumeFile } from '@/lib/file-validation'
import { backgroundUploadService } from '@/lib/background-upload'
import { uploadPersistenceService } from '@/lib/upload-persistence'

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
  onLLMAnalysisTrigger?: (triggerFn: (userId: string, limit?: number) => Promise<void>) => void
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

export default function ResumeUpload({ onUploadSuccess, onUploadError, onLLMAnalysisTrigger }: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [salaryMin, setSalaryMin] = useState(9000)
  const [salaryMax, setSalaryMax] = useState(12000)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [isBackgroundMode, setIsBackgroundMode] = useState(false)
  const [backgroundUploadId, setBackgroundUploadId] = useState<string | null>(null)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [persistentUploadId, setPersistentUploadId] = useState<string | null>(null)
  const [hasPendingUploads, setHasPendingUploads] = useState(false)
  const [isLLMAnalyzing, setIsLLMAnalyzing] = useState(false)
  const [llmAnalysisId, setLlmAnalysisId] = useState<string | null>(null)
  const [isBackgroundAnalysis, setIsBackgroundAnalysis] = useState(false)
  const [hasPendingAnalyses, setHasPendingAnalyses] = useState(false)
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
    
    // Initialize background upload service
    const initializeBackgroundUpload = async () => {
      try {
        await backgroundUploadService.registerServiceWorker()
        await backgroundUploadService.requestNotificationPermission()
        
        // Set up event handlers
        backgroundUploadService.onUploadCompleted((data) => {
          console.log('Background upload completed:', data)
          setIsBackgroundMode(false)
          setBackgroundUploadId(null)
          setPersistentUploadId(null)
          onUploadSuccess?.(data.result)
        })
        
        backgroundUploadService.onUploadFailed((data) => {
          console.error('Background upload failed:', data)
          setIsBackgroundMode(false)
          setBackgroundUploadId(null)
          setPersistentUploadId(null)
          onUploadError?.(data.error)
        })
        
        backgroundUploadService.onUploadProgress((data) => {
          console.log('Background upload progress:', data)
          setUploadProgress(data.progress || 0)
        })
        
        // Set up LLM analysis event handlers
        backgroundUploadService.onLLMAnalysisCompleted((data) => {
          console.log('Background LLM analysis completed:', data)
          setIsLLMAnalyzing(false)
          setIsBackgroundAnalysis(false)
          setLlmAnalysisId(null)
          // Trigger job recommendations refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('llm-analysis-completed', { detail: data.result }))
          }
        })
        
        backgroundUploadService.onLLMAnalysisFailed((data) => {
          console.error('Background LLM analysis failed:', data)
          setIsLLMAnalyzing(false)
          setIsBackgroundAnalysis(false)
          setLlmAnalysisId(null)
          onUploadError?.(data.error)
        })
        
        backgroundUploadService.onLLMAnalysisProgress((data) => {
          console.log('Background LLM analysis progress:', data)
          // Update analysis progress if needed
        })
        
      } catch (error) {
        console.warn('Background upload service initialization failed:', error)
      }
    }

    // Check for pending uploads on initialization
    const checkPendingUploads = async () => {
      try {
        const pending = await uploadPersistenceService.getPendingUploads()
        setHasPendingUploads(pending.length > 0)
        
        if (pending.length > 0) {
          console.log('Found pending uploads:', pending.length)
          // Show notification about pending uploads
          enqueueMessages([
            `Found ${pending.length} pending upload${pending.length > 1 ? 's' : ''} from previous session…`,
            'Resuming background processing…'
          ])
        }
      } catch (error) {
        console.error('Error checking pending uploads:', error)
      }
    }

    // Check for pending analyses on initialization
    const checkPendingAnalyses = async () => {
      try {
        const pending = await uploadPersistenceService.getPendingAnalyses()
        setHasPendingAnalyses(pending.length > 0)
        
        if (pending.length > 0) {
          console.log('Found pending analyses:', pending.length)
          // Show notification about pending analyses
          enqueueMessages([
            `Found ${pending.length} pending job analysis${pending.length > 1 ? 'es' : ''} from previous session…`,
            'Resuming LLM analysis in background…'
          ])
        }
      } catch (error) {
        console.error('Error checking pending analyses:', error)
      }
    }
    
    // Page Visibility API setup
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return
      const isVisible = !document.hidden
      setIsPageVisible(isVisible)
      
      if (isVisible && backgroundUploadId) {
        // Page became visible, check upload status
        checkBackgroundUploadStatus()
      }
      
      if (isVisible && llmAnalysisId) {
        // Page became visible, check analysis status
        checkBackgroundAnalysisStatus()
      }
      
      if (!isVisible && isLLMAnalyzing) {
        // Page became hidden, switch to background analysis mode
        setIsBackgroundAnalysis(true)
        enqueueMessages([
          'LLM analysis continues in background...',
          'You can safely lock your phone',
          'Analysis will complete automatically'
        ])
      }
    }
    
    const checkBackgroundUploadStatus = async () => {
      if (backgroundUploadId) {
        try {
          const status = await backgroundUploadService.getUploadStatus(backgroundUploadId)
          if (status) {
            console.log('Background upload status:', status)
            if (status.status === 'completed') {
              setIsBackgroundMode(false)
              setBackgroundUploadId(null)
              onUploadSuccess?.(status.result)
            } else if (status.status === 'failed') {
              setIsBackgroundMode(false)
              setBackgroundUploadId(null)
              onUploadError?.(status.error || 'Upload failed')
            }
          }
        } catch (error) {
          console.error('Error checking background upload status:', error)
        }
      }
    }

    const checkBackgroundAnalysisStatus = async () => {
      if (llmAnalysisId) {
        try {
          const status = await backgroundUploadService.getLLMAnalysisStatus(llmAnalysisId)
          if (status) {
            console.log('Background analysis status:', status)
            if (status.status === 'completed') {
              setIsLLMAnalyzing(false)
              setIsBackgroundAnalysis(false)
              setLlmAnalysisId(null)
              // Trigger job recommendations refresh
              window.dispatchEvent(new CustomEvent('llm-analysis-completed', { detail: status.result }))
            } else if (status.status === 'failed') {
              setIsLLMAnalyzing(false)
              setIsBackgroundAnalysis(false)
              setLlmAnalysisId(null)
              onUploadError?.(status.error || 'Analysis failed')
            }
          }
        } catch (error) {
          console.error('Error checking background analysis status:', error)
        }
      }
    }
    
    initializeBackgroundUpload()
    checkPendingUploads()
    checkPendingAnalyses()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    
    return () => {
      ticker.isActive = false
      clearTimers(ticker)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [backgroundUploadId, onUploadSuccess, onUploadError])

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
    
    // Check if we should use background upload
    const shouldUseBackground = !isPageVisible || 
      (backgroundUploadService.isBackgroundSyncSupported() && 
       typeof navigator !== 'undefined' && (navigator as any).connection?.effectiveType === 'slow-2g')
    
    if (shouldUseBackground) {
      await handleBackgroundUpload()
      return
    }
    
    // Regular foreground upload
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
      
      // If foreground upload fails, try background upload as fallback
      if (backgroundUploadService.isBackgroundSyncSupported()) {
        console.log('Foreground upload failed, falling back to background upload')
        await handleBackgroundUpload()
      } else {
        onUploadError?.(error instanceof Error ? error.message : 'Upload failed')
        setIsUploading(false)
        setUploadProgress(0)
        setUploadStage('')
        resetAnalysis()
      }
    }
  }

  const handleBackgroundUpload = async () => {
    if (!selectedFile) return
    
    try {
      setIsBackgroundMode(true)
      setUploadProgress(0)
      setUploadStage('Queuing upload for background processing...')
      resetAnalysis()
      
      enqueueMessages([
        'Preparing resume for background upload…',
        'Upload will continue even if you lock your phone…',
        'You\'ll be notified when processing is complete…'
      ])
      
      // Create persistent upload state
      const persistentState = uploadPersistenceService.createUploadState(
        selectedFile.name,
        selectedFile.size,
        salaryMin,
        salaryMax
      )
      
      // Save to persistent storage
      await uploadPersistenceService.saveUploadState({
        ...persistentState,
        status: 'uploading'
      })
      
      setPersistentUploadId(persistentState.id)
      
      // Queue the upload
      const uploadId = await backgroundUploadService.queueUpload({
        file: selectedFile,
        salaryMin,
        salaryMax
      })
      
      setBackgroundUploadId(uploadId)
      setUploadStage('Upload queued successfully! Processing in background...')
      
      // Request background sync
      await backgroundUploadService.requestBackgroundSync()
      
      console.log('Background upload queued with ID:', uploadId)
      
    } catch (error) {
      console.error('Background upload error:', error)
      setIsBackgroundMode(false)
      setBackgroundUploadId(null)
      setPersistentUploadId(null)
      onUploadError?.(error instanceof Error ? error.message : 'Background upload failed')
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Function to trigger LLM analysis in background
  const triggerLLMAnalysis = async (userId: string, limit: number = 8) => {
    try {
      setIsLLMAnalyzing(true)
      setUploadStage('Starting LLM job analysis...')
      
      enqueueMessages([
        'Analyzing job opportunities with AI...',
        'Processing thousands of job descriptions...',
        'This may take up to 5 minutes...'
      ])
      
      // Check if we should use background analysis
      const shouldUseBackground = !isPageVisible || 
        (backgroundUploadService.isBackgroundSyncSupported() && 
         typeof navigator !== 'undefined' && (navigator as any).connection?.effectiveType === 'slow-2g')
      
      if (shouldUseBackground) {
        await handleBackgroundLLMAnalysis(userId, limit)
      } else {
        await handleForegroundLLMAnalysis(userId, limit)
      }
      
    } catch (error) {
      console.error('LLM analysis error:', error)
      setIsLLMAnalyzing(false)
      onUploadError?.(error instanceof Error ? error.message : 'LLM analysis failed')
    }
  }

  const handleBackgroundLLMAnalysis = async (userId: string, limit: number) => {
    try {
      setIsBackgroundAnalysis(true)
      
      // Create persistent analysis state
      const persistentState = uploadPersistenceService.createAnalysisState(userId, limit)
      
      // Save to persistent storage
      await uploadPersistenceService.saveAnalysisState({
        ...persistentState,
        status: 'processing'
      })
      
      setLlmAnalysisId(persistentState.id)
      
      // Queue the analysis
      const analysisId = await backgroundUploadService.queueLLMAnalysis({
        userId,
        limit
      })
      
      setUploadStage('LLM analysis queued successfully! Processing in background...')
      
      // Request background sync
      await backgroundUploadService.requestLLMAnalysisSync()
      
      console.log('Background LLM analysis queued with ID:', analysisId)
      
    } catch (error) {
      console.error('Background LLM analysis error:', error)
      setIsLLMAnalyzing(false)
      setIsBackgroundAnalysis(false)
      setLlmAnalysisId(null)
      onUploadError?.(error instanceof Error ? error.message : 'Background LLM analysis failed')
    }
  }

  const handleForegroundLLMAnalysis = async (userId: string, limit: number) => {
    try {
      setUploadStage('Analyzing jobs with LLM...')
      
      const response = await fetch('/api/jobs/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit })
      })
      
      if (!response.ok) {
        throw new Error(`LLM analysis failed: ${response.status}`)
      }
      
      const result = await response.json()
      
      setUploadStage('LLM analysis complete!')
      setIsLLMAnalyzing(false)
      
      // Trigger job recommendations refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('llm-analysis-completed', { detail: result }))
      }
      
    } catch (error) {
      console.error('Foreground LLM analysis error:', error)
      
      // If foreground analysis fails, try background analysis as fallback
      if (backgroundUploadService.isBackgroundSyncSupported()) {
        console.log('Foreground analysis failed, falling back to background analysis')
        await handleBackgroundLLMAnalysis(userId, limit)
      } else {
        throw error
      }
    }
  }

  // Expose triggerLLMAnalysis function to parent component
  useEffect(() => {
    if (onLLMAnalysisTrigger) {
      onLLMAnalysisTrigger(triggerLLMAnalysis)
    }
  }, [onLLMAnalysisTrigger])

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

      {(isUploading || isBackgroundMode || isLLMAnalyzing || isBackgroundAnalysis) && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{uploadStage}</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 h-2">
            <div className="bg-black h-2 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          {isBackgroundMode && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center text-xs text-blue-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Background processing enabled - upload will continue even if you lock your phone</span>
              </div>
            </div>
          )}
          {isBackgroundAnalysis && (
            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded">
              <div className="flex items-center text-xs text-purple-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>LLM analysis running in background - you can safely lock your phone</span>
              </div>
            </div>
          )}
        </div>
      )}

      {analysisMessage && (
        <div className="mt-6 bg-gray-50 border border-gray-200 p-4">
          <div className="flex items-center text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
            Live AI Analysis
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{analysisMessage}</p>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              ⏱️ This process may take up to 5 minutes as we analyze and score thousands of job opportunities to find your perfect matches.
            </p>
          </div>
        </div>
      )}

      {/* Salary Expectation Range */}
      {selectedFile && !isUploading && !isBackgroundMode && !isLLMAnalyzing && !isBackgroundAnalysis && (
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
      {selectedFile && !isUploading && !isBackgroundMode && !isLLMAnalyzing && !isBackgroundAnalysis && (
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
                  <li>Talyon's AI agent may use your resume data to score and match job opportunities, then recommend relevant positions that align with your skills and experience</li>
                </ul>
              </span>
            </label>
          </div>
        </div>
      )}

      {selectedFile && !isUploading && !isBackgroundMode && !isLLMAnalyzing && !isBackgroundAnalysis && (
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
        {hasPendingUploads && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center text-xs text-yellow-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>You have pending uploads from a previous session. They will continue processing in the background.</span>
            </div>
          </div>
        )}
        {hasPendingAnalyses && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
            <div className="flex items-center text-xs text-orange-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>You have pending job analyses from a previous session. They will continue processing in the background.</span>
            </div>
          </div>
        )}
        {!isPageVisible && (isBackgroundMode || isBackgroundAnalysis) && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center text-xs text-green-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Processing continues in the background. You can safely lock your phone or switch apps.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
