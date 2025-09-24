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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-blue-600">Singapore Job Matcher</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Why Send Your Same Resume to 100 Companies?
            <span className="text-blue-600 block">Get Targeted Matches Instead</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Upload your resume and get personalized job recommendations based on your skills, 
            experience, and career goals. No more generic applications.
          </p>
          
          {user ? (
            <div className="space-y-4 mb-8">
              <p className="text-lg text-gray-700">Welcome back, {user.name || user.email}!</p>
              <div className="flex justify-center space-x-4">
                <a
                  href="/jobs"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                >
                  Browse All Jobs
                </a>
                <a
                  href="/dashboard"
                  className="bg-white text-blue-600 px-6 py-3 rounded-lg border border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                >
                  My Dashboard
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setShowLogin(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                >
                  Sign In to Browse Jobs
                </button>
                <a
                  href="#upload"
                  className="bg-white text-blue-600 px-6 py-3 rounded-lg border border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                >
                  Upload Resume
                </a>
              </div>
            </div>
          )}
          
          {/* Live Stats */}
          <div className="flex justify-center gap-8 mb-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {statsLoading ? '...' : jobStats.totalJobs.toLocaleString()}
              </div>
              <div className="text-gray-600">Active Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {statsLoading ? '...' : jobStats.totalCompanies.toLocaleString()}+
              </div>
              <div className="text-gray-600">Companies</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {statsLoading ? '...' : jobStats.newJobsToday}
              </div>
              <div className="text-gray-600">New Today</div>
            </div>
          </div>
        </div>

        {/* Resume Upload Form */}
        <div className="max-w-md mx-auto mb-16" id="upload">
          <ResumeUpload 
            onUploadSuccess={(resumeData) => {
              console.log('Resume uploaded successfully:', resumeData)
              // You can add success handling here
            }}
            onUploadError={(error) => {
              console.error('Resume upload error:', error)
              // You can add error handling here
            }}
          />
        </div>

        {/* Featured Jobs Preview or Recommendations */}
        <div className="max-w-4xl mx-auto">
          {user ? (
            <JobRecommendations limit={6} />
          ) : (
            <>
              <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
                Featured Jobs This Week
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {mockupJobs.map((job, index) => (
                  <JobCard key={index} job={job} />
                ))}
              </div>
              
              <div className="text-center mt-8">
                <p className="text-gray-600 mb-4">
                  Want personalized job recommendations?
                </p>
                <a 
                  href="#upload" 
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Upload Your Resume
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose Our Targeted Approach?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered Analysis</h3>
              <p className="text-gray-600">Our AI analyzes your resume to understand your strengths, skills, and career goals.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Matching</h3>
              <p className="text-gray-600">Get matched with jobs that truly fit your profile, not just keyword matches.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Save Time</h3>
              <p className="text-gray-600">Stop applying to hundreds of jobs. Focus on the ones that matter most to your career.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2025 Singapore Job Matcher. Helping you find targeted opportunities.
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