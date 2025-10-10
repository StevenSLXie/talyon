// Upload persistence service for handling resume upload state across sessions
interface UploadState {
  id: string
  fileName: string
  fileSize: number
  salaryMin: number
  salaryMax: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  startTime: number
  lastUpdate: number
  error?: string
  result?: any
}

interface AnalysisState {
  id: string
  userId: string
  limit: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  startTime: number
  lastUpdate: number
  error?: string
  result?: any
}

interface UploadPersistenceService {
  saveUploadState(state: UploadState): Promise<void>
  getUploadState(uploadId: string): Promise<UploadState | null>
  getAllUploadStates(): Promise<UploadState[]>
  deleteUploadState(uploadId: string): Promise<void>
  clearCompletedUploads(): Promise<void>
  getPendingUploads(): Promise<UploadState[]>
  saveAnalysisState(state: AnalysisState): Promise<void>
  getAnalysisState(analysisId: string): Promise<AnalysisState | null>
  getAllAnalysisStates(): Promise<AnalysisState[]>
  deleteAnalysisState(analysisId: string): Promise<void>
  clearCompletedAnalyses(): Promise<void>
  getPendingAnalyses(): Promise<AnalysisState[]>
}

class UploadPersistenceServiceImpl implements UploadPersistenceService {
  private readonly STORAGE_KEY = 'resume-upload-states'
  private readonly ANALYSIS_STORAGE_KEY = 'llm-analysis-states'
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB limit

