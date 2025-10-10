// Background upload service for handling resume uploads when app is backgrounded
interface UploadPayload {
  file: File
  salaryMin: number
  salaryMax: number
}

interface UploadStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying'
  progress?: number
  error?: string
  result?: any
  retryCount?: number
}

interface AnalysisPayload {
  userId: string
  limit?: number
}

interface AnalysisStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying'
  progress?: number
  error?: string
  result?: any
  retryCount?: number
}

interface BackgroundUploadService {
  registerServiceWorker(): Promise<void>
  queueUpload(payload: UploadPayload): Promise<string>
  getUploadStatus(uploadId: string): Promise<UploadStatus | null>
  cancelUpload(uploadId: string): Promise<void>
  queueLLMAnalysis(payload: AnalysisPayload): Promise<string>
  getLLMAnalysisStatus(analysisId: string): Promise<AnalysisStatus | null>
  cancelLLMAnalysis(analysisId: string): Promise<void>
  isBackgroundSyncSupported(): boolean
  requestBackgroundSync(): Promise<void>
}

class BackgroundUploadServiceImpl implements BackgroundUploadService {
  private swRegistration: ServiceWorkerRegistration | null = null
  private messageHandlers: Map<string, (data: any) => void> = new Map()

  constructor() {
    this.setupMessageListener()
  }

  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[BackgroundUpload] Service Worker not supported')
      return
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('[BackgroundUpload] Service Worker registered:', this.swRegistration.scope)

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready
      
