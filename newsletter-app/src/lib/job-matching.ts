// Enhanced Job Matching Service
import { supabase } from './supabase'
import { EnhancedCandidateProfileService } from './enhanced-candidate-profile'
import { LLMActionSuggestionsService } from './llm-action-suggestions'
import type { Database } from './database.types'

type JobRow = Database['public']['Tables']['jobs']['Row']

export type CandidateJob = JobRow & {
  skills_required?: Array<{ name: string; level: number }>
  skills_optional?: string[]
  job_family?: string
  experience_years_req?: ExperienceRequirement | null
  education_req?: string[]
  certifications_req?: string[]
  remote_policy?: string
  company_tier?: string
  visa_requirement?: VisaRequirement | null
  leadership_level?: 'IC' | 'Team Lead' | 'Team Lead++' | null
}

interface VisaRequirement {
  local_only?: boolean
  ep_ok?: boolean
}

interface ExperienceRequirement {
  min: number
  max: number
}

export interface JobRecommendation {
  job: CandidateJob
  match_score: number
  match_reasons: string[]
  breakdown: RecommendationBreakdown
  why_match: MatchNarrative
  gaps_and_actions: GapAnalysis
  personalized_suggestions?: ReturnType<typeof LLMActionSuggestionsService.generateActionSuggestions> extends Promise<infer R> ? R : unknown
}
export interface RecommendationBreakdown {
  title_match: number
  salary_match: number
  skills_match: number
  experience_match: number
  education_match: number
  certification_match: number
  job_family_match: number
  work_prefs_match: number
  industry_match: number
  leadership_match: number
}

export interface MatchNarrative {
  strengths: string[]
  concerns: string[]
  overall_assessment: string
}

export interface GapAnalysis {
  skill_gaps: Array<{ skill: string; current_level: number; required_level: number; action: string }>
  experience_gap?: { gap_years: number; action: string }
  education_gaps: Array<{ requirement: string; action: string }>
  certification_gaps: Array<{ requirement: string; action: string }>
  interview_prep: string[]
}

export interface CandidateProfile {
  titles: string[]
  skills: Array<{ name: string; level: number }>
  experience_years: number
  salary_range_min?: number
  salary_range_max?: number
  industries: string[]
  education_level?: string
  education?: Array<{
    study_type?: string
    degree?: string
    area?: string
    major?: string
    institution?: string
  }>
  certifications?: Array<{
    name: string
    issuer: string
  }>
  company_tiers?: string[]
  work_auth?: {
    citizen_or_pr: boolean
    ep_needed: boolean
    work_permit_type?: string
  }
  blacklist_companies?: string[]
  work_prefs?: {
    remote: 'Onsite' | 'Hybrid' | 'Remote'
    job_type: 'Permanent' | 'Contract' | 'Freelance'
  }
  leadership_level?: 'IC' | 'Team Lead' | 'Team Lead++'
  management_experience?: {
    has_management: boolean
    direct_reports_count: number
    team_size_range?: string
    management_years: number
    management_evidence: string[]
  }
}

// Seniority and organizational keywords to filter out for better core function matching
const SENIORITY_KEYWORDS = new Set([
  'senior', 'junior', 'lead', 'principal', 'staff', 'chief', 'head', 'director',
  'manager', 'associate', 'assistant', 'coordinator', 'specialist', 'analyst',
  'consultant', 'advisor', 'expert', 'executive', 'officer', 'representative',
  'supervisor', 'team', 'group', 'department', 'division', 'unit', 'section',
  'level', 'grade', 'tier', 'rank', 'position', 'role', 'title', 'job',
  'sr', 'jr', 'snr', 'jrn', 'mgr', 'dir', 'exec', 'admin', 'coord', 'spec',
  'anal', 'cons', 'adv', 'rep', 'sup', 'dept', 'div', 'sect', 'lvl', 'gr', 'pos'
])

function normalizeTitle(title: string): string[] {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => 
      Boolean(token) && 
      token.length > 1 && 
      !SENIORITY_KEYWORDS.has(token)
    )
}

function tokenOverlapScore(a: string, b: string): { score: number; tokens: string[] } {
  const ta = new Set(normalizeTitle(a))
  const tb = new Set(normalizeTitle(b))
  if (ta.size === 0 || tb.size === 0) return { score: 0, tokens: [] }
  const inter: string[] = []
  for (const tok of ta) if (tb.has(tok)) inter.push(tok)
  const union = new Set([...ta, ...tb]).size
  const jaccard = inter.length / union
  return { score: Math.round(jaccard * 100), tokens: inter }
}

function calculateSalaryMatch(
  candidateMin: number | undefined,
  candidateMax: number | undefined,
  jobMin: number,
  jobMax: number,
  jobCurrency: string = 'SGD'
): { score: number; reason: string; overlap_ratio: number; gap_amount: number } {
  if (!candidateMin || !candidateMax) {
    return { score: 50, reason: 'No salary preference specified', overlap_ratio: 0, gap_amount: 0 }
  }

  // Convert job salary to SGD if needed (assuming candidate salary is in SGD)
  let adjustedJobMin = jobMin
  let adjustedJobMax = jobMax
  
  if (jobCurrency !== 'SGD') {
    // Simple conversion rates (in production, use real-time rates)
    const conversionRates: { [key: string]: number } = {
      'USD': 1.35,
      'EUR': 1.45,
      'GBP': 1.70,
      'HKD': 0.17,
      'JPY': 0.009,
      'CNY': 0.18
    }
    
    const rate = conversionRates[jobCurrency] || 1
    adjustedJobMin = jobMin * rate
    adjustedJobMax = jobMax * rate
  }

  const candidateMid = (candidateMin + candidateMax) / 2
  const jobMid = (adjustedJobMin + adjustedJobMax) / 2
  const candidateRange = candidateMax - candidateMin
  
  // Perfect match: job range overlaps with candidate range
  if (adjustedJobMin <= candidateMax && adjustedJobMax >= candidateMin) {
    const overlap = Math.min(adjustedJobMax, candidateMax) - Math.max(adjustedJobMin, candidateMin)
    const totalRange = Math.max(adjustedJobMax, candidateMax) - Math.min(adjustedJobMin, candidateMin)
    const overlapRatio = overlap / totalRange
    
    // Bonus for exact mid-point alignment
    const midPointAlignment = 1 - Math.abs(candidateMid - jobMid) / Math.max(candidateMid, jobMid)
    const alignmentBonus = Math.max(0, midPointAlignment * 10)
    
    return { 
      score: Math.round(60 + (overlapRatio * 30) + alignmentBonus), 
      reason: `Salary overlap: $${Math.round(adjustedJobMin)}-$${Math.round(adjustedJobMax)} vs $${Math.round(candidateMin)}-$${Math.round(candidateMax)} (${Math.round(overlapRatio * 100)}% overlap)`,
      overlap_ratio: overlapRatio,
      gap_amount: 0
    }
  }
  
  // Job is higher than candidate range
  if (adjustedJobMin > candidateMax) {
    const gap = adjustedJobMin - candidateMax
    const gapRatio = gap / candidateRange
    
    let score = 0
    let reason = ''
    
    if (gapRatio <= 0.1) {
      score = 45
      reason = `Job slightly above range (+$${Math.round(gap)})`
    } else if (gapRatio <= 0.2) {
      score = 35
      reason = `Job moderately above range (+$${Math.round(gap)})`
    } else if (gapRatio <= 0.5) {
      score = 20
      reason = `Job significantly above range (+$${Math.round(gap)})`
    } else {
      score = 5
      reason = `Job far above range (+$${Math.round(gap)})`
    }
    
    return { score, reason, overlap_ratio: 0, gap_amount: gap }
  }
  
  // Job is lower than candidate range
  if (adjustedJobMax < candidateMin) {
    const gap = candidateMin - adjustedJobMax
    const gapRatio = gap / candidateRange
    
    let score = 0
    let reason = ''
    
    if (gapRatio <= 0.1) {
      score = 40
      reason = `Job slightly below range (-$${Math.round(gap)})`
    } else if (gapRatio <= 0.2) {
      score = 30
      reason = `Job moderately below range (-$${Math.round(gap)})`
    } else if (gapRatio <= 0.5) {
      score = 15
      reason = `Job significantly below range (-$${Math.round(gap)})`
    } else {
      score = 0
      reason = `Job far below range (-$${Math.round(gap)})`
    }
    
    return { score, reason, overlap_ratio: 0, gap_amount: gap }
  }
  
  return { score: 50, reason: 'Salary range unclear', overlap_ratio: 0, gap_amount: 0 }
}

