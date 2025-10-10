// Service Worker for background resume upload
const CACHE_NAME = 'resume-upload-v1'
const UPLOAD_QUEUE_KEY = 'upload-queue'
const UPLOAD_PROGRESS_KEY = 'upload-progress'

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  event.waitUntil(self.clients.claim())
})

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'resume-upload') {
    event.waitUntil(processUploadQueue())
  } else if (event.tag === 'llm-analysis') {
    event.waitUntil(processLLMAnalysisQueue())
  }
})

// Message handling
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data.type)
  
  switch (event.data.type) {
    case 'QUEUE_UPLOAD':
      queueUpload(event.data.payload)
      break
    case 'GET_UPLOAD_STATUS':
      getUploadStatus(event.data.uploadId)
      break
    case 'CANCEL_UPLOAD':
      cancelUpload(event.data.uploadId)
      break
    case 'QUEUE_LLM_ANALYSIS':
      queueLLMAnalysis(event.data.payload)
      break
    case 'GET_LLM_ANALYSIS_STATUS':
      getLLMAnalysisStatus(event.data.analysisId)
      break
    case 'CANCEL_LLM_ANALYSIS':
      cancelLLMAnalysis(event.data.analysisId)
      break
  }
})

// Queue upload for background processing
async function queueUpload(payload) {
  try {
    const queue = await getUploadQueue()
    const uploadId = generateUploadId()
    
    const uploadItem = {
      id: uploadId,
      timestamp: Date.now(),
      status: 'queued',
      payload: payload,
      retryCount: 0,
      maxRetries: 3
    }
    
    queue.push(uploadItem)
    await saveUploadQueue(queue)
    
    // Notify client
    notifyClient('upload-queued', { uploadId })
    
    // Try to process immediately
    await processUploadQueue()
    
  } catch (error) {
    console.error('[SW] Error queuing upload:', error)
    notifyClient('upload-error', { error: error.message })
  }
}

// Process upload queue
async function processUploadQueue() {
  try {
    const queue = await getUploadQueue()
    const pendingUploads = queue.filter(item => 
      item.status === 'queued' || item.status === 'retrying'
    )
    
    console.log(`[SW] Processing ${pendingUploads.length} pending uploads`)
    
    for (const uploadItem of pendingUploads) {
      await processUploadItem(uploadItem)
    }
    
  } catch (error) {
    console.error('[SW] Error processing upload queue:', error)
  }
}

// Process individual upload item
async function processUploadItem(uploadItem) {
  try {
    console.log(`[SW] Processing upload ${uploadItem.id}`)
    
    // Update status to processing
    await updateUploadStatus(uploadItem.id, 'processing')
    
    const { file, salaryMin, salaryMax } = uploadItem.payload
    
    // Create FormData
    const formData = new FormData()
    formData.append('resume', file)
    formData.append('salaryMin', salaryMin.toString())
    formData.append('salaryMax', salaryMax.toString())
    
    // Upload with progress tracking
    const response = await fetch('/api/resume/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }
    
    const result = await response.json()
    
    // Mark as completed
    await updateUploadStatus(uploadItem.id, 'completed', result)
    
    // Remove from queue
    await removeFromQueue(uploadItem.id)
    
    // Notify client
    notifyClient('upload-completed', { 
      uploadId: uploadItem.id, 
      result 
    })
    
  } catch (error) {
    console.error(`[SW] Upload ${uploadItem.id} failed:`, error)
    
    // Handle retry logic
    if (uploadItem.retryCount < uploadItem.maxRetries) {
      uploadItem.retryCount++
      uploadItem.status = 'retrying'
      await updateUploadStatus(uploadItem.id, 'retrying', { 
        retryCount: uploadItem.retryCount,
        error: error.message 
      })
      
      // Schedule retry
      setTimeout(() => {
        processUploadItem(uploadItem)
      }, Math.pow(2, uploadItem.retryCount) * 1000) // Exponential backoff
      
    } else {
      // Max retries exceeded
      await updateUploadStatus(uploadItem.id, 'failed', { 
        error: error.message 
      })
      notifyClient('upload-failed', { 
        uploadId: uploadItem.id, 
        error: error.message 
      })
    }
  }
}

// Update upload status
async function updateUploadStatus(uploadId, status, data = {}) {
  try {
    const queue = await getUploadQueue()
    const item = queue.find(u => u.id === uploadId)
    
    if (item) {
      item.status = status
      item.updatedAt = Date.now()
      if (data) {
        item.data = data
      }
      await saveUploadQueue(queue)
    }
    
    // Save progress separately for quick access
    await saveUploadProgress(uploadId, { status, ...data })
    
  } catch (error) {
    console.error('[SW] Error updating upload status:', error)
  }
}

// Get upload queue from IndexedDB
async function getUploadQueue() {
  try {
    const result = await self.indexedDB.open('upload-queue', 1)
    return new Promise((resolve, reject) => {
      result.onsuccess = () => {
        const db = result.result
        const transaction = db.transaction(['queue'], 'readonly')
        const store = transaction.objectStore('queue')
        const request = store.get('main')
        
        request.onsuccess = () => {
          resolve(request.result || [])
        }
        request.onerror = () => reject(request.error)
      }
      result.onerror = () => reject(result.error)
    })
  } catch (error) {
    console.error('[SW] Error getting upload queue:', error)
    return []
  }
}

// Save upload queue to IndexedDB
async function saveUploadQueue(queue) {
  try {
    const result = await self.indexedDB.open('upload-queue', 1)
    return new Promise((resolve, reject) => {
      result.onsuccess = () => {
        const db = result.result
        const transaction = db.transaction(['queue'], 'readwrite')
        const store = transaction.objectStore('queue')
        const request = store.put(queue, 'main')
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }
      result.onerror = () => reject(result.error)
    })
  } catch (error) {
    console.error('[SW] Error saving upload queue:', error)
  }
}

// Save upload progress
async function saveUploadProgress(uploadId, progress) {
  try {
    const result = await self.indexedDB.open('upload-progress', 1)
    return new Promise((resolve, reject) => {
      result.onsuccess = () => {
        const db = result.result
        const transaction = db.transaction(['progress'], 'readwrite')
        const store = transaction.objectStore('progress')
        const request = store.put(progress, uploadId)
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }
      result.onerror = () => reject(result.error)
    })
  } catch (error) {
    console.error('[SW] Error saving upload progress:', error)
  }
}

// Remove from queue
async function removeFromQueue(uploadId) {
  try {
    const queue = await getUploadQueue()
    const filteredQueue = queue.filter(item => item.id !== uploadId)
    await saveUploadQueue(filteredQueue)
  } catch (error) {
    console.error('[SW] Error removing from queue:', error)
  }
}

// Generate unique upload ID
function generateUploadId() {
  return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// Notify client about upload status
function notifyClient(type, data) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: `SW_${type.toUpperCase()}`,
        data
      })
    })
  })
}

