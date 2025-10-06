'use client'

import { useState } from 'react'
import { validate } from 'email-validator'

interface LoginResponse {
  user?: {
    id: string
    email: string
    name?: string | null
  }
}

interface LoginFormProps {
  onSuccess?: (user: LoginResponse['user']) => void
  onClose?: () => void
}

export default function LoginForm({ onSuccess, onClose }: LoginFormProps) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [devCode, setDevCode] = useState('')

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !validate(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data: { code?: string; error?: string } = await response.json()

      if (response.ok) {
        setStep('code')
        setSuccess(`Verification code sent to ${email}`)
        
        // If email sending failed and code is returned for development
        if (data.code) {
          setDevCode(data.code)
          setSuccess(`Email not configured. Your code is: ${data.code}`)
        }
      } else {
        setError(data.error || 'Failed to send verification code')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      })

      const data: LoginResponse = await response.json()

      if (response.ok) {
        setSuccess('Login successful!')
        onSuccess?.(data.user ?? null)
        // Refresh the page to update the UI
        window.location.reload()
      } else {
        setError(data.error || 'Invalid verification code')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setStep('email')
    setCode('')
    setError('')
    setSuccess('')
    setDevCode('')
  }

  if (step === 'email') {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-gray-600 mt-2">Enter your email to receive a login code</p>
        </div>

        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending Code...' : 'Send Login Code'}
          </button>
        </form>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full mt-4 text-gray-600 hover:text-gray-800 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Enter Verification Code</h2>
        <p className="text-gray-600 mt-2">
          We sent a 6-digit code to <span className="font-medium">{email}</span>
        </p>
      </div>

      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
            Verification Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
            placeholder="000000"
            maxLength={6}
            required
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md">
            {success}
          </div>
        )}

        {devCode && (
          <div className="text-blue-600 text-sm bg-blue-50 p-3 rounded-md border border-blue-200">
            <div className="font-medium mb-1">Development Mode:</div>
            <div className="text-center">
              <span className="text-lg font-mono font-bold">{devCode}</span>
            </div>
            <div className="text-xs mt-1 text-blue-500">
              Copy this code to login (email not configured)
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : 'Verify & Login'}
        </button>
      </form>

      <div className="mt-4 space-y-2">
        <button
          onClick={handleBackToEmail}
          className="w-full text-gray-600 hover:text-gray-800 text-sm"
        >
          ← Back to email
        </button>
        
        <button
          onClick={handleSendCode}
          className="w-full text-blue-600 hover:text-blue-800 text-sm"
        >
          Resend code
        </button>
      </div>
    </div>
  )
}