function calculateSkillsMatch(
  candidateSkills: Array<{ name: string; level: number }>, 
  jobRequiredSkills: Array<{ name: string; level: number }>,
  jobOptionalSkills: string[],
  jobDescription: string
): { score: number; matched_skills: string[]; missing_skills: string[]; skill_gaps: string[] } {
  if (!candidateSkills.length) {
    return { score: 0, matched_skills: [], missing_skills: jobRequiredSkills.map(s => s.name), skill_gaps: [] }
  }

  const matchedSkills: string[] = []
  const missingSkills: string[] = []
  const skillGaps: string[] = []
  
  // Create candidate skills map for quick lookup
  const candidateSkillsMap = new Map<string, number>()
  candidateSkills.forEach(skill => {
    const skillName = (skill?.name || '').toString().trim()
    if (!skillName) return
    const norm = skillName.toLowerCase()
    const level = typeof skill?.level === 'number' ? skill.level : 3
    candidateSkillsMap.set(norm, level)
  })

  // Check required skills
  let requiredSkillsScore = 0
  for (const requiredSkill of jobRequiredSkills) {
    const skillName = requiredSkill.name.toLowerCase()
    const candidateLevel = candidateSkillsMap.get(skillName)
    
    if (candidateLevel !== undefined) {
      matchedSkills.push(requiredSkill.name)
      
      // Calculate level match score
      if (candidateLevel >= requiredSkill.level) {
        requiredSkillsScore += 100 // Perfect match
      } else {
        const gap = requiredSkill.level - candidateLevel
        requiredSkillsScore += Math.max(0, 100 - (gap * 20)) // Penalty for level gap
        skillGaps.push(`${requiredSkill.name}: need level ${requiredSkill.level}, have level ${candidateLevel}`)
      }
    } else {
      missingSkills.push(requiredSkill.name)
    }
  }

  // Check optional skills (bonus points)
  let optionalSkillsScore = 0
  for (const optionalSkill of jobOptionalSkills) {
    const skillName = optionalSkill.toLowerCase()
    if (candidateSkillsMap.has(skillName)) {
      matchedSkills.push(optionalSkill)
      optionalSkillsScore += 20 // Bonus for optional skills
    }
  }

  // Fallback to description matching if no structured skills
  if (jobRequiredSkills.length === 0 && jobOptionalSkills.length === 0 && jobDescription) {
    const jobText = jobDescription.toLowerCase()
    let descriptionMatches = 0
    
    for (const skill of candidateSkills) {
      if (!skill.name) continue // Skip skills with null/undefined names
      const skillLower = skill.name.toLowerCase()
      if (jobText.includes(skillLower) || 
          jobText.includes(skillLower.replace(/\s+/g, '')) ||
          skillLower.split(' ').some(word => jobText.includes(word))) {
        matchedSkills.push(skill.name)
        descriptionMatches++
      }
    }
    
    const descriptionScore = Math.round((descriptionMatches / candidateSkills.length) * 100)
    return { score: descriptionScore, matched_skills: matchedSkills, missing_skills: [], skill_gaps: [] }
  }

  // Calculate final score
  const requiredScore = jobRequiredSkills.length > 0 ? requiredSkillsScore / jobRequiredSkills.length : 0
  const totalScore = Math.round(requiredScore + optionalSkillsScore)
  
  return { 
    score: Math.min(totalScore, 100), 
    matched_skills: [...new Set(matchedSkills)], 
    missing_skills: missingSkills, 
    skill_gaps: skillGaps 
  }
}

interface ExperienceRequirement {
  min: number
  max: number
}

interface ExperienceMatchResult {
  score: number
  reason: string
  penalty: number
}

function calculateExperienceMatch(
  candidateYears: number,
  jobExperienceReq: ExperienceRequirement | null,
  jobLevel: string
): ExperienceMatchResult {
  // Use structured experience requirements if available
  if (jobExperienceReq && jobExperienceReq.min !== undefined && jobExperienceReq.max !== undefined) {
    const { min, max } = jobExperienceReq
    
    if (candidateYears >= min && candidateYears <= max) {
      return { score: 100, reason: `Perfect experience match: ${candidateYears} years (${min}-${max} required)`, penalty: 0 }
    }
    
    if (candidateYears < min) {
      const gap = min - candidateYears
      const penalty = Math.min(gap * 15, 50) // Max 50 point penalty
      const score = Math.max(100 - penalty, 20)
      return { 
        score, 
        reason: `Underqualified: ${candidateYears} years vs ${min}-${max} required (${gap} years short)`, 
        penalty 
      }
    }
    
    if (candidateYears > max) {
      const excess = candidateYears - max
      const penalty = Math.min(excess * 10, 40) // Max 40 point penalty for overqualification
      const score = Math.max(100 - penalty, 30)
      return { 
        score, 
        reason: `Overqualified: ${candidateYears} years vs ${min}-${max} required (${excess} years excess)`, 
        penalty 
      }
    }
  }
  
  // Fallback to job level matching
  if (!jobLevel) {
    return { score: 50, reason: 'Experience requirements not specified', penalty: 0 }
  }
  
  const level = jobLevel.toLowerCase()
  
  if (level.includes('entry') || level.includes('junior') || level.includes('graduate')) {
    if (candidateYears <= 2) return { score: 100, reason: 'Perfect match for entry level', penalty: 0 }
    if (candidateYears <= 4) return { score: 70, reason: 'Slightly overqualified for entry level', penalty: 30 }
    return { score: 30, reason: 'Overqualified for entry level', penalty: 70 }
  }
  
  if (level.includes('senior') || level.includes('lead')) {
    if (candidateYears >= 5) return { score: 100, reason: 'Perfect match for senior level', penalty: 0 }
    if (candidateYears >= 3) return { score: 80, reason: 'Good match for senior level', penalty: 20 }
    if (candidateYears >= 1) return { score: 50, reason: 'May need more experience for senior level', penalty: 50 }
    return { score: 20, reason: 'Underqualified for senior level', penalty: 80 }
  }
  
  if (level.includes('manager') || level.includes('director')) {
    if (candidateYears >= 7) return { score: 100, reason: 'Perfect match for management level', penalty: 0 }
    if (candidateYears >= 5) return { score: 80, reason: 'Good match for management level', penalty: 20 }
    if (candidateYears >= 3) return { score: 50, reason: 'May need more experience for management', penalty: 50 }
    return { score: 20, reason: 'Underqualified for management level', penalty: 80 }
  }
  
  if (level.includes('executive') || level.includes('vp') || level.includes('c-level')) {
    if (candidateYears >= 10) return { score: 100, reason: 'Perfect match for executive level', penalty: 0 }
    if (candidateYears >= 7) return { score: 80, reason: 'Good match for executive level', penalty: 20 }
    if (candidateYears >= 5) return { score: 50, reason: 'May need more experience for executive level', penalty: 50 }
    return { score: 20, reason: 'Underqualified for executive level', penalty: 80 }
  }
  
  return { score: 50, reason: 'Experience level unclear', penalty: 0 }
}

interface EducationEntry {
  study_type?: string
  degree?: string
  area?: string
  major?: string
  institution?: string
}

interface EducationMatchResult {
  score: number
  reason: string
  matched_education: string[]
}

interface CertificationMatchResult {
  score: number
  reason: string
  matched_certifications: string[]
}