// LLM Analysis Queue Management
const LLM_ANALYSIS_QUEUE_KEY = 'llm-analysis-queue'
const LLM_ANALYSIS_PROGRESS_KEY = 'llm-analysis-progress'

// Queue LLM analysis for background processing
async function queueLLMAnalysis(payload) {
  try {
    const queue = await getLLMAnalysisQueue()
    const analysisId = generateAnalysisId()
    
    const analysisItem = {
      id: analysisId,
      timestamp: Date.now(),
      status: 'queued',
      payload: payload,
      retryCount: 0,
      maxRetries: 3
    }
    
    queue.push(analysisItem)
    await saveLLMAnalysisQueue(queue)
    
    // Notify client
    notifyClient('llm-analysis-queued', { analysisId })
    
    // Try to process immediately
    await processLLMAnalysisQueue()
    
  } catch (error) {
    console.error('[SW] Error queuing LLM analysis:', error)
    notifyClient('llm-analysis-error', { error: error.message })
  }
}

// Process LLM analysis queue
async function processLLMAnalysisQueue() {
  try {
    const queue = await getLLMAnalysisQueue()
    const pendingAnalyses = queue.filter(item => 
      item.status === 'queued' || item.status === 'retrying'
    )
    
    console.log(`[SW] Processing ${pendingAnalyses.length} pending LLM analyses`)
    
    for (const analysisItem of pendingAnalyses) {
      await processLLMAnalysisItem(analysisItem)
    }
    
  } catch (error) {
    console.error('[SW] Error processing LLM analysis queue:', error)
  }
}

// Process individual LLM analysis item
async function processLLMAnalysisItem(analysisItem) {
  try {
    console.log(`[SW] Processing LLM analysis ${analysisItem.id}`)
    
    // Update status to processing
    await updateLLMAnalysisStatus(analysisItem.id, 'processing')
    
    const { userId, limit = 8 } = analysisItem.payload
    
    // Call the job recommendations API
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
    
    // Mark as completed
    await updateLLMAnalysisStatus(analysisItem.id, 'completed', result)
    
    // Remove from queue
    await removeFromLLMAnalysisQueue(analysisItem.id)
    
    // Notify client
    notifyClient('llm-analysis-completed', { 
      analysisId: analysisItem.id, 
      result 
    })
    
  } catch (error) {
    console.error(`[SW] LLM analysis ${analysisItem.id} failed:`, error)
    
    // Handle retry logic
    if (analysisItem.retryCount < analysisItem.maxRetries) {
      analysisItem.retryCount++
      analysisItem.status = 'retrying'
      await updateLLMAnalysisStatus(analysisItem.id, 'retrying', { 
        retryCount: analysisItem.retryCount,
        error: error.message 
      })
      
      // Schedule retry
      setTimeout(() => {
        processLLMAnalysisItem(analysisItem)
      }, Math.pow(2, analysisItem.retryCount) * 1000) // Exponential backoff
      
    } else {
      // Max retries exceeded
      await updateLLMAnalysisStatus(analysisItem.id, 'failed', { 
        error: error.message 
      })
      notifyClient('llm-analysis-failed', { 
        analysisId: analysisItem.id, 
        error: error.message 
      })
    }
  }
}

