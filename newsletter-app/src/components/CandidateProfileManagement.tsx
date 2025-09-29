'use client'

import { useState, useEffect } from 'react'

interface CandidateProfile {
  id: string
  work_auth: {
    citizen_or_pr: boolean
    ep_ok: boolean
    sp_ok: boolean
    wp_ok: boolean
  }
  seniority_level: string
  current_title: string
  target_titles: string[]
  industries: string[]
  company_tiers: string[]
  salary_expect_min: number
  salary_expect_max: number
  salary_currency: string
  work_prefs: {
    remote_ok: boolean
    hybrid_ok: boolean
    onsite_ok: boolean
    job_types: string[]
  }
  intent: {
    open_to_work: boolean
    notice_period: string
    urgency: string
  }
  activity: {
    last_active: string
    applications_count: number
  }
  profile_version: string
  extraction_meta: any
}

interface CandidateSkills {
  id: string
  skill_name: string
  level: number
  last_used: string
  evidence: string
  skill_category: string
}

interface CandidateWork {
  id: string
  company: string
  title: string
  start_date: string
  end_date: string | null
  description: string
  company_tier: string
  job_family: string
  seniority_level: string
  skills_used: string[]
  achievements: string[]
}

interface CandidateEducation {
  id: string
  institution: string
  area: string
  study_type: string
  start_date: string
  end_date: string | null
  gpa: string | null
}

interface CandidateCertifications {
  id: string
  name: string
  issuer: string
  issue_date: string
  expiry_date: string | null
}

interface CandidateProfileManagementProps {
  userId?: string
}