function calculateEducationMatch(
  candidateEducation: EducationEntry[],
  jobEducationReq: string[]
): EducationMatchResult {
  if (!jobEducationReq || jobEducationReq.length === 0) {
    return { score: 100, reason: 'No education requirements specified', matched_education: [] }
  }

  if (!candidateEducation || candidateEducation.length === 0) {
    return { score: 0, reason: 'No education information available', matched_education: [] }
  }

  const matchedEducation: string[] = []
  let totalScore = 0

  for (const requirement of jobEducationReq) {
    const reqLower = requirement.toLowerCase()
    let bestMatch = { score: 0, education: '' }

    for (const education of candidateEducation) {
      const studyType = (education.study_type || '').toLowerCase()
      const area = (education.area || '').toLowerCase()
      const institution = (education.institution || '').toLowerCase()

      // Check for exact match
      if (studyType.includes(reqLower) || reqLower.includes(studyType)) {
        bestMatch = { score: 100, education: `${education.study_type || education.degree} in ${education.area || education.major}` }
        break
      }

      // Check for area match
      if (area.includes(reqLower) || reqLower.includes(area)) {
        bestMatch = { score: 80, education: `${education.study_type || education.degree} in ${education.area || education.major}` }
      }

      // Check for institution match (lower weight)
      if (institution.includes(reqLower) || reqLower.includes(institution)) {
        if (bestMatch.score < 60) {
          bestMatch = { score: 60, education: `${education.study_type || education.degree} from ${education.institution}` }
        }
      }
    }

    if (bestMatch.score > 0) {
      matchedEducation.push(bestMatch.education)
      totalScore += bestMatch.score
    }
  }

  const averageScore = jobEducationReq.length > 0 ? totalScore / jobEducationReq.length : 0
  const reason = matchedEducation.length > 0 
    ? `Education match: ${matchedEducation.join(', ')}`
    : 'No education requirements met'

  return {
    score: Math.round(averageScore),
    reason,
    matched_education: matchedEducation
  }
}

function calculateCertificationMatch(
  candidateCertifications: Array<{ name: string; issuer?: string }>,
  jobCertificationReq: string[]
): { score: number; reason: string; matched_certifications: string[] } {
  if (!jobCertificationReq || jobCertificationReq.length === 0) {
    return { score: 100, reason: 'No certification requirements specified', matched_certifications: [] }
  }

  if (!candidateCertifications || candidateCertifications.length === 0) {
    return { score: 0, reason: 'No certifications available', matched_certifications: [] }
  }

  const matchedCertifications: string[] = []
  let totalScore = 0

  for (const requirement of jobCertificationReq) {
    const reqLower = requirement.toLowerCase()
    let bestMatch = { score: 0, certification: '' }

    for (const cert of candidateCertifications) {
      const certName = (cert.name || '').toLowerCase()
      const issuer = (cert.issuer || '').toLowerCase()

      // Check for exact match
      if (certName.includes(reqLower) || reqLower.includes(certName)) {
        bestMatch = { score: 100, certification: cert.name }
        break
      }

      // Check for issuer match (lower weight)
      if (issuer.includes(reqLower) || reqLower.includes(issuer)) {
        if (bestMatch.score < 70) {
          bestMatch = { score: 70, certification: `${cert.name} (${cert.issuer})` }
        }
      }
    }

    if (bestMatch.score > 0) {
      matchedCertifications.push(bestMatch.certification)
      totalScore += bestMatch.score
    }
  }

  const averageScore = jobCertificationReq.length > 0 ? totalScore / jobCertificationReq.length : 0
  const reason = matchedCertifications.length > 0 
    ? `Certifications match: ${matchedCertifications.join(', ')}`
    : 'No certification requirements met'

  return { 
    score: Math.round(averageScore), 
    reason, 
    matched_certifications: matchedCertifications 
  }
}

function calculateJobFamilyMatch(
  candidateTitles: string[],
  jobFamily: string,
  jobTitle: string
): { score: number; reason: string } {
  if (!jobFamily && !jobTitle) {
    return { score: 50, reason: 'Job family not specified' }
  }

  const jobFamilyLower = (jobFamily || '').toLowerCase()
  const jobTitleLower = (jobTitle || '').toLowerCase()
  
  // Define job family mappings
  const jobFamilyMappings: { [key: string]: string[] } = {
    'software_engineering': ['software', 'developer', 'engineer', 'programmer', 'coding', 'development'],
    'data_science': ['data', 'analyst', 'scientist', 'machine learning', 'ai', 'analytics'],
    'product_management': ['product', 'manager', 'pm', 'strategy', 'roadmap'],
    'marketing': ['marketing', 'growth', 'digital', 'content', 'social media'],
    'sales': ['sales', 'business development', 'account', 'revenue'],
    'finance': ['finance', 'accounting', 'financial', 'treasury', 'audit'],
    'hr': ['human resources', 'hr', 'talent', 'recruitment', 'people'],
    'operations': ['operations', 'ops', 'process', 'efficiency', 'logistics'],
    'design': ['design', 'ux', 'ui', 'user experience', 'creative'],
    'consulting': ['consultant', 'advisory', 'strategy', 'management consulting']
  }

  let bestMatch = { score: 0, reason: '' }

  for (const title of candidateTitles) {
    const titleLower = title.toLowerCase()
    
    // Check direct job family match
    if (jobFamilyLower && jobFamilyMappings[jobFamilyLower]) {
      const familyKeywords = jobFamilyMappings[jobFamilyLower]
      for (const keyword of familyKeywords) {
        if (titleLower.includes(keyword)) {
          bestMatch = { score: 100, reason: `Job family match: ${title} → ${jobFamily}` }
          break
        }
      }
    }

    // Check job title similarity
    if (jobTitleLower) {
      const titleTokens = titleLower.split(/\s+/)
      const jobTokens = jobTitleLower.split(/\s+/)
      const commonTokens = titleTokens.filter(token => jobTokens.includes(token))
      
      if (commonTokens.length > 0) {
        const similarity = commonTokens.length / Math.max(titleTokens.length, jobTokens.length)
        if (similarity > 0.3 && similarity * 100 > bestMatch.score) {
          bestMatch = { 
            score: Math.round(similarity * 100), 
            reason: `Title similarity: ${title} → ${jobTitle} (${commonTokens.join(', ')})` 
          }
        }
      }
    }
  }

  if (bestMatch.score === 0) {
    return { score: 30, reason: 'No job family alignment' }
  }

  return bestMatch
}

function calculateIndustryMatch(
  candidateIndustries: string[], 
  jobIndustry: string,
  candidateCompanyTiers: string[] = [],
  jobCompanyTier: string = ''
): { score: number; reason: string } {
  if (!candidateIndustries.length && !candidateCompanyTiers.length) {
    return { score: 50, reason: 'No industry information available' }
  }
  
  if (!jobIndustry && !jobCompanyTier) {
    return { score: 50, reason: 'Job industry not specified' }
  }

  const jobIndustryLower = (jobIndustry || '').toLowerCase()
  const jobTierLower = (jobCompanyTier || '').toLowerCase()
  
  let bestMatch = { score: 0, reason: '' }

  // Check industry match
  for (const industry of candidateIndustries) {
    const industryLower = industry.toLowerCase()
    
    if (jobIndustryLower.includes(industryLower) || 
        industryLower.includes(jobIndustryLower)) {
      bestMatch = { score: 100, reason: `Industry match: ${industry}` }
      break
    }
  }

  // Check company tier alignment (bonus points)
  if (candidateCompanyTiers.length > 0 && jobTierLower) {
    for (const tier of candidateCompanyTiers) {
      if (tier.toLowerCase() === jobTierLower) {
        const tierBonus = 20
        if (bestMatch.score + tierBonus > bestMatch.score) {
          bestMatch = { 
            score: Math.min(bestMatch.score + tierBonus, 100), 
            reason: bestMatch.reason ? `${bestMatch.reason} + Company tier match` : `Company tier match: ${tier}` 
          }
        }
        break
      }
    }
  }

  // Industry similarity scoring
  if (bestMatch.score === 0) {
    const industrySimilarity = calculateIndustrySimilarity(candidateIndustries, jobIndustry)
    if (industrySimilarity > 0) {
      bestMatch = { 
        score: Math.round(industrySimilarity * 60), 
        reason: `Related industry: ${jobIndustry}` 
      }
    }
  }

  if (bestMatch.score === 0) {
    return { score: 30, reason: 'Different industry' }
  }

  return bestMatch
}

