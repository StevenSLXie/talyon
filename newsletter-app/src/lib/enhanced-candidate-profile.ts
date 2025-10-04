// Enhanced Candidate Profile Service
import { supabaseAdmin } from './supabase'
import { currencyConverter } from './currency-converter'

export interface EnhancedCandidateProfile {
  work_auth: {
    citizen_or_pr: boolean
    ep_needed: boolean
    work_permit_type: string | null
  }
  seniority_level: string
  current_title: string
  target_titles: string[]
  experience_years: number
  skills: Array<{
    name: string
    level: number
    last_used: string
    evidence: string | null
  }>
  education: Array<{
    degree: string
    major: string
    institution: string
    grad_year: number
  }>
  certifications: string[]
  industries: string[]
  company_tiers: string[]
  salary_expect: {
    min: number
    max: number
    currency: string
  }
  work_prefs: {
    remote: string
    job_type: string
  }
  intent: {
    target_industries: string[]
    must_have: string[]
    nice_to_have: string[]
    blacklist_companies: string[]
  }
  leadership_level: 'IC' | 'Team Lead' | 'Team Lead++'
  management_experience: {
    has_management: boolean
    direct_reports_count: number
    team_size_range: string | null
    management_years: number
    management_evidence: string[]
  }
}

export class EnhancedCandidateProfileService {
  /**
   * Save enhanced candidate profile to database
   */
  static async saveEnhancedProfile(
    userId: string,
    resumeId: string,
    profile: EnhancedCandidateProfile
  ): Promise<{ success: boolean; counts: any }> {
    try {
      console.debug('[EnhancedProfile] saveEnhancedProfile start', { userId, resumeId })

      const supabaseClient = supabaseAdmin()
      const counts = {
        basics: 0,
        skills: 0,
        education: 0,
        certificates: 0,
        work: 0
      }

      // 1. Save to candidate_basics (enhanced)
      console.log('[EnhancedProfile] Saving salary data:', {
        salary_expect_min: profile.salary_expect?.min ? Math.round(Number(profile.salary_expect.min)) : 0,
        salary_expect_max: profile.salary_expect?.max ? Math.round(Number(profile.salary_expect.max)) : 0,
        salary_currency: profile.salary_expect?.currency || 'SGD'
      })
      
      console.log('[EnhancedProfile] About to save basics with salary:', {
        salary_expect_min: profile.salary_expect?.min ? Math.round(Number(profile.salary_expect.min)) : 0,
        salary_expect_max: profile.salary_expect?.max ? Math.round(Number(profile.salary_expect.max)) : 0,
        salary_currency: profile.salary_expect?.currency || 'SGD'
      })
      
      const { error: basicsError } = await supabaseClient
        .from('candidate_basics')
        .insert({
          user_id: userId,
          resume_id: resumeId,
          work_auth: profile.work_auth || { citizen_or_pr: false, ep_needed: true, work_permit_type: null },
          seniority_level: profile.seniority_level || 'Not specified',
          current_title: profile.current_title || 'Not specified',
          target_titles: profile.target_titles || [],
          industries: profile.industries || [],
          company_tiers: profile.company_tiers || [],
          salary_expect_min: profile.salary_expect?.min ? Math.round(Number(profile.salary_expect.min)) : 0,
          salary_expect_max: profile.salary_expect?.max ? Math.round(Number(profile.salary_expect.max)) : 0,
          salary_currency: profile.salary_expect?.currency || 'SGD',
          work_prefs: profile.work_prefs || { remote: 'Not specified', job_type: 'Not specified' },
          intent: profile.intent || { target_industries: [], must_have: [], nice_to_have: [], blacklist_companies: [] },
          leadership_level: profile.leadership_level || 'IC',
          has_management: profile.management_experience?.has_management || false,
          direct_reports_count: Math.round(Number(profile.management_experience?.direct_reports_count) || 0),
          team_size_range: profile.management_experience?.team_size_range || null,
          management_years: Math.round(Number(profile.management_experience?.management_years) || 0),
          management_evidence: profile.management_experience?.management_evidence || [],
          profile_version: 2,
          extraction_meta: {
            method: 'LLM+enhanced',
            timestamp: new Date().toISOString()
          }
        })

      if (basicsError) {
        console.error('[EnhancedProfile] Basics save failed:', basicsError)
        throw new Error(`Failed to save basics: ${basicsError.message}`)
      }
      counts.basics = 1
      
      console.log('[EnhancedProfile] Basics save successful, verifying data...')
      
      // Verify the data was saved correctly
      const { data: verifyData, error: verifyError } = await supabaseClient
        .from('candidate_basics')
        .select('salary_expect_min, salary_expect_max, salary_currency')
        .eq('user_id', userId)
        .eq('resume_id', resumeId)
        .order('created_at', { ascending: false })
        .limit(1)
        
      if (verifyError) {
        console.error('[EnhancedProfile] Verify query failed:', verifyError)
      } else {
        console.log('[EnhancedProfile] Verified saved data:', verifyData?.[0])
      }

      // 2. Save skills with levels
      if (profile.skills && profile.skills.length > 0) {
        const skillsData = profile.skills.map(skill => ({
          user_id: userId,
          resume_id: resumeId,
          name: skill.name,
          level: skill.level,
          last_used: skill.last_used ? new Date(skill.last_used + '-01') : null,
          evidence: skill.evidence,
          skill_category: this.categorizeSkill(skill.name)
        }))

        // Clear existing skills first, then insert new ones
        await supabaseClient
          .from('candidate_skills')
          .delete()
          .eq('user_id', userId)
          .eq('resume_id', resumeId)

        const { error: skillsError } = await supabaseClient
          .from('candidate_skills')
          .insert(skillsData)

        if (skillsError) {
          console.error('[EnhancedProfile] Skills save failed:', skillsError)
        } else {
          counts.skills = skillsData.length
        }
      }

      // 3. Save education
      if (profile.education && profile.education.length > 0) {
        const educationData = profile.education.map(edu => ({
          user_id: userId,
          resume_id: resumeId,
          study_type: edu.degree,
          area: edu.major,
          institution: edu.institution,
          end_date: edu.grad_year ? new Date(edu.grad_year, 11, 31) : null
        }))

        // Clear existing education first, then insert new ones
        await supabaseClient
          .from('candidate_education')
          .delete()
          .eq('user_id', userId)
          .eq('resume_id', resumeId)

        const { error: educationError } = await supabaseClient
          .from('candidate_education')
          .insert(educationData)

        if (educationError) {
          console.error('[EnhancedProfile] Education save failed:', educationError)
        } else {
          counts.education = educationData.length
        }
      }

      // 4. Save certifications
      if (profile.certifications && profile.certifications.length > 0) {
        const certData = profile.certifications.map(cert => ({
          user_id: userId,
          resume_id: resumeId,
          name: cert,
          issuer: null, // Will be extracted later if needed
          date: null
        }))

        const { error: certError } = await supabaseClient
          .from('candidate_certificates')
          .upsert(certData, { onConflict: 'user_id,name' })

        if (certError) {
          console.error('[EnhancedProfile] Certificates save failed:', certError)
        } else {
          counts.certificates = certData.length
        }
      }

      // 5. Update existing work experience with enhanced data
      if (profile.company_tiers && profile.company_tiers.length > 0) {
        // This would require matching existing work entries with companies
        // For now, we'll just log that we have company tier information
        console.debug('[EnhancedProfile] Company tiers available:', profile.company_tiers)
      }

      console.debug('[EnhancedProfile] saveEnhancedProfile done', counts)
      return { success: true, counts }
    } catch (error) {
      console.error('[EnhancedProfile] saveEnhancedProfile failed:', error)
      throw error
    }
  }