      // Listen for service worker updates
      this.swRegistration.addEventListener('updatefound', () => {
        const newWorker = this.swRegistration!.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[BackgroundUpload] New service worker available')
              // Notify user about update
              this.notifyUser('New version available. Refresh to update.')
            }
          })
        }
      })

    } catch (error) {
      console.error('[BackgroundUpload] Service Worker registration failed:', error)
      throw error
    }
  }

  async queueUpload(payload: UploadPayload): Promise<string> {
    if (!this.swRegistration?.active) {
      throw new Error('Service Worker not available')
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        const { type, data } = event.data
        
        if (type === 'SW_UPLOAD_QUEUED') {
          resolve(data.uploadId)
        } else if (type === 'SW_UPLOAD_ERROR') {
          reject(new Error(data.error))
        }
      }

      this.swRegistration!.active!.postMessage({
        type: 'QUEUE_UPLOAD',
        payload
      }, [messageChannel.port2])

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Upload queue timeout'))
      }, 5000)
    })
  }

  async getUploadStatus(uploadId: string): Promise<UploadStatus | null> {
    if (!this.swRegistration?.active) {
      return null
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        const { type, data } = event.data
        
        if (type === 'SW_UPLOAD_STATUS') {
          resolve(data.status)
        }
      }

      this.swRegistration!.active!.postMessage({
        type: 'GET_UPLOAD_STATUS',
        uploadId
      }, [messageChannel.port2])

      // Timeout after 3 seconds
      setTimeout(() => {
        resolve(null)
      }, 3000)
    })
  }

  async cancelUpload(uploadId: string): Promise<void> {
    if (!this.swRegistration?.active) {
      return
    }

    this.swRegistration.active.postMessage({
      type: 'CANCEL_UPLOAD',
      uploadId
    })
  }

  async queueLLMAnalysis(payload: AnalysisPayload): Promise<string> {
    if (!this.swRegistration?.active) {
      throw new Error('Service Worker not available')
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        const { type, data } = event.data
        
        if (type === 'SW_LLM_ANALYSIS_QUEUED') {
          resolve(data.analysisId)
        } else if (type === 'SW_LLM_ANALYSIS_ERROR') {
          reject(new Error(data.error))
        }
      }

      this.swRegistration!.active!.postMessage({
        type: 'QUEUE_LLM_ANALYSIS',
        payload
      }, [messageChannel.port2])

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('LLM analysis queue timeout'))
      }, 5000)
    })
  }

  async getLLMAnalysisStatus(analysisId: string): Promise<AnalysisStatus | null> {
    if (!this.swRegistration?.active) {
      return null
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        const { type, data } = event.data
        
        if (type === 'SW_LLM_ANALYSIS_STATUS') {
          resolve(data.status)
        }
      }

      this.swRegistration!.active!.postMessage({
        type: 'GET_LLM_ANALYSIS_STATUS',
        analysisId
      }, [messageChannel.port2])

      // Timeout after 3 seconds
      setTimeout(() => {
        resolve(null)
      }, 3000)
    })
  }

  async cancelLLMAnalysis(analysisId: string): Promise<void> {
    if (!this.swRegistration?.active) {
      return
    }

    this.swRegistration.active.postMessage({
      type: 'CANCEL_LLM_ANALYSIS',
      analysisId
    })
  }

  isBackgroundSyncSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'sync' in window.ServiceWorkerRegistration.prototype &&
           this.swRegistration !== null
  }

  async requestBackgroundSync(): Promise<void> {
    if (!this.isBackgroundSyncSupported()) {
      throw new Error('Background Sync not supported')
    }

    try {
      await this.swRegistration!.sync.register('resume-upload')
      console.log('[BackgroundUpload] Background sync registered')
    } catch (error) {
      console.error('[BackgroundUpload] Background sync registration failed:', error)
      throw error
    }
  }

  async requestLLMAnalysisSync(): Promise<void> {
    if (!this.isBackgroundSyncSupported()) {
      throw new Error('Background Sync not supported')
    }

    try {
      await this.swRegistration!.sync.register('llm-analysis')
      console.log('[BackgroundUpload] LLM analysis background sync registered')
    } catch (error) {
      console.error('[BackgroundUpload] LLM analysis background sync registration failed:', error)
      throw error
    }
  }

  private setupMessageListener(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data
      
      switch (type) {
        case 'SW_UPLOAD_COMPLETED':
          this.handleUploadCompleted(data)
          break
        case 'SW_UPLOAD_FAILED':
          this.handleUploadFailed(data)
          break
        case 'SW_UPLOAD_PROGRESS':
          this.handleUploadProgress(data)
          break
        case 'SW_UPLOAD_ERROR':
          this.handleUploadError(data)
          break
        case 'SW_LLM_ANALYSIS_COMPLETED':
          this.handleLLMAnalysisCompleted(data)
          break
        case 'SW_LLM_ANALYSIS_FAILED':
          this.handleLLMAnalysisFailed(data)
          break
        case 'SW_LLM_ANALYSIS_PROGRESS':
          this.handleLLMAnalysisProgress(data)
          break
        case 'SW_LLM_ANALYSIS_ERROR':
          this.handleLLMAnalysisError(data)
          break
      }
    })
  }

  private handleUploadCompleted(data: any): void {
    console.log('[BackgroundUpload] Upload completed:', data.uploadId)
    this.notifyUser('Resume upload completed successfully!')
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('upload-completed')
    if (handler) {
      handler(data)
    }
  }

  private handleUploadFailed(data: any): void {
    console.error('[BackgroundUpload] Upload failed:', data.uploadId, data.error)
    this.notifyUser(`Resume upload failed: ${data.error}`)
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('upload-failed')
    if (handler) {
      handler(data)
    }
  }

  private handleUploadProgress(data: any): void {
    console.log('[BackgroundUpload] Upload progress:', data.uploadId, data.progress)
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('upload-progress')
    if (handler) {
      handler(data)
    }
  }

  private handleUploadError(data: any): void {
    console.error('[BackgroundUpload] Upload error:', data.error)
    this.notifyUser(`Upload error: ${data.error}`)
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('upload-error')
    if (handler) {
      handler(data)
    }
  }

  private handleLLMAnalysisCompleted(data: any): void {
    console.log('[BackgroundUpload] LLM analysis completed:', data.analysisId)
    this.notifyUser('Job analysis completed successfully!')
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('llm-analysis-completed')
    if (handler) {
      handler(data)
    }
  }

  private handleLLMAnalysisFailed(data: any): void {
    console.error('[BackgroundUpload] LLM analysis failed:', data.analysisId, data.error)
    this.notifyUser(`Job analysis failed: ${data.error}`)
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('llm-analysis-failed')
    if (handler) {
      handler(data)
    }
  }

  private handleLLMAnalysisProgress(data: any): void {
    console.log('[BackgroundUpload] LLM analysis progress:', data.analysisId, data.progress)
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('llm-analysis-progress')
    if (handler) {
      handler(data)
    }
  }

  private handleLLMAnalysisError(data: any): void {
    console.error('[BackgroundUpload] LLM analysis error:', data.error)
    this.notifyUser(`Analysis error: ${data.error}`)
    
    // Trigger any registered handlers
    const handler = this.messageHandlers.get('llm-analysis-error')
    if (handler) {
      handler(data)
    }
  }

  private notifyUser(message: string): void {
    // Use browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Resume Upload', {
        body: message,
        icon: '/favicon.ico'
      })
    } else {
      // Fallback to console or custom notification
      console.log('[BackgroundUpload]', message)
    }
  }

  // Register event handlers
  onUploadCompleted(handler: (data: any) => void): void {
    this.messageHandlers.set('upload-completed', handler)
  }

  onUploadFailed(handler: (data: any) => void): void {
    this.messageHandlers.set('upload-failed', handler)
  }

  onUploadProgress(handler: (data: any) => void): void {
    this.messageHandlers.set('upload-progress', handler)
  }

  onUploadError(handler: (data: any) => void): void {
    this.messageHandlers.set('upload-error', handler)
  }

  onLLMAnalysisCompleted(handler: (data: any) => void): void {
    this.messageHandlers.set('llm-analysis-completed', handler)
  }

  onLLMAnalysisFailed(handler: (data: any) => void): void {
    this.messageHandlers.set('llm-analysis-failed', handler)
  }

  onLLMAnalysisProgress(handler: (data: any) => void): void {
    this.messageHandlers.set('llm-analysis-progress', handler)
  }

  onLLMAnalysisError(handler: (data: any) => void): void {
    this.messageHandlers.set('llm-analysis-error', handler)
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
}

// Export singleton instance
export const backgroundUploadService = new BackgroundUploadServiceImpl()

// Export types
export type { UploadPayload, UploadStatus, AnalysisPayload, AnalysisStatus, BackgroundUploadService }