function calculateIndustrySimilarity(candidateIndustries: string[], jobIndustry: string): number {
  // Define industry similarity groups
  const industryGroups: { [key: string]: string[] } = {
    'technology': ['software', 'tech', 'it', 'digital', 'ai', 'data', 'cybersecurity'],
    'finance': ['banking', 'financial services', 'fintech', 'insurance', 'investment'],
    'healthcare': ['medical', 'pharmaceutical', 'biotech', 'health', 'clinical'],
    'retail': ['e-commerce', 'consumer goods', 'fashion', 'retail', 'shopping'],
    'manufacturing': ['industrial', 'automotive', 'aerospace', 'engineering', 'production'],
    'consulting': ['professional services', 'management consulting', 'advisory', 'strategy'],
    'education': ['edtech', 'training', 'academic', 'learning', 'university'],
    'media': ['entertainment', 'publishing', 'advertising', 'marketing', 'content']
  }

  const jobIndustryLower = jobIndustry.toLowerCase()
  
  for (const group in industryGroups) {
    const groupKeywords = industryGroups[group]
    const jobInGroup = groupKeywords.some(keyword => jobIndustryLower.includes(keyword))
    
    if (jobInGroup) {
      for (const candidateIndustry of candidateIndustries) {
        const candidateLower = candidateIndustry.toLowerCase()
        const candidateInGroup = groupKeywords.some(keyword => candidateLower.includes(keyword))
        
        if (candidateInGroup) {
          return 0.7 // 70% similarity for same industry group
        }
      }
    }
  }

  return 0
}

function calculateWorkPrefsMatch(
  candidatePrefs: { remote: 'Onsite' | 'Hybrid' | 'Remote'; job_type: 'Permanent' | 'Contract' | 'Freelance' } | undefined,
  jobRemotePolicy: string,
  jobType: string
): { score: number; reason: string } {
  if (!candidatePrefs) {
    return { score: 50, reason: 'Work preferences not specified' }
  }

  if (!jobRemotePolicy && !jobType) {
    return { score: 50, reason: 'Job work preferences not specified' }
  }

  let score = 0
  const reasons: string[] = []

  // Remote policy matching
  if (jobRemotePolicy) {
    const jobRemote = jobRemotePolicy.toLowerCase()
    const candidateRemote = candidatePrefs.remote.toLowerCase()

    if (candidateRemote === jobRemote) {
      score += 50
      reasons.push(`Remote policy match: ${candidatePrefs.remote}`)
    } else if (candidateRemote === 'hybrid' && (jobRemote === 'onsite' || jobRemote === 'remote')) {
      score += 30
      reasons.push(`Hybrid candidate can adapt to ${jobRemote}`)
    } else if (candidateRemote === 'remote' && jobRemote === 'hybrid') {
      score += 40
      reasons.push(`Remote candidate can work hybrid`)
    } else if (candidateRemote === 'onsite' && jobRemote === 'hybrid') {
      score += 40
      reasons.push(`Onsite candidate can work hybrid`)
    } else {
      score += 10
      reasons.push(`Remote policy mismatch: ${candidatePrefs.remote} vs ${jobRemotePolicy}`)
    }
  }

  // Job type matching
  if (jobType) {
    const jobTypeLower = jobType.toLowerCase()
    const candidateJobType = candidatePrefs.job_type.toLowerCase()

    if (candidateJobType === jobTypeLower) {
      score += 50
      reasons.push(`Job type match: ${candidatePrefs.job_type}`)
    } else if (candidateJobType === 'permanent' && jobTypeLower === 'contract') {
      score += 20
      reasons.push(`Permanent candidate considering contract`)
    } else if (candidateJobType === 'contract' && jobTypeLower === 'permanent') {
      score += 30
      reasons.push(`Contract candidate open to permanent`)
    } else {
      score += 10
      reasons.push(`Job type mismatch: ${candidatePrefs.job_type} vs ${jobType}`)
    }
  }

  const finalScore = Math.min(score, 100)
  const reason = reasons.length > 0 ? reasons.join(', ') : 'Work preferences unclear'

  return { score: finalScore, reason }
}

// Explanation and action generation functions
function generateWhyMatch(
  candidateProfile: CandidateProfile,
  job: CandidateJob,
  breakdown: RecommendationBreakdown,
  skillsMatch: SkillsMatchResult,
  experienceMatch: ExperienceMatchResult
): MatchNarrative {
  const strengths: string[] = []
  const concerns: string[] = []

  // Analyze strengths
  if (breakdown.title_match >= 70) {
    strengths.push(`Strong title alignment (${breakdown.title_match}%)`)
  }
  if (breakdown.skills_match >= 70) {
    strengths.push(`Excellent skills match (${breakdown.skills_match}%)`)
  }
  if (breakdown.salary_match >= 70) {
    strengths.push(`Salary expectations aligned (${breakdown.salary_match}%)`)
  }
  if (breakdown.experience_match >= 80) {
    strengths.push(`Perfect experience level match (${breakdown.experience_match}%)`)
  }
  if (breakdown.job_family_match >= 80) {
    strengths.push(`Strong job family alignment (${breakdown.job_family_match}%)`)
  }

  // Analyze concerns
  if (breakdown.skills_match < 50) {
    concerns.push(`Skills gap: ${skillsMatch.missing_skills?.length || 0} required skills missing`)
  }
  if (breakdown.experience_match < 50) {
    concerns.push(`Experience mismatch: ${experienceMatch.reason}`)
  }
  if (breakdown.salary_match < 50) {
    concerns.push(`Salary expectations not aligned`)
  }
  if (breakdown.education_match < 50 && job.education_req?.length > 0) {
    concerns.push('Education requirements not fully met')
  }

  // Overall assessment
  let overallAssessment = ''
  const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0) / Object.keys(breakdown).length
  
  if (totalScore >= 80) {
    overallAssessment = 'Excellent match with strong alignment across all criteria'
  } else if (totalScore >= 65) {
    overallAssessment = 'Good match with minor gaps that can be addressed'
  } else if (totalScore >= 50) {
    overallAssessment = 'Moderate match with some significant gaps to consider'
  } else {
    overallAssessment = 'Weak match with multiple areas needing improvement'
  }

  return { strengths, concerns, overall_assessment: overallAssessment }
}

