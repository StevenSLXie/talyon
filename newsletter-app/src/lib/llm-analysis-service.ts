// LLM Analysis Service for handling background job analysis
import { backgroundUploadService } from './background-upload'
import { uploadPersistenceService } from './upload-persistence'

interface LLMAnalysisOptions {
  userId: string
  limit?: number
  useBackground?: boolean
}

interface LLMAnalysisResult {
  success: boolean
  recommendations: any[]
  system: string
  stage1_jobs_analyzed: number
  stage2_llm_analysis: string
}

export class LLMAnalysisService {
  private static instance: LLMAnalysisService
  private analysisCallbacks: Map<string, (result: LLMAnalysisResult) => void> = new Map()
  private errorCallbacks: Map<string, (error: string) => void> = new Map()

  static getInstance(): LLMAnalysisService {
    if (!LLMAnalysisService.instance) {
      LLMAnalysisService.instance = new LLMAnalysisService()
    }
    return LLMAnalysisService.instance
  }

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // Listen for background analysis completion
    backgroundUploadService.onLLMAnalysisCompleted((data) => {
      console.log('[LLMAnalysisService] Background analysis completed:', data.analysisId)
      this.handleAnalysisCompleted(data.analysisId, data.result)
    })

    backgroundUploadService.onLLMAnalysisFailed((data) => {
      console.error('[LLMAnalysisService] Background analysis failed:', data.analysisId, data.error)
      this.handleAnalysisFailed(data.analysisId, data.error)
    })

    backgroundUploadService.onLLMAnalysisProgress((data) => {
      console.log('[LLMAnalysisService] Background analysis progress:', data.analysisId, data.progress)
      this.handleAnalysisProgress(data.analysisId, data.progress)
    })

