import 'server-only'
import { supabaseAdmin } from './supabase'

export interface ResumeFile {
  filename: string
  fileType: string
  fileSize: number
  file: File
}

export class ResumeParser {
  /**
   * Upload resume file to Supabase storage
   */
  static async uploadResume(userId: string, file: File): Promise<string> {
    console.debug('[ResumeParser] uploadResume start', { userId, fileName: `${userId}/${Date.now()}.${file.name.split('.').pop()}` })

    const supabaseClient = supabaseAdmin()
    const fileName = `${userId}/${Date.now()}.${file.name.split('.').pop()}`
    
    const { data, error } = await supabaseClient.storage
      .from('resumes')
      .upload(fileName, file)

    if (error) {
      console.error('[ResumeParser] uploadResume failed:', error)
      throw new Error(`Failed to upload resume: ${error.message}`)
    }

    console.debug('[ResumeParser] uploadResume done', { path: data.path })
    return data.path
  }

  /**
   * Save resume metadata to database
   */
  static async saveResumeToDatabase(userId: string, filePath: string, file: File): Promise<string> {
    console.debug('[ResumeParser] saveResumeToDatabase start', { userId, filePath, fileSize: file.size })

    const supabaseClient = supabaseAdmin()
    
    const { data, error } = await supabaseClient
      .from('resumes')
      .insert({
        user_id: userId,
        file_path: filePath,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('[ResumeParser] saveResumeToDatabase failed:', error)
      throw new Error(`Database save failed: ${error.message}`)
    }

    console.debug('[ResumeParser] saveResumeToDatabase done', { resumeId: data.id })
    return data.id
  }

  /**
   * Process resume file - upload to storage and save to database
   */
  static async processResume(userId: string, file: File): Promise<{ resumeId: string; filePath: string }> {
    console.debug('[ResumeParser] processResume pipeline start', { userId })

    try {
      // Upload file to storage
      const filePath = await this.uploadResume(userId, file)
      
      // Save metadata to database
      const resumeId = await this.saveResumeToDatabase(userId, filePath, file)

      console.debug('[ResumeParser] processResume pipeline done', { resumeId, filePath })

      return { resumeId, filePath }
    } catch (error) {
      console.error('[ResumeParser] processResume failed:', error)
      throw new Error(`Resume processing failed: ${error}`)
    }
  }
}

// Helper function to validate file type
export function validateResumeFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
  
  const maxSize = 10 * 1024 * 1024 // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a PDF or DOCX file only.'
    }
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 10MB.'
    }
  }
  
  return { valid: true }
}