function generateGapsAndActions(
  candidateProfile: CandidateProfile,
  job: CandidateJob,
  skillsMatch: SkillsMatchResult,
  experienceMatch: ExperienceMatchResult,
  educationMatch: EducationMatchResult,
  certificationMatch: CertificationMatchResult
): GapAnalysis {
  const skill_gaps: Array<{ skill: string; current_level: number; required_level: number; action: string }> = []
  const education_gaps: Array<{ requirement: string; action: string }> = []
  const certification_gaps: Array<{ requirement: string; action: string }> = []
  const interview_prep: string[] = []

  // Analyze skill gaps
  if (skillsMatch.skill_gaps && skillsMatch.skill_gaps.length > 0) {
    for (const gap of skillsMatch.skill_gaps) {
      const skillName = gap.split(':')[0].trim()
      const requiredLevel = parseInt(gap.match(/need level (\d+)/)?.[1] || '3')
      const currentLevel = parseInt(gap.match(/have level (\d+)/)?.[1] || '2')
      
      let action = ''
      if (requiredLevel - currentLevel === 1) {
        action = 'Take intermediate course or practice project'
      } else if (requiredLevel - currentLevel === 2) {
        action = 'Complete comprehensive training program'
      } else {
        action = 'Consider if this role is suitable or seek extensive training'
      }

      skill_gaps.push({
        skill: skillName,
        current_level: currentLevel,
        required_level: requiredLevel,
        action
      })
    }
  }

  // Analyze experience gap
  let experience_gap: { gap_years: number; action: string } | undefined
  if (experienceMatch.penalty > 0) {
    const gap_years = Math.abs(candidateProfile.experience_years - (job.experience_years_req?.min || 0))
    let action = ''
    
    if (candidateProfile.experience_years < (job.experience_years_req?.min || 0)) {
      action = 'Highlight transferable skills and consider related experience'
    } else {
      action = 'Emphasize leadership potential and willingness to grow into role'
    }

    experience_gap = { gap_years, action }
  }

  // Analyze education gaps
  if (educationMatch.score < 100 && job.education_req?.length > 0) {
    for (const req of job.education_req) {
      education_gaps.push({
        requirement: req,
        action: 'Consider pursuing additional education or highlight relevant experience'
      })
    }
  }

  // Analyze certification gaps
  if (certificationMatch.score < 100 && job.certifications_req?.length > 0) {
    for (const req of job.certifications_req) {
      certification_gaps.push({
        requirement: req,
        action: 'Research certification requirements and timeline'
      })
    }
  }

  // Generate interview preparation tips
  const avgSkillsScore = skillsMatch.score || 0
  const avgExperienceScore = experienceMatch.score || 0
  const avgSalaryScore = 70 // Default assumption
  
  if (avgSkillsScore >= 70) {
    interview_prep.push('Prepare to discuss your technical skills in detail')
  }
  if (avgExperienceScore >= 70) {
    interview_prep.push('Highlight relevant experience and achievements')
  }
  if (skill_gaps.length > 0) {
    interview_prep.push('Be ready to discuss your learning plan for skill gaps')
  }
  if (avgSalaryScore >= 70) {
    interview_prep.push('Salary expectations are well-aligned')
  }
  interview_prep.push('Research the company and prepare thoughtful questions')
  interview_prep.push('Prepare specific examples of your achievements')

  return {
    skill_gaps,
    experience_gap,
    education_gaps,
    certification_gaps,
    interview_prep
  }
}

// Hard filtering functions
function checkWorkAuthFilter(candidate: CandidateProfile, job: CandidateJob): { passed: boolean; reason: string } {
  if (!candidate.work_auth || !job.visa_requirement) {
    return { passed: true, reason: 'Work auth info not available' }
  }

  const { ep_needed } = candidate.work_auth
  const { local_only, ep_ok } = job.visa_requirement

  // If job requires locals only and candidate needs EP
  if (local_only && ep_needed) {
    return { passed: false, reason: 'Job requires locals only, candidate needs EP' }
  }

  // If job doesn't accept EP and candidate needs EP
  if (!ep_ok && ep_needed) {
    return { passed: false, reason: 'Job does not accept EP holders' }
  }

  return { passed: true, reason: 'Work authorization compatible' }
}

function checkBlacklistFilter(candidate: CandidateProfile, job: CandidateJob): { passed: boolean; reason: string } {
  if (!candidate.blacklist_companies || !candidate.blacklist_companies.length) {
    return { passed: true, reason: 'No blacklisted companies' }
  }

  const jobCompany = (job.company || '').toLowerCase()
  
  for (const blacklisted of candidate.blacklist_companies) {
    if (jobCompany.includes(blacklisted.toLowerCase()) || 
        blacklisted.toLowerCase().includes(jobCompany)) {
      return { passed: false, reason: `Company ${job.company} is blacklisted` }
    }
  }

  return { passed: true, reason: 'Company not blacklisted' }
}

function checkWorkPrefsFilter(candidate: CandidateProfile, job: CandidateJob): { passed: boolean; reason: string } {
  if (!candidate.work_prefs || !job.remote_policy) {
    return { passed: true, reason: 'Work preferences not specified' }
  }

  const { remote: candidateRemote, job_type: candidateJobType } = candidate.work_prefs
  const jobRemote = job.remote_policy
  const jobType = job.job_type || 'Permanent'

  // Check remote policy compatibility
  if (candidateRemote === 'Remote' && jobRemote === 'Onsite') {
    return { passed: false, reason: 'Candidate wants remote, job is onsite only' }
  }

  if (candidateRemote === 'Onsite' && jobRemote === 'Remote') {
    return { passed: false, reason: 'Candidate wants onsite, job is remote only' }
  }

  // Check job type compatibility
  if (candidateJobType === 'Permanent' && jobType === 'Contract') {
    return { passed: false, reason: 'Candidate wants permanent, job is contract' }
  }

  return { passed: true, reason: 'Work preferences compatible' }
}

function applyHardFilters(candidate: CandidateProfile, job: CandidateJob): { passed: boolean; reasons: string[] } {
  const reasons: string[] = []
  
  // Check work authorization
  const workAuthCheck = checkWorkAuthFilter(candidate, job)
  if (!workAuthCheck.passed) {
    reasons.push(workAuthCheck.reason)
  }

  // Check blacklist
  const blacklistCheck = checkBlacklistFilter(candidate, job)
  if (!blacklistCheck.passed) {
    reasons.push(blacklistCheck.reason)
  }

  // Check work preferences
  const workPrefsCheck = checkWorkPrefsFilter(candidate, job)
  if (!workPrefsCheck.passed) {
    reasons.push(workPrefsCheck.reason)
  }

  return {
    passed: reasons.length === 0,
    reasons
  }
}

export class JobMatchingService {
  /**
   * Build candidate profile from database using enhanced profile data
   */
  async buildCandidateProfile(usersId: string): Promise<CandidateProfile> {
    try {
      console.log('[JobMatching] buildCandidateProfile start', { usersId })
      
      // First try to get enhanced profile data
      const enhancedProfile = await EnhancedCandidateProfileService.getEnhancedProfile(usersId)
      
      if (enhancedProfile) {
        console.log('[JobMatching] Using enhanced profile data')
        
        // Convert enhanced profile to CandidateProfile format
        const candidateProfile: CandidateProfile = {
          titles: [enhancedProfile.current_title, ...enhancedProfile.target_titles].filter(Boolean),
          skills: enhancedProfile.skills.map(s => ({ name: s.name, level: s.level })),
          experience_years: enhancedProfile.experience_years,
          industries: enhancedProfile.industries,
          salary_range_min: enhancedProfile.salary_expect.min,
          salary_range_max: enhancedProfile.salary_expect.max,
          work_auth: {
            citizen_or_pr: enhancedProfile.work_auth.citizen_or_pr,
            ep_needed: enhancedProfile.work_auth.ep_needed,
            work_permit_type: enhancedProfile.work_auth.work_permit_type || undefined
          },
          work_prefs: {
            remote: enhancedProfile.work_prefs.remote as 'Onsite' | 'Hybrid' | 'Remote',
            job_type: enhancedProfile.work_prefs.job_type as 'Permanent' | 'Contract' | 'Freelance'
          },
          blacklist_companies: enhancedProfile.intent.blacklist_companies,
          education: enhancedProfile.education.map(e => ({
            study_type: e.degree,
            area: e.major,
            institution: e.institution
          })),
          certifications: enhancedProfile.certifications.map(c => ({ name: c, issuer: '' })),
          company_tiers: enhancedProfile.company_tiers,
          leadership_level: enhancedProfile.leadership_level,
          management_experience: enhancedProfile.management_experience
        }
        
        console.log('[JobMatching] buildCandidateProfile done (enhanced)', { 
          experience_years: candidateProfile.experience_years,
          education_count: candidateProfile.education?.length || 0,
          skills_count: candidateProfile.skills.length,
          titles_count: candidateProfile.titles.length
        })
        
        return candidateProfile
      }
      
      // Fallback to legacy method if enhanced profile not available
      console.log('[JobMatching] Enhanced profile not found, using legacy method')
      return await this.buildCandidateProfileLegacy(usersId)
      
    } catch (error) {
      console.error('[JobMatching] buildCandidateProfile failed:', error)
      // Fallback to legacy method
      return await this.buildCandidateProfileLegacy(usersId)
    }
  }