  async saveUploadState(state: UploadState): Promise<void> {
    try {
      const states = await this.getAllUploadStates()
      const existingIndex = states.findIndex(s => s.id === state.id)
      
      if (existingIndex >= 0) {
        states[existingIndex] = { ...state, lastUpdate: Date.now() }
      } else {
        states.push({ ...state, lastUpdate: Date.now() })
      }

      // Limit storage size by removing oldest completed uploads
      await this.cleanupOldStates(states)
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(states))
      console.log('[UploadPersistence] State saved:', state.id)
    } catch (error) {
      console.error('[UploadPersistence] Error saving state:', error)
      throw error
    }
  }

  async getUploadState(uploadId: string): Promise<UploadState | null> {
    try {
      const states = await this.getAllUploadStates()
      return states.find(s => s.id === uploadId) || null
    } catch (error) {
      console.error('[UploadPersistence] Error getting state:', error)
      return null
    }
  }

  async getAllUploadStates(): Promise<UploadState[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []
      
      const states = JSON.parse(stored) as UploadState[]
      
      // Filter out expired states (older than 24 hours)
      const now = Date.now()
      const validStates = states.filter(state => 
        now - state.lastUpdate < 24 * 60 * 60 * 1000
      )
      
      // Update storage if we filtered out expired states
      if (validStates.length !== states.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validStates))
      }
      
      return validStates
    } catch (error) {
      console.error('[UploadPersistence] Error getting all states:', error)
      return []
    }
  }

  async deleteUploadState(uploadId: string): Promise<void> {
    try {
      const states = await this.getAllUploadStates()
      const filteredStates = states.filter(s => s.id !== uploadId)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredStates))
      console.log('[UploadPersistence] State deleted:', uploadId)
    } catch (error) {
      console.error('[UploadPersistence] Error deleting state:', error)
      throw error
    }
  }

  async clearCompletedUploads(): Promise<void> {
    try {
      const states = await this.getAllUploadStates()
      const pendingStates = states.filter(s => 
        s.status !== 'completed' && s.status !== 'failed'
      )
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pendingStates))
      console.log('[UploadPersistence] Completed uploads cleared')
    } catch (error) {
      console.error('[UploadPersistence] Error clearing completed uploads:', error)
      throw error
    }
  }

  async getPendingUploads(): Promise<UploadState[]> {
    try {
      const states = await this.getAllUploadStates()
      return states.filter(s => 
        s.status === 'pending' || s.status === 'uploading' || s.status === 'processing'
      )
    } catch (error) {
      console.error('[UploadPersistence] Error getting pending uploads:', error)
      return []
    }
  }

  private async cleanupOldStates(states: UploadState[]): Promise<void> {
    // Sort by lastUpdate descending (newest first)
    states.sort((a, b) => b.lastUpdate - a.lastUpdate)
    
    // Keep only the 10 most recent states
    if (states.length > 10) {
      states.splice(10)
    }
    
    // Check storage size
    const storageSize = new Blob([JSON.stringify(states)]).size
    if (storageSize > this.MAX_STORAGE_SIZE) {
      // Remove oldest completed uploads first
      const completedStates = states.filter(s => s.status === 'completed')
      const pendingStates = states.filter(s => s.status !== 'completed')
      
      // Remove oldest completed states until we're under the limit
      while (completedStates.length > 0) {
        completedStates.shift()
        const newStates = [...pendingStates, ...completedStates]
        const newSize = new Blob([JSON.stringify(newStates)]).size
        
        if (newSize <= this.MAX_STORAGE_SIZE) {
          states.splice(0, states.length, ...newStates)
          break
        }
      }
    }
  }

  // Utility methods
  generateUploadId(): string {
    return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  createUploadState(
    fileName: string,
    fileSize: number,
    salaryMin: number,
    salaryMax: number
  ): UploadState {
    return {
      id: this.generateUploadId(),
      fileName,
      fileSize,
      salaryMin,
      salaryMax,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
      lastUpdate: Date.now()
    }
  }

  // Check if there are any pending uploads that need to be resumed
  async hasPendingUploads(): Promise<boolean> {
    const pending = await this.getPendingUploads()
    return pending.length > 0
  }

  // Get upload statistics
  async getUploadStats(): Promise<{
    total: number
    pending: number
    completed: number
    failed: number
  }> {
    const states = await this.getAllUploadStates()
    return {
      total: states.length,
      pending: states.filter(s => s.status === 'pending' || s.status === 'uploading' || s.status === 'processing').length,
      completed: states.filter(s => s.status === 'completed').length,
      failed: states.filter(s => s.status === 'failed').length
    }
  }

  // Analysis state management methods
  async saveAnalysisState(state: AnalysisState): Promise<void> {
    try {
      const states = await this.getAllAnalysisStates()
      const existingIndex = states.findIndex(s => s.id === state.id)
      
      if (existingIndex >= 0) {
        states[existingIndex] = { ...state, lastUpdate: Date.now() }
      } else {
        states.push({ ...state, lastUpdate: Date.now() })
      }

      // Limit storage size by removing oldest completed analyses
      await this.cleanupOldAnalysisStates(states)
      
      localStorage.setItem(this.ANALYSIS_STORAGE_KEY, JSON.stringify(states))
      console.log('[UploadPersistence] Analysis state saved:', state.id)
    } catch (error) {
      console.error('[UploadPersistence] Error saving analysis state:', error)
      throw error
    }
  }

  async getAnalysisState(analysisId: string): Promise<AnalysisState | null> {
    try {
      const states = await this.getAllAnalysisStates()
      return states.find(s => s.id === analysisId) || null
    } catch (error) {
      console.error('[UploadPersistence] Error getting analysis state:', error)
      return null
    }
  }

  async getAllAnalysisStates(): Promise<AnalysisState[]> {
    try {
      const stored = localStorage.getItem(this.ANALYSIS_STORAGE_KEY)
      if (!stored) return []
      
      const states = JSON.parse(stored) as AnalysisState[]
      
      // Filter out expired states (older than 24 hours)
      const now = Date.now()
      const validStates = states.filter(state => 
        now - state.lastUpdate < 24 * 60 * 60 * 1000
      )
      
      // Update storage if we filtered out expired states
      if (validStates.length !== states.length) {
        localStorage.setItem(this.ANALYSIS_STORAGE_KEY, JSON.stringify(validStates))
      }
      
      return validStates
    } catch (error) {
      console.error('[UploadPersistence] Error getting all analysis states:', error)
      return []
    }
  }

  async deleteAnalysisState(analysisId: string): Promise<void> {
    try {
      const states = await this.getAllAnalysisStates()
      const filteredStates = states.filter(s => s.id !== analysisId)
      localStorage.setItem(this.ANALYSIS_STORAGE_KEY, JSON.stringify(filteredStates))
      console.log('[UploadPersistence] Analysis state deleted:', analysisId)
    } catch (error) {
      console.error('[UploadPersistence] Error deleting analysis state:', error)
      throw error
    }
  }

  async clearCompletedAnalyses(): Promise<void> {
    try {
      const states = await this.getAllAnalysisStates()
      const pendingStates = states.filter(s => 
        s.status !== 'completed' && s.status !== 'failed'
      )
      localStorage.setItem(this.ANALYSIS_STORAGE_KEY, JSON.stringify(pendingStates))
      console.log('[UploadPersistence] Completed analyses cleared')
    } catch (error) {
      console.error('[UploadPersistence] Error clearing completed analyses:', error)
      throw error
    }
  }

  async getPendingAnalyses(): Promise<AnalysisState[]> {
    try {
      const states = await this.getAllAnalysisStates()
      return states.filter(s => 
        s.status === 'pending' || s.status === 'processing'
      )
    } catch (error) {
      console.error('[UploadPersistence] Error getting pending analyses:', error)
      return []
    }
  }

  private async cleanupOldAnalysisStates(states: AnalysisState[]): Promise<void> {
    // Sort by lastUpdate descending (newest first)
    states.sort((a, b) => b.lastUpdate - a.lastUpdate)
    
    // Keep only the 10 most recent states
    if (states.length > 10) {
      states.splice(10)
    }
    
    // Check storage size
    const storageSize = new Blob([JSON.stringify(states)]).size
    if (storageSize > this.MAX_STORAGE_SIZE) {
      // Remove oldest completed analyses first
      const completedStates = states.filter(s => s.status === 'completed')
      const pendingStates = states.filter(s => s.status !== 'completed')
      
      // Remove oldest completed states until we're under the limit
      while (completedStates.length > 0) {
        completedStates.shift()
        const newStates = [...pendingStates, ...completedStates]
        const newSize = new Blob([JSON.stringify(newStates)]).size
        
        if (newSize <= this.MAX_STORAGE_SIZE) {
          states.splice(0, states.length, ...newStates)
          break
        }
      }
    }
  }

  // Utility methods for analysis
  generateAnalysisId(): string {
    return 'analysis_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  createAnalysisState(
    userId: string,
    limit: number = 8
  ): AnalysisState {
    return {
      id: this.generateAnalysisId(),
      userId,
      limit,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
      lastUpdate: Date.now()
    }
  }

  // Check if there are any pending analyses that need to be resumed
  async hasPendingAnalyses(): Promise<boolean> {
    const pending = await this.getPendingAnalyses()
    return pending.length > 0
  }

  // Get analysis statistics
  async getAnalysisStats(): Promise<{
    total: number
    pending: number
    completed: number
    failed: number
  }> {
    const states = await this.getAllAnalysisStates()
    return {
      total: states.length,
      pending: states.filter(s => s.status === 'pending' || s.status === 'processing').length,
      completed: states.filter(s => s.status === 'completed').length,
      failed: states.filter(s => s.status === 'failed').length
    }
  }
}

// Export singleton instance
export const uploadPersistenceService = new UploadPersistenceServiceImpl()

// Export types
export type { UploadState, AnalysisState, UploadPersistenceService }