    // Listen for custom events from ResumeUpload component
    if (typeof window !== 'undefined') {
      window.addEventListener('llm-analysis-completed', (event: CustomEvent) => {
        console.log('[LLMAnalysisService] Foreground analysis completed')
        this.handleAnalysisCompleted('foreground', event.detail)
      })
    }
  }

  /**
   * Start LLM analysis for job recommendations
   */
  async startAnalysis(options: LLMAnalysisOptions): Promise<string> {
    const { userId, limit = 8, useBackground = false } = options
    
    try {
      // Check if we should use background analysis
      const shouldUseBackground = useBackground || 
        (typeof window !== 'undefined' && !document.visibilityState) || 
        (backgroundUploadService.isBackgroundSyncSupported() && 
         typeof navigator !== 'undefined' && (navigator as any).connection?.effectiveType === 'slow-2g')

      if (shouldUseBackground) {
        return await this.startBackgroundAnalysis(userId, limit)
      } else {
        return await this.startForegroundAnalysis(userId, limit)
      }
    } catch (error) {
      console.error('[LLMAnalysisService] Analysis start failed:', error)
      throw error
    }
  }

  private async startBackgroundAnalysis(userId: string, limit: number): Promise<string> {
    try {
      // Create persistent analysis state
      const persistentState = uploadPersistenceService.createAnalysisState(userId, limit)
      
      // Save to persistent storage
      await uploadPersistenceService.saveAnalysisState({
        ...persistentState,
        status: 'processing'
      })
      
      // Queue the analysis
      const analysisId = await backgroundUploadService.queueLLMAnalysis({
        userId,
        limit
      })
      
      // Request background sync
      await backgroundUploadService.requestLLMAnalysisSync()
      
      console.log('[LLMAnalysisService] Background analysis queued with ID:', analysisId)
      return analysisId
      
    } catch (error) {
      console.error('[LLMAnalysisService] Background analysis start failed:', error)
      throw error
    }
  }

  private async startForegroundAnalysis(userId: string, limit: number): Promise<string> {
    try {
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
      
      // Trigger completion event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('llm-analysis-completed', { detail: result }))
      }
      
      return 'foreground'
      
    } catch (error) {
      console.error('[LLMAnalysisService] Foreground analysis failed:', error)
      
      // Fallback to background analysis
      if (backgroundUploadService.isBackgroundSyncSupported()) {
        console.log('[LLMAnalysisService] Falling back to background analysis')
        return await this.startBackgroundAnalysis(userId, limit)
      } else {
        throw error
      }
    }
  }

  /**
   * Register callback for analysis completion
   */
  onAnalysisCompleted(analysisId: string, callback: (result: LLMAnalysisResult) => void): void {
    this.analysisCallbacks.set(analysisId, callback)
  }

  /**
   * Register callback for analysis failure
   */
  onAnalysisFailed(analysisId: string, callback: (error: string) => void): void {
    this.errorCallbacks.set(analysisId, callback)
  }

  /**
   * Get analysis status
   */
  async getAnalysisStatus(analysisId: string): Promise<any> {
    if (analysisId === 'foreground') {
      return null // Foreground analysis is immediate
    }
    
    return await backgroundUploadService.getLLMAnalysisStatus(analysisId)
  }

  /**
   * Cancel analysis
   */
  async cancelAnalysis(analysisId: string): Promise<void> {
    if (analysisId === 'foreground') {
      return // Cannot cancel foreground analysis
    }
    
    await backgroundUploadService.cancelLLMAnalysis(analysisId)
    
    // Clean up callbacks
    this.analysisCallbacks.delete(analysisId)
    this.errorCallbacks.delete(analysisId)
  }

  private handleAnalysisCompleted(analysisId: string, result: LLMAnalysisResult): void {
    console.log('[LLMAnalysisService] Handling analysis completion:', analysisId)
    
    // Call registered callback
    const callback = this.analysisCallbacks.get(analysisId)
    if (callback) {
      callback(result)
    }
    
    // Clean up
    this.analysisCallbacks.delete(analysisId)
    this.errorCallbacks.delete(analysisId)
    
    // Update persistent state
    if (analysisId !== 'foreground') {
      uploadPersistenceService.saveAnalysisState({
        id: analysisId,
        userId: '', // Will be updated by the calling code
        limit: 8,
        status: 'completed',
        progress: 100,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        result
      }).catch(error => {
        console.error('[LLMAnalysisService] Error updating analysis state:', error)
      })
    }
  }

  private handleAnalysisFailed(analysisId: string, error: string): void {
    console.error('[LLMAnalysisService] Handling analysis failure:', analysisId, error)
    
    // Call registered callback
    const callback = this.errorCallbacks.get(analysisId)
    if (callback) {
      callback(error)
    }
    
    // Clean up
    this.analysisCallbacks.delete(analysisId)
    this.errorCallbacks.delete(analysisId)
    
    // Update persistent state
    if (analysisId !== 'foreground') {
      uploadPersistenceService.saveAnalysisState({
        id: analysisId,
        userId: '', // Will be updated by the calling code
        limit: 8,
        status: 'failed',
        progress: 0,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        error
      }).catch(error => {
        console.error('[LLMAnalysisService] Error updating analysis state:', error)
      })
    }
  }

  private handleAnalysisProgress(analysisId: string, progress: number): void {
    console.log('[LLMAnalysisService] Analysis progress:', analysisId, progress)
    
    // Update persistent state
    if (analysisId !== 'foreground') {
      uploadPersistenceService.saveAnalysisState({
        id: analysisId,
        userId: '', // Will be updated by the calling code
        limit: 8,
        status: 'processing',
        progress,
        startTime: Date.now(),
        lastUpdate: Date.now()
      }).catch(error => {
        console.error('[LLMAnalysisService] Error updating analysis progress:', error)
      })
    }
  }

  /**
   * Check for pending analyses and resume them
   */
  async checkPendingAnalyses(): Promise<void> {
    try {
      const pending = await uploadPersistenceService.getPendingAnalyses()
      
      if (pending.length > 0) {
        console.log('[LLMAnalysisService] Found pending analyses:', pending.length)
        
        // Resume each pending analysis
        for (const analysis of pending) {
          try {
            await this.startBackgroundAnalysis(analysis.userId, analysis.limit)
          } catch (error) {
            console.error('[LLMAnalysisService] Error resuming analysis:', analysis.id, error)
          }
        }
      }
    } catch (error) {
      console.error('[LLMAnalysisService] Error checking pending analyses:', error)
    }
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(): Promise<{
    total: number
    pending: number
    completed: number
    failed: number
  }> {
    return await uploadPersistenceService.getAnalysisStats()
  }
}

// Export singleton instance
export const llmAnalysisService = LLMAnalysisService.getInstance()

// Export types
export type { LLMAnalysisOptions, LLMAnalysisResult }