  /**
   * Legacy method to build candidate profile from raw database tables
   * @deprecated Use enhanced profile data instead
   */
  private async buildCandidateProfileLegacy(usersId: string): Promise<CandidateProfile> {
    try {
      // Get work experience titles
      const { data: workData } = await supabase()
        .from('candidate_work')
        .select('position, company, start_date, end_date')
        .eq('user_id', usersId)
        .order('start_date', { ascending: false })
        .limit(10)

      // Get skills with levels
      const { data: skillsData } = await supabase()
        .from('candidate_skills')
        .select('name, level')
        .eq('user_id', usersId)

      // Get education for experience calculation
      // Calculate experience years
      let experienceYears = 0
      if (workData && workData.length > 0) {
        const earliestWork = workData[workData.length - 1]
        const latestWork = workData[0]
        
        if (earliestWork.start_date) {
          const startDate = new Date(earliestWork.start_date)
          const endDate = latestWork.end_date ? new Date(latestWork.end_date) : new Date('2025-01-01') // Assume 2025
          experienceYears = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365))
        }
      }

      // Extract industries from work experience
      const industries = [...new Set(workData?.map(w => w.company).filter(Boolean) || [])]

      // Get skills list with levels
      const skills = skillsData?.map(s => ({ name: s.name, level: s.level || 3 })).filter(s => s.name) || []

      // Get job titles
      const titles = workData?.map(w => w.position).filter(Boolean) || []

      // Get candidate basics for work auth and preferences
      const { data: basicsData } = await supabase()
        .from('candidate_basics')
        .select('work_auth, work_prefs, salary_expect_min, salary_expect_max')
        .eq('user_id', usersId)
        .single()

      // Get education data
      const { data: educationProfileData } = await supabase()
        .from('candidate_education')
        .select('study_type, area, institution')
        .eq('user_id', usersId)

      // Get certifications data
      const { data: certificationsData } = await supabase()
        .from('candidate_certificates')
        .select('name, issuer')
        .eq('user_id', usersId)

