'use client'

import { useState, useRef } from 'react'
import { validateResumeFile } from '@/lib/file-validation'

interface ResumeUploadProps {
  onUploadSuccess?: (resumeData: any) => void
  onUploadError?: (error: string) => void
}

export default function ResumeUpload({ onUploadSuccess, onUploadError }: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [salaryMin, setSalaryMin] = useState(3000)
  const [salaryMax, setSalaryMax] = useState(8000)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      const resumeData = await response.json()
      onUploadSuccess?.(resumeData)
      
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

      {/* Salary Expectation Range */}
      <div className="mb-8 p-6 border border-gray-200">
        <h3 className="text-lg font-medium text-black mb-4">Monthly Salary Expectation (SGD)</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Minimum</label>
            <input
              type="range"
              min="1000"
              max="20000"
              step="500"
              value={salaryMin}
              onChange={(e) => setSalaryMin(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>S$1,000</span>
              <span className="font-medium">S${salaryMin.toLocaleString()}</span>
              <span>S$20,000</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Maximum</label>
            <input
              type="range"
              min="1000"
              max="20000"
              step="500"
              value={salaryMax}
              onChange={(e) => setSalaryMax(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>S$1,000</span>
              <span className="font-medium">S${salaryMax.toLocaleString()}</span>
              <span>S$20,000</span>
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 border border-gray-200">
            <span className="text-sm text-gray-600">Range: </span>
            <span className="font-medium text-black">S${salaryMin.toLocaleString()} - S${salaryMax.toLocaleString()}</span>
          </div>
        </div>
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

      {selectedFile && !isUploading && (
        <div className="mt-6">
          <button onClick={handleUpload} className="w-full bg-black text-white py-3 px-6 font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">Upload & Analyze Resume</button>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">Supported formats: PDF, DOC, DOCX (max 10MB)</p>
      </div>
    </div>
  )
}