  /**
   * Categorize skill into skill category
   */
  private static categorizeSkill(skillName: string): string {
    const skill = skillName.toLowerCase()
    
    if (['python', 'javascript', 'java', 'c++', 'go', 'rust', 'swift', 'kotlin', 'php', 'ruby', 'scala'].includes(skill)) {
      return 'Programming Language'
    }
    if (['react', 'vue', 'angular', 'node.js', 'django', 'flask', 'spring', 'laravel'].includes(skill)) {
      return 'Framework'
    }
    if (['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch'].includes(skill)) {
      return 'Database'
    }
    if (['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform'].includes(skill)) {
      return 'DevOps/Cloud'
    }
    if (['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'llm', 'nlp', 'computer vision'].includes(skill)) {
      return 'AI/ML'
    }
    if (['pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'tableau', 'power bi'].includes(skill)) {
      return 'Data Analysis'
    }
    
    return 'Other'
  }

  /**
   * Get enhanced candidate profile from database
   */
  static async getEnhancedProfile(userId: string): Promise<EnhancedCandidateProfile | null> {
    try {
      const supabaseClient = supabaseAdmin()
      
      // Get basics (handle duplicates by taking the most recent one)
      const { data: basicsData, error: basicsError } = await supabaseClient
        .from('candidate_basics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      console.log('[EnhancedProfile] Query details:', {
        userId,
        queryResult: basicsData?.length || 0,
        latestRecord: basicsData?.[0] ? {
          resume_id: basicsData[0].resume_id,
          salary_expect_min: basicsData[0].salary_expect_min,
          salary_expect_max: basicsData[0].salary_expect_max,
          salary_currency: basicsData[0].salary_currency,
          created_at: basicsData[0].created_at
        } : null
      })

      if (basicsError || !basicsData || basicsData.length === 0) {
        console.error('[EnhancedProfile] Failed to get basics:', basicsError)
        return null
      }

      const basics = basicsData[0]

      // Get skills
      const { data: skills } = await supabaseClient
        .from('candidate_skills')
        .select('*')
        .eq('user_id', userId)

      // Get education
      const { data: education } = await supabaseClient
        .from('candidate_education')
        .select('*')
        .eq('user_id', userId)

      // Get certificates
      const { data: certificates } = await supabaseClient
        .from('candidate_certificates')
        .select('*')
        .eq('user_id', userId)

      // Get work experience
      const { data: work } = await supabaseClient
        .from('candidate_work')
        .select('*')
        .eq('user_id', userId)

      // Calculate experience years
      let experienceYears = 0
      if (work && work.length > 0) {
        const sortedWork = work.sort((a, b) => 
          new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime()
        )
        
        const earliest = sortedWork[0]
        const latest = sortedWork[sortedWork.length - 1]
        
        if (earliest.start_date) {
          const startDate = new Date(earliest.start_date)
          const endDate = latest.end_date ? new Date(latest.end_date) : new Date()
          experienceYears = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365))
        }
      }

      return {
        work_auth: basics.work_auth || { citizen_or_pr: true, ep_needed: false, work_permit_type: null },
        seniority_level: basics.seniority_level || 'Mid',
        current_title: basics.current_title || '',
        target_titles: basics.target_titles || [],
        experience_years: Math.max(experienceYears, basics.experience_years || 0),
        skills: (skills || []).map(s => ({
          name: s.name,
          level: s.level || 3,
          last_used: s.last_used ? s.last_used.toISOString().substring(0, 7) : null,
          evidence: s.evidence
        })),
        education: (education || []).map(e => ({
          degree: e.study_type || '',
          major: e.area || '',
          institution: e.institution || '',
          grad_year: e.end_date ? new Date(e.end_date).getFullYear() : null
        })),
        certifications: (certificates || []).map(c => c.name),
        industries: basics.industries || [],
        company_tiers: basics.company_tiers || [],
        salary_expect: (() => {
          console.log('[EnhancedProfile] Salary data from DB:', {
            salary_expect_min: basics.salary_expect_min,
            salary_expect_max: basics.salary_expect_max,
            salary_currency: basics.salary_currency
          })
          return {
            min: basics.salary_expect_min || 3000,
            max: basics.salary_expect_max || 6000,
            currency: basics.salary_currency || 'SGD'
          }
        })(),
        work_prefs: basics.work_prefs || { remote: 'Hybrid', job_type: 'Permanent' },
        intent: basics.intent || {
          target_industries: [],
          must_have: [],
          nice_to_have: [],
          blacklist_companies: []
        },
        leadership_level: basics.leadership_level || 'IC',
        management_experience: {
          has_management: basics.has_management || false,
          direct_reports_count: basics.direct_reports_count || 0,
          team_size_range: basics.team_size_range || null,
          management_years: basics.management_years || 0,
          management_evidence: basics.management_evidence || []
        }
      }
    } catch (error) {
      console.error('[EnhancedProfile] getEnhancedProfile failed:', error)
      return null
    }
  }
}

// Export singleton instance
export const enhancedCandidateProfileService = new EnhancedCandidateProfileService()
