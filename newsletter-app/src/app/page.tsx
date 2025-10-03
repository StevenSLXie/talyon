'use client'

import ResumeUpload from '@/components/ResumeUpload'
import JobCard from '@/components/JobCard'
import JobRecommendations from '@/components/JobRecommendations'
import LoginForm from '@/components/LoginForm'
import UserMenu from '@/components/UserMenu'
import { useAuth } from '@/components/AuthProvider'
import { useState, useEffect } from 'react'

// Mockup jobs data from refined_jobs_20250918_222615.json
const mockupJobs = [
  {
    company: "MICHAEL PAGE INTERNATIONAL PTE LTD",
    title: "Product Reliability & Validation Director",
    location: "Islandwide",
    salary_low: 10000,
    salary_high: 13000,
    industry: "Engineering",
    job_type: "Full Time",
    experience_level: "Director"
  },
  {
    company: "AEROSPEC SUPPLIES PTE LTD",
    title: "Head of Production (Operation)",
    location: "Islandwide",
    salary_low: 10000,
    salary_high: 15000,
    industry: "Engineering",
    job_type: "Full Time",
    experience_level: "Senior Executive"
  },
  {
    company: "RAINBOW HUES PTE. LTD.",
    title: "Admin / Secretarial",
    location: "Islandwide",
    salary_low: 1500,
    salary_high: 2500,
    industry: "Admin",
    job_type: "Part Time",
    experience_level: "Executive"
  }
]

export default function Home() {
  const { user, loading } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0) // Add refresh key for job recommendations
  const [jobStats, setJobStats] = useState({
    totalJobs: 1351,
    totalCompanies: 500,
    newJobsToday: 23
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    loadJobStats()
  }, [])

  const loadJobStats = async () => {
    setStatsLoading(true)
    try {
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const data = await response.json()
        setJobStats({
          totalJobs: data.total || 1351,
          totalCompanies: Math.floor((data.total || 1351) / 3), // Estimate
          newJobsToday: Math.floor((data.total || 1351) * 0.02) // Estimate 2% new today
        })
      }
    } catch (error) {
      console.error('Error loading job stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-black">Talyon</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="bg-black text-white px-6 py-2 rounded-none hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-20">
          <h1 className="text-6xl font-light text-black mb-8 leading-tight">
            Stop Sending 1000+ Resumes
            <span className="block font-bold">Get Targeted Matches Instead</span>
          </h1>
          <p className="text-lg text-gray-600 mb-12 max-w-xl mx-auto leading-relaxed">
            Why waste time sending the same resume everywhere? Upload once, 
            get personalized job recommendations that actually fit your skills and career goals.
          </p>
          
          {user ? (
            <div className="space-y-6 mb-12">
              <p className="text-gray-600">Welcome back, {user.name || user.email}</p>
              <JobRecommendations key={refreshKey} />
            </div>
          ) : (
            <div className="space-y-6 mb-12">
              <div className="flex justify-center space-x-6">
                <button
                  onClick={() => setShowLogin(true)}
                  className="bg-black text-white px-8 py-3 rounded-none hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-colors"
                >
                  Sign In
                </button>
                <a
                  href="#upload"
                  className="bg-white text-black px-8 py-3 border border-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-colors"
                >
                  Upload Resume
                </a>
              </div>
            </div>
          )}
          
          {/* Live Stats */}
          <div className="flex justify-center gap-12 mb-16">
            <div className="text-center">
              <div className="text-4xl font-light text-black">
                {statsLoading ? '...' : jobStats.totalJobs.toLocaleString()}
              </div>
              <div className="text-gray-500 text-sm uppercase tracking-wide">Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-light text-black">
                {statsLoading ? '...' : jobStats.totalCompanies.toLocaleString()}+
              </div>
              <div className="text-gray-500 text-sm uppercase tracking-wide">Companies</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-light text-black">
                {statsLoading ? '...' : jobStats.newJobsToday}
              </div>
              <div className="text-gray-500 text-sm uppercase tracking-wide">New Today</div>
            </div>
          </div>
        </div>

        {/* Resume Upload Form */}
        <div className="max-w-md mx-auto mb-16" id="upload">
          <ResumeUpload 
            onUploadSuccess={(resumeData) => {
              console.log('Resume uploaded successfully:', resumeData)
              // Refresh job recommendations by changing the key
              setRefreshKey(prev => prev + 1)
              // Dispatch custom event for dashboard to listen
              window.dispatchEvent(new CustomEvent('resumeUploaded'))
            }}
            onUploadError={(error) => {
              console.error('Resume upload error:', error)
              // You can add error handling here
            }}
          />
        </div>

        {/* Job Recommendations for logged-in users */}
        {user && refreshKey > 0 && (
          <div className="max-w-6xl mx-auto">
            <JobRecommendations key={refreshKey} limit={6} refreshTrigger={refreshKey} userId={user?.id} />
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-light text-center text-black mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-black rounded-none flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-4 text-black">AI Analysis</h3>
              <p className="text-gray-600 leading-relaxed">Our AI analyzes your resume to understand your strengths, skills, and career goals.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black rounded-none flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-4 text-black">Smart Matching</h3>
              <p className="text-gray-600 leading-relaxed">Get matched with jobs that truly fit your profile, not just keyword matches.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black rounded-none flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-4 text-black">Save Time</h3>
              <p className="text-gray-600 leading-relaxed">Stop applying to hundreds of jobs. Focus on the ones that matter most to your career.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2025 JobMatcher. Focus on what matters.
          </p>
        </div>
      </footer>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <LoginForm
            onSuccess={() => setShowLogin(false)}
            onClose={() => setShowLogin(false)}
          />
        </div>
      )}
    </div>
  )
}