// Update LLM analysis status
async function updateLLMAnalysisStatus(analysisId, status, data = {}) {
  try {
    const queue = await getLLMAnalysisQueue()
    const item = queue.find(a => a.id === analysisId)
    
    if (item) {
      item.status = status
      item.updatedAt = Date.now()
      if (data) {
        item.data = data
      }
      await saveLLMAnalysisQueue(queue)
    }
    
    // Save progress separately for quick access
    await saveLLMAnalysisProgress(analysisId, { status, ...data })
    
  } catch (error) {
    console.error('[SW] Error updating LLM analysis status:', error)
  }
}

// Get LLM analysis queue from IndexedDB
async function getLLMAnalysisQueue() {
  try {
    const result = await self.indexedDB.open('llm-analysis-queue', 1)
    return new Promise((resolve, reject) => {
      result.onsuccess = () => {
        const db = result.result
        const transaction = db.transaction(['queue'], 'readonly')
        const store = transaction.objectStore('queue')
        const request = store.get('main')
        
        request.onsuccess = () => {
          resolve(request.result || [])
        }
        request.onerror = () => reject(request.error)
      }
      result.onerror = () => reject(result.error)
    })
  } catch (error) {
    console.error('[SW] Error getting LLM analysis queue:', error)
    return []
  }
}

// Save LLM analysis queue to IndexedDB
async function saveLLMAnalysisQueue(queue) {
  try {
    const result = await self.indexedDB.open('llm-analysis-queue', 1)
    return new Promise((resolve, reject) => {
      result.onsuccess = () => {
        const db = result.result
        const transaction = db.transaction(['queue'], 'readwrite')
        const store = transaction.objectStore('queue')
        const request = store.put(queue, 'main')
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }
      result.onerror = () => reject(result.error)
    })
  } catch (error) {
    console.error('[SW] Error saving LLM analysis queue:', error)
  }
}

// Save LLM analysis progress
async function saveLLMAnalysisProgress(analysisId, progress) {
  try {
    const result = await self.indexedDB.open('llm-analysis-progress', 1)
    return new Promise((resolve, reject) => {
      result.onsuccess = () => {
        const db = result.result
        const transaction = db.transaction(['progress'], 'readwrite')
        const store = transaction.objectStore('progress')
        const request = store.put(progress, analysisId)
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }
      result.onerror = () => reject(result.error)
    })
  } catch (error) {
    console.error('[SW] Error saving LLM analysis progress:', error)
  }
}

// Remove from LLM analysis queue
async function removeFromLLMAnalysisQueue(analysisId) {
  try {
    const queue = await getLLMAnalysisQueue()
    const filteredQueue = queue.filter(item => item.id !== analysisId)
    await saveLLMAnalysisQueue(filteredQueue)
  } catch (error) {
    console.error('[SW] Error removing from LLM analysis queue:', error)
  }
}

// Generate unique analysis ID
function generateAnalysisId() {
  return 'analysis_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// Initialize IndexedDB
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Initialize upload queue DB
        const queueDB = await new Promise((resolve, reject) => {
          const request = self.indexedDB.open('upload-queue', 1)
          request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('queue')) {
              db.createObjectStore('queue')
            }
          }
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        
        // Initialize progress DB
        const progressDB = await new Promise((resolve, reject) => {
          const request = self.indexedDB.open('upload-progress', 1)
          request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('progress')) {
              db.createObjectStore('progress')
            }
          }
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        
        // Initialize LLM analysis queue DB
        const llmQueueDB = await new Promise((resolve, reject) => {
          const request = self.indexedDB.open('llm-analysis-queue', 1)
          request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('queue')) {
              db.createObjectStore('queue')
            }
          }
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        
        // Initialize LLM analysis progress DB
        const llmProgressDB = await new Promise((resolve, reject) => {
          const request = self.indexedDB.open('llm-analysis-progress', 1)
          request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('progress')) {
              db.createObjectStore('progress')
            }
          }
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        
        console.log('[SW] IndexedDB initialized')
      } catch (error) {
        console.error('[SW] IndexedDB initialization failed:', error)
      }
    })()
  )
})