      return {
        titles,
        skills,
        experience_years: Math.max(experienceYears, 0),
        industries,
        salary_range_min: basicsData?.salary_expect_min || (experienceYears < 2 ? 3000 : experienceYears < 5 ? 5000 : 8000),
        salary_range_max: basicsData?.salary_expect_max || (experienceYears < 2 ? 6000 : experienceYears < 5 ? 10000 : 15000),
        work_auth: basicsData?.work_auth,
        work_prefs: basicsData?.work_prefs,
        blacklist_companies: [], // TODO: Extract from intent.blacklist_companies
        education: educationProfileData || [],
        certifications: certificationsData || [],
        company_tiers: []
      }
    } catch (error) {
      console.error('Failed to build candidate profile:', error)
      return {
        titles: [],
        skills: [],
        experience_years: 0,
        industries: [],
        salary_range_min: 3000,
        salary_range_max: 6000
      }
    }
  }

  /**
   * Enhanced: Get job recommendations using comprehensive candidate profile
   */
  async getEnhancedRecommendations(
    candidateProfile: CandidateProfile,
    limit: number = 3,
    usersId?: string
  ): Promise<JobRecommendation[]> {
    try {
      console.debug('[JobMatching] getEnhancedRecommendations start', { limit, usersId, candidateProfile })
      
      const { data: jobs, error } = await supabase()
        .from('jobs')
        .select('*')
        .limit(500) // Increased limit for better matching

      if (error) throw new Error(`Failed to fetch jobs: ${error.message}`)
      if (!jobs || jobs.length === 0) return []

      const matches: JobRecommendation[] = jobs.map(job => {
        // Apply hard filters first
        const hardFilterResult = applyHardFilters(candidateProfile, job)
        if (!hardFilterResult.passed) {
          return {
            job,
            match_score: 0,
            match_reasons: [`Filtered out: ${hardFilterResult.reasons.join(', ')}`],
            breakdown: {
              title_match: 0,
              salary_match: 0,
              skills_match: 0,
              experience_match: 0,
              industry_match: 0,
              education_match: 0,
              certification_match: 0,
              job_family_match: 0,
              work_prefs_match: 0
            },
            why_match: {
              strengths: [],
              concerns: [],
              overall_assessment: 'Filtered out by hard filters'
            },
            gaps_and_actions: {
              skill_gaps: [],
              education_gaps: [],
              certification_gaps: [],
              interview_prep: []
            }
          }
        }

        // 2. Salary matching (14% weight)
        const salaryMatch = calculateSalaryMatch(
          candidateProfile.salary_range_min,
          candidateProfile.salary_range_max,
          job.salary_low || 0,
          job.salary_high || 0,
          job.currency || 'SGD'
        )

        // 3. Skills matching (25% weight)
        const jobRequiredSkills = job.skills_required || []
        const jobOptionalSkills = job.skills_optional || []
        const skillsMatch = calculateSkillsMatch(
          candidateProfile.skills,
          jobRequiredSkills,
          jobOptionalSkills,
          job.job_description || ''
        )

        // 4. Job family / discipline matching (20% weight)
        const jobFamilyMatch = calculateJobFamilyMatch(
          candidateProfile.titles,
          job.job_family || '',
          job.title || ''
        )

        // 5. Title matching (15% weight)
        let bestTitle = { score: 0, tokens: [] as string[], title: '' }
        for (const candidateTitle of candidateProfile.titles) {
          const { score, tokens } = tokenOverlapScore(candidateTitle.toLowerCase(), job.title || '')
          if (score > bestTitle.score) bestTitle = { score, tokens, title: candidateTitle }
        }

        // 6. Experience matching (8% weight)
        const experienceMatch = calculateExperienceMatch(
          candidateProfile.experience_years,
          job.experience_years_req,
          job.experience_level || ''
        )

        // 7. Education matching (4% weight)
        const educationMatch = calculateEducationMatch(
          candidateProfile.education || [],
          job.education_req || []
        )

        // 8. Certification matching (3% weight)
        const certificationMatch = calculateCertificationMatch(
          candidateProfile.certifications || [],
          job.certifications_req || []
        )

        // 9. Work preferences matching (1% weight)
        const workPrefsMatch = calculateWorkPrefsMatch(
          candidateProfile.work_prefs,
          job.remote_policy || '',
          job.job_type || ''
        )

        // 10. Industry matching (1% weight)
        const industryMatch = calculateIndustryMatch(
          candidateProfile.industries,
          job.industry || '',
          candidateProfile.company_tiers || [],
          job.company_tier || ''
        )

        // 11. Leadership level matching (10% weight)
        const leadershipMatch = this.calculateLeadershipMatch(candidateProfile, job)
        
        // 12. Salary expectation penalty
        const salaryPenalty = this.calculateSalaryPenalty(candidateProfile, job)

        // Calculate weighted total score with leadership matching and salary penalty
        const totalScore = Math.round(
          (bestTitle.score * 0.15) +
          (salaryMatch.score * 0.14) +
          (skillsMatch.score * 0.25) +
          (jobFamilyMatch.score * 0.20) +
          (experienceMatch.score * 0.08) +
          (educationMatch.score * 0.04) +
          (certificationMatch.score * 0.03) +
          (workPrefsMatch.score * 0.01) +
          (industryMatch.score * 0.01) +
          (leadershipMatch.score * 0.10) -
          salaryPenalty
        )

        // Apply a discipline gate: if job family and title similarity are both weak, drop score drastically
        const disciplineAlignment = Math.max(jobFamilyMatch.score, bestTitle.score)
        const adjustedScore = disciplineAlignment < 40 ? Math.max(totalScore - 40, 0) : totalScore

        // Build match reasons
        const reasons: string[] = []
        if (bestTitle.tokens.length) {
          reasons.push(`Title match: ${bestTitle.tokens.join(', ')}`)
        }
        if (salaryMatch.score > 0) {
          reasons.push(salaryMatch.reason)
        }
        if (skillsMatch.matched_skills.length > 0) {
          reasons.push(`Skills: ${skillsMatch.matched_skills.slice(0, 3).join(', ')}`)
        }
        if (skillsMatch.missing_skills.length > 0) {
          reasons.push(`Missing: ${skillsMatch.missing_skills.slice(0, 2).join(', ')}`)
        }
        if (experienceMatch.score > 50) {
          reasons.push(experienceMatch.reason)
        }
        if (educationMatch.score > 50) {
          reasons.push(educationMatch.reason)
        }
        if (certificationMatch.score > 50) {
          reasons.push(certificationMatch.reason)
        }
        if (jobFamilyMatch.score > 50) {
          reasons.push(jobFamilyMatch.reason)
        }
        if (workPrefsMatch.score > 50) {
          reasons.push(workPrefsMatch.reason)
        }
        if (leadershipMatch.score > 50) {
          reasons.push(leadershipMatch.reason)
        }
        if (salaryPenalty > 0) {
          reasons.push(`Salary below expectation (penalty: -${salaryPenalty})`)
        }
        if (industryMatch.score > 50) {
          reasons.push(industryMatch.reason)
        }

        // Generate detailed explanations
        const whyMatch = generateWhyMatch(
          candidateProfile,
          job,
          {
            title_match: bestTitle.score,
            salary_match: salaryMatch.score,
            skills_match: skillsMatch.score,
            experience_match: experienceMatch.score,
            education_match: educationMatch.score,
            certification_match: certificationMatch.score,
            job_family_match: jobFamilyMatch.score,
            work_prefs_match: workPrefsMatch.score,
            industry_match: industryMatch.score,
            leadership_match: leadershipMatch.score
          },
          skillsMatch,
          experienceMatch,
          educationMatch,
          certificationMatch
        )

      const gapsAndActions = generateGapsAndActions(
          candidateProfile,
          job,
          skillsMatch,
          experienceMatch,
          educationMatch,
          certificationMatch
        )

        return {
          job,
          match_score: adjustedScore,
          match_reasons: reasons.length ? reasons : ['Basic match'],
          breakdown: {
            title_match: bestTitle.score,
            salary_match: salaryMatch.score,
            skills_match: skillsMatch.score,
            job_family_match: jobFamilyMatch.score,
            experience_match: experienceMatch.score,
            education_match: educationMatch.score || 0,
            certification_match: certificationMatch.score || 0,
            work_prefs_match: workPrefsMatch.score || 0,
            industry_match: industryMatch.score || 0,
            leadership_match: leadershipMatch.score
          },
          why_match: whyMatch,
          gaps_and_actions: gapsAndActions
        }
      })

      const top = matches
        .filter(m => m.match_score > 20) // Filter out very low matches
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit)

      // Generate personalized suggestions for top matches
      if (top.length > 0) {
        await this.addPersonalizedSuggestions(candidateProfile, top)
      }

      if (usersId && top.length) {
        await this.saveRecommendations(usersId, top)
      }

      console.debug('[JobMatching] getEnhancedRecommendations done', { count: top.length })
      return top
    } catch (e) {
      console.error('Enhanced job recommendations failed:', e)
      throw e
    }
  }

  /**
   * Add personalized LLM-generated suggestions to recommendations
   */
  private async addPersonalizedSuggestions(
    candidateProfile: CandidateProfile,
    recommendations: JobRecommendation[]
  ): Promise<void> {
    try {
      // Generate suggestions for top 2 recommendations to avoid too many LLM calls
      const topRecommendations = recommendations.slice(0, 2)
      
      for (const recommendation of topRecommendations) {
        try {
          const personalizedSuggestions = await LLMActionSuggestionsService.generatePersonalizedSuggestions(
            candidateProfile,
            recommendation,
            recommendation.gaps_and_actions
          )
          
          recommendation.personalized_suggestions = personalizedSuggestions
        } catch (error) {
          console.error('Failed to generate personalized suggestions for job:', recommendation.job.title, error)
          // Continue without personalized suggestions
        }
      }
    } catch (error) {
      console.error('Failed to add personalized suggestions:', error)
    }
  }

  /**
   * Legacy: Get job recommendations using candidate titles (fuzzy matching)
   */
  async getRecommendationsFromTitles(
    candidateTitles: string[],
    limit: number = 3,
    usersId?: string
  ): Promise<JobRecommendation[]> {
    try {
      console.debug('[JobMatching] getRecommendationsFromTitles start', { limit, usersId, candidateTitles })
      const { data: jobs, error } = await supabase()
        .from('jobs')
        .select('*')
        .limit(200)

      if (error) throw new Error(`Failed to fetch jobs: ${error.message}`)
      if (!jobs || jobs.length === 0) return []

      const matches: JobRecommendation[] = jobs.map(job => {
        let best = { score: 0, tokens: [] as string[], title: '' }
        for (const ct of candidateTitles) {
          const { score, tokens } = tokenOverlapScore(ct, job.title || '')
          if (score > best.score) best = { score, tokens, title: ct }
        }
        const reasons: string[] = []
        if (best.tokens.length) reasons.push(`Overlap: ${best.tokens.join(', ')}`)
        if (best.title) reasons.push(`Closest title: "${best.title}"`)
        return {
          job,
          match_score: best.score,
          match_reasons: reasons.length ? reasons : ['Title similarity'],
          breakdown: {
            title_match: best.score,
            salary_match: 50,
            skills_match: 0,
            experience_match: 50,
            education_match: 50,
            certification_match: 50,
            job_family_match: 50,
            work_prefs_match: 50,
            industry_match: 50
          },
          why_match: {
            strengths: best.score >= 70 ? [`Strong title similarity (${best.score}%)`] : [],
            concerns: best.score < 50 ? ['Limited title alignment'] : [],
            overall_assessment: best.score >= 70 ? 'Good title match' : 'Weak title match'
          },
          gaps_and_actions: {
            skill_gaps: [],
            education_gaps: [],
            certification_gaps: [],
            interview_prep: ['Focus on title-related experience', 'Prepare examples of relevant work']
          }
        }
      })

      const top = matches
        .filter(m => m.match_score > 0)
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit)

      if (usersId && top.length) {
        await this.saveRecommendations(usersId, top)
      }

      console.debug('[JobMatching] getRecommendationsFromTitles done', { count: top.length })
      return top
    } catch (e) {
      console.error('Job recommendations (titles) failed:', e)
      throw e
    }
  }

  /**
   * Save job recommendations to database
   */
  private async saveRecommendations(
    usersId: string,
    recommendations: JobRecommendation[]
  ) {
    try {
      const recommendationData = recommendations.map(rec => ({
        user_id: usersId,
        job_id: rec.job.id,
        match_score: rec.match_score,
        match_reasons: rec.match_reasons
      }))

      const { error } = await supabase()
        .from('job_recommendations')
        .insert(recommendationData)

      if (error) {
        console.error('Failed to save recommendations:', error)
      }
    } catch (error) {
      console.error('Save recommendations error:', error)
    }
  }

  /**
   * Get saved job recommendations for a user
   */
  async getSavedRecommendations(userId: string): Promise<JobRecommendation[]> {
    try {
      const { data, error } = await supabase()
        .from('job_recommendations')
        .select(`
          *,
          jobs (*)
        `)
        .eq('user_id', userId)
        .order('match_score', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch recommendations: ${error.message}`)
      }

      return data.map(rec => ({
        job: rec.jobs,
        match_score: rec.match_score,
        match_reasons: rec.match_reasons,
        breakdown: {
          title_match: 0,
          salary_match: 0,
          skills_match: 0,
          experience_match: 0,
          industry_match: 0,
          education_match: 0,
          certification_match: 0,
          job_family_match: 0,
          work_prefs_match: 0
        },
        why_match: {
          strengths: [],
          concerns: [],
          overall_assessment: 'Basic matching based on saved recommendations'
        },
        gaps_and_actions: {
          skill_gaps: [],
          education_gaps: [],
          certification_gaps: [],
          interview_prep: []
        }
      }))
    } catch (error) {
      console.error('Get saved recommendations failed:', error)
      return []
    }
  }

  /**
   * Calculate leadership level match between candidate and job
   */
  private calculateLeadershipMatch(
    candidateProfile: CandidateProfile,
    job: CandidateJob
  ): { score: number; reason: string; penalty: number } {
    const candidateLeadership = candidateProfile.leadership_level || 'IC'
    const jobLeadership = job.leadership_level
    
    // If job doesn't have leadership level specified, infer from job title and description
    if (!jobLeadership) {
      const inferredLeadership = this.inferJobLeadershipLevel(job)
      
      // If we can't infer leadership level, give neutral score
      if (!inferredLeadership) {
        return { 
          score: 75, // Neutral score - no penalty for unknown leadership requirements
          reason: 'Leadership level not specified for job', 
          penalty: 0 
        }
      }
      
      // Use inferred leadership level
      return this.calculateLeadershipMatchWithLevels(candidateLeadership, inferredLeadership)
    }
    
    return this.calculateLeadershipMatchWithLevels(candidateLeadership, jobLeadership)
  }

  /**
   * Infer job leadership level from title and description
   */
  private inferJobLeadershipLevel(job: CandidateJob): string | null {
    const title = (job.title || '').toLowerCase()
    const description = (job.job_description || job.raw_text || '').toLowerCase()
    const combinedText = `${title} ${description}`
    
    // Team Lead++ indicators (senior management)
    const seniorManagementKeywords = [
      'director', 'vp', 'vice president', 'head of', 'chief', 'cto', 'cfo', 'ceo',
      'senior director', 'executive', 'managing', 'leadership team', 'strategic',
      'manage team of', 'lead team of', 'oversee team', 'team of 10+', 'team of 20+'
    ]
    
    // Team Lead indicators (team management)
    const teamLeadKeywords = [
      'team lead', 'team leader', 'lead', 'manager', 'supervisor', 'manage',
      'team of', 'lead team', 'manage team', 'supervise', 'mentor', 'guide team'
    ]
    
    // Check for senior management
    if (seniorManagementKeywords.some(keyword => combinedText.includes(keyword))) {
      return 'Team Lead++'
    }
    
    // Check for team management
    if (teamLeadKeywords.some(keyword => combinedText.includes(keyword))) {
      return 'Team Lead'
    }
    
    // Default to IC if no management indicators found
    return 'IC'
  }

  /**
   * Calculate leadership match with specific levels
   */
  private calculateLeadershipMatchWithLevels(
    candidateLeadership: string,
    jobLeadership: string
  ): { score: number; reason: string; penalty: number } {
    // Perfect match
    if (candidateLeadership === jobLeadership) {
      return { 
        score: 100, 
        reason: `Leadership level match: ${candidateLeadership}`, 
        penalty: 0 
      }
    }
    
    // IC candidate applying for Team Lead role (possible promotion)
    if (candidateLeadership === 'IC' && jobLeadership === 'Team Lead') {
      return { 
        score: 70, 
        reason: 'IC candidate applying for Team Lead role (promotion opportunity)', 
        penalty: 0 
      }
    }
    
    // Team Lead candidate applying for IC role (possible step down)
    if (candidateLeadership === 'Team Lead' && jobLeadership === 'IC') {
      return { 
        score: 40, 
        reason: 'Team Lead candidate applying for IC role (may be overqualified)', 
        penalty: 20 
      }
    }
    
    // Team Lead++ applying for lower roles (significant step down)
    if (candidateLeadership === 'Team Lead++' && (jobLeadership === 'IC' || jobLeadership === 'Team Lead')) {
      return { 
        score: 20, 
        reason: 'Senior leader applying for lower role (significant step down)', 
        penalty: 50 
      }
    }
    
    // Team Lead applying for Team Lead++ (promotion)
    if (candidateLeadership === 'Team Lead' && jobLeadership === 'Team Lead++') {
      return { 
        score: 80, 
        reason: 'Team Lead applying for senior leadership role (promotion opportunity)', 
        penalty: 0 
      }
    }
    
    // Default case
    return { 
      score: 50, 
      reason: 'Leadership level mismatch', 
      penalty: 30 
    }
  }

  /**
   * Calculate salary expectation penalty
   */
  private calculateSalaryPenalty(
    candidateProfile: CandidateProfile,
    job: CandidateJob
  ): number {
    // If candidate doesn't have salary expectations, no penalty
    if (!candidateProfile.salary_range_min || !candidateProfile.salary_range_max) {
      return 0
    }
    
    // If job doesn't have salary information, no penalty
    if (!job.salary_low || !job.salary_high) {
      return 0
    }
    
    const jobSalaryMax = job.salary_high
    const candidateSalaryMin = candidateProfile.salary_range_min
    
    // If job max salary is below candidate's minimum expectation
    if (jobSalaryMax < candidateSalaryMin) {
      const gap = candidateSalaryMin - jobSalaryMax
      const percentageGap = gap / candidateSalaryMin
      
      // Apply penalty based on how far below expectation
      if (percentageGap > 0.3) return 50  // More than 30% below
      if (percentageGap > 0.2) return 30  // More than 20% below
      if (percentageGap > 0.1) return 15  // More than 10% below
      return 5  // Less than 10% below
    }
    
    return 0
  }

  /**
   * Simple keyword-based matching as fallback
   */
  private calculateSimpleMatch(
    candidateProfile: CandidateProfile,
    job: CandidateJob
  ): number {
    let score = 0
    const maxScore = 100

    if (candidateProfile.industries.length && job.industry) {
      const jobIndustry = job.industry.toLowerCase()
      if (candidateProfile.industries.some(industry => industry.toLowerCase() === jobIndustry)) {
        score += 20
      }
    }

    if (job.salary_low && job.salary_high && candidateProfile.salary_range_min && candidateProfile.salary_range_max) {
      const jobSalaryMid = (job.salary_low + job.salary_high) / 2
      const candidateSalaryMid = (candidateProfile.salary_range_min + candidateProfile.salary_range_max) / 2

      if (Math.abs(jobSalaryMid - candidateSalaryMid) < candidateSalaryMid * 0.2) {
        score += 20
      }
    }

    if (job.experience_level && candidateProfile.experience_years) {
      const experienceMatch = this.matchExperienceLevel(
        candidateProfile.experience_years,
        job.experience_level
      )
      score += experienceMatch * 20
    }

    const jobText = (job.job_description || '').toLowerCase()
    const skillMatches = candidateProfile.skills.filter(skill =>
      jobText.includes(skill.name.toLowerCase())
    ).length

    score += Math.min(skillMatches * 5, 20)

    return Math.min(score, maxScore)
  }

  /**
   * Match experience years with experience level
   */
  private matchExperienceLevel(years: number, level: string): number {
    const levelLower = level.toLowerCase()
    
    if (levelLower.includes('entry') || levelLower.includes('junior')) {
      return years <= 2 ? 1 : 0.5
    } else if (levelLower.includes('senior') || levelLower.includes('lead')) {
      return years >= 5 ? 1 : years >= 3 ? 0.7 : 0.3
    } else if (levelLower.includes('manager') || levelLower.includes('director')) {
      return years >= 7 ? 1 : years >= 5 ? 0.7 : 0.2
    } else if (levelLower.includes('executive')) {
      return years >= 3 ? 1 : years >= 1 ? 0.6 : 0.2
    }
    
    return 0.5 // Default match
  }
}

// Singleton instance
export const jobMatchingService = new JobMatchingService()
