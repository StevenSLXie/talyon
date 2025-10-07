// Client-safe file validation (no server/node deps)
export function validateResumeFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]

  const maxSize = 10 * 1024 * 1024 // 10MB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Please upload a PDF or DOCX file only.' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB.' }
  }

  return { valid: true }
}