export default function CandidateProfileManagement({ userId }: CandidateProfileManagementProps) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [skills, setSkills] = useState<CandidateSkills[]>([])
  const [workExperience, setWorkExperience] = useState<CandidateWork[]>([])
  const [education, setEducation] = useState<CandidateEducation[]>([])
  const [certifications, setCertifications] = useState<CandidateCertifications[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'experience' | 'education' | 'preferences'>('overview')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/candidate/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load profile')
      }

      const data = await response.json()
      setProfile(data.profile)
      setSkills(data.skills || [])
      setWorkExperience(data.workExperience || [])
      setEducation(data.education || [])
      setCertifications(data.certifications || [])
    } catch (error) {
      console.error('Error loading profile:', error)
      setError('Failed to load candidate profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const response = await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile,
          skills,
          workExperience,
          education,
          certifications
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      setIsEditing(false)
      await loadProfile() // Reload to get updated data
    } catch (error) {
      console.error('Error saving profile:', error)
      setError('Failed to save profile')
    }
  }

  const getSkillLevelColor = (level: number) => {
    if (level >= 4) return 'bg-green-100 text-green-800'
    if (level >= 3) return 'bg-yellow-100 text-yellow-800'
    if (level >= 2) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  const getSkillLevelText = (level: number) => {
    const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master']
    return levels[level - 1] || 'Unknown'
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600">Loading profile...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadProfile}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">
            No profile data available yet.
          </p>
          <p className="text-sm text-gray-500">
            Upload your resume to create your candidate profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Candidate Profile</h1>
            <p className="text-gray-600">Manage your professional profile and preferences</p>
          </div>
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'skills', label: 'Skills' },
              { key: 'experience', label: 'Experience' },
              { key: 'education', label: 'Education' },
              { key: 'preferences', label: 'Preferences' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current Title</label>
                      <p className="mt-1 text-sm text-gray-900">{profile.current_title || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Seniority Level</label>
                      <p className="mt-1 text-sm text-gray-900">{profile.seniority_level || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Work Authorization</label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {profile.work_auth?.citizen_or_pr && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Citizen/PR</span>
                        )}
                        {profile.work_auth?.ep_ok && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">EP</span>
                        )}
                        {profile.work_auth?.sp_ok && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">SP</span>
                        )}
                        {profile.work_auth?.wp_ok && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">WP</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Salary Expectations</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Salary Range</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {profile.salary_expect_min && profile.salary_expect_max
                          ? `${profile.salary_currency} ${profile.salary_expect_min.toLocaleString()} - ${profile.salary_expect_max.toLocaleString()}`
                          : 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Target Industries</label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {profile.industries?.map((industry, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                            {industry}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company Tiers</label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {profile.company_tiers?.map((tier, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {tier}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Preferences */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Work Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Arrangement</label>
                    <div className="flex flex-wrap gap-2">
                      {profile.work_prefs?.remote_ok && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Remote</span>
                      )}
                      {profile.work_prefs?.hybrid_ok && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Hybrid</span>
                      )}
                      {profile.work_prefs?.onsite_ok && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Onsite</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Types</label>
                    <div className="flex flex-wrap gap-2">
                      {profile.work_prefs?.job_types?.map((type, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Skills & Expertise</h3>
                <span className="text-sm text-gray-500">{skills.length} skills</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.map((skill) => (
                  <div key={skill.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{skill.skill_name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getSkillLevelColor(skill.level)}`}>
                        Level {skill.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{getSkillLevelText(skill.level)}</p>
                    {skill.skill_category && (
                      <p className="text-xs text-gray-500 mb-2">Category: {skill.skill_category}</p>
                    )}
                    {skill.last_used && (
                      <p className="text-xs text-gray-500">Last used: {skill.last_used}</p>
                    )}
                    {skill.evidence && (
                      <p className="text-xs text-gray-600 mt-2 italic">"{skill.evidence}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'experience' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Work Experience</h3>
                <span className="text-sm text-gray-500">{workExperience.length} positions</span>
              </div>

              <div className="space-y-6">
                {workExperience.map((work) => (
                  <div key={work.id} className="bg-gray-50 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{work.title}</h4>
                        <p className="text-gray-600">{work.company}</p>
                        <p className="text-sm text-gray-500">
                          {work.start_date} - {work.end_date || 'Present'}
                        </p>
                      </div>
                      <div className="text-right">
                        {work.company_tier && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {work.company_tier}
                          </span>
                        )}
                      </div>
                    </div>

                    {work.description && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-900 mb-2">Description</h5>
                        <p className="text-sm text-gray-600">{work.description}</p>
                      </div>
                    )}

                    {work.skills_used && work.skills_used.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-900 mb-2">Skills Used</h5>
                        <div className="flex flex-wrap gap-2">
                          {work.skills_used.map((skill, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {work.achievements && work.achievements.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Key Achievements</h5>
                        <ul className="space-y-1">
                          {work.achievements.map((achievement, idx) => (
                            <li key={idx} className="flex items-start text-sm text-gray-600">
                              <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {achievement}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'education' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Education</h3>
                <span className="text-sm text-gray-500">{education.length} degrees</span>
              </div>

              <div className="space-y-4">
                {education.map((edu) => (
                  <div key={edu.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{edu.study_type} in {edu.area}</h4>
                        <p className="text-gray-600">{edu.institution}</p>
                        <p className="text-sm text-gray-500">
                          {edu.start_date} - {edu.end_date || 'Present'}
                        </p>
                      </div>
                      {edu.gpa && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          GPA: {edu.gpa}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Certifications</h3>
                <div className="space-y-4">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{cert.name}</h4>
                          <p className="text-gray-600">{cert.issuer}</p>
                          <p className="text-sm text-gray-500">
                            Issued: {cert.issue_date}
                            {cert.expiry_date && ` - Expires: ${cert.expiry_date}`}
                          </p>
                        </div>
                        {cert.expiry_date && new Date(cert.expiry_date) > new Date() && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            Valid
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Job Search Preferences</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Target Positions</h4>
                  <div className="space-y-2">
                    {profile.target_titles?.map((title, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-900">{title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Job Search Status</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Open to Work</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {profile.intent?.open_to_work ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notice Period</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {profile.intent?.notice_period || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Urgency</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {profile.intent?.urgency || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">Activity Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">{profile.activity?.applications_count || 0}</div>
                    <div className="text-sm text-blue-800">Applications</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{skills.length}</div>
                    <div className="text-sm text-green-800">Skills</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">{workExperience.length}</div>
                    <div className="text-sm text-purple-800">Positions</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
