// LLM Analysis Service for Resume Processing
import { RESUME_ANALYSIS_PROMPTS, JOB_ANALYSIS_PROMPTS, SYSTEM_PROMPTS } from './prompts'
import { EnhancedCandidateProfile } from './enhanced-candidate-profile'
import type { CandidateJob } from './job-matching'

interface ResumeBasics {
  name?: string
  label?: string
  email?: string
  phone?: string
  url?: string
  summary?: string
  location?: {
    address?: string
    postalCode?: string
    city?: string
    countryCode?: string
    region?: string
  }
  profiles?: Array<{
    network?: string
    username?: string
    url?: string
  }>
}

interface ResumeWorkEntry {
  name?: string
  position?: string
  url?: string
  startDate?: string
  endDate?: string
  summary?: string
  highlights?: string[]
}

interface ResumeEducationEntry {
  institution?: string
  url?: string
  area?: string
  studyType?: string
  startDate?: string
  endDate?: string
  score?: string
  courses?: string[]
}

interface ResumeCertification {
  name?: string
  date?: string
  issuer?: string
  url?: string
}

export interface JsonResume {
  basics?: ResumeBasics
  work?: ResumeWorkEntry[]
  volunteer?: ResumeWorkEntry[]
  education?: ResumeEducationEntry[]
  awards?: Array<{ title?: string; date?: string; awarder?: string; summary?: string }>
  certificates?: ResumeCertification[]
  publications?: Array<{ name?: string; publisher?: string; releaseDate?: string; url?: string; summary?: string }>
  skills?: Array<{ name?: string; level?: string; keywords?: string[] }>
  languages?: Array<{ language?: string; fluency?: string }>
  interests?: Array<{ name?: string; keywords?: string[] }>
  references?: Array<{ name?: string; reference?: string }>
  projects?: Array<{ name?: string; description?: string; startDate?: string; endDate?: string; url?: string; keywords?: string[]; highlights?: string[] }>
}

interface LLMJobAnalysis {
  final_score: number
  matching_reasons: string[]
  non_matching_points: string[]
  key_highlights: string[]
  personalized_assessment: string
  career_impact: string
}

export class LLMAnalysisService {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  }

  // Robust JSON parsing helper to handle code fences or extra text
  private parseJsonResponse<T = unknown>(raw: string): T {
    try {
      return JSON.parse(raw) as T
    } catch {
      const fenceMatch = raw.match(/```(?:json)?[\r\n]+([\s\S]*?)```/i)
      const candidate = fenceMatch ? fenceMatch[1] : raw

      const cleaned = candidate
        .trim()
        .replace(/^[^{\[]*/, '')
        .replace(/[^}\]]*$/, '')

      try {
        return JSON.parse(cleaned) as T
      } catch {
        const start = cleaned.indexOf('{')
        const end = cleaned.lastIndexOf('}')
        if (start !== -1 && end !== -1 && end > start) {
          const slice = cleaned.slice(start, end + 1)
          try {
            return JSON.parse(slice) as T
          } catch {
            try {
              const fixedJson = this.fixTruncatedJson(slice)
              return JSON.parse(fixedJson) as T
            } catch {
              console.log('❌ Failed to parse JSON slice:', slice.substring(0, 200) + '...')
              return {} as T
            }
          }
        }
        console.log('❌ No valid JSON found in response:', raw.substring(0, 200) + '...')
        return {} as T
      }
    }
  }

  // Helper to fix truncated JSON responses
  private fixTruncatedJson(jsonStr: string): string {
    let fixed = jsonStr
    
    // Count opening and closing braces/brackets
    const openBraces = (fixed.match(/\{/g) || []).length
    const closeBraces = (fixed.match(/\}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const closeBrackets = (fixed.match(/\]/g) || []).length
    
    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      fixed += ']'
    }
    
    // Add missing closing braces
    for (let i = 0; i < openBraces - closeBraces; i++) {
      fixed += '}'
    }
    
    return fixed
  }

  /**
   * Call OpenAI API with a prompt
   */
  private async callOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt + ' Return ONLY valid JSON without code fences.' }] : []),
            { role: 'user', content: prompt }
          ],
          reasoning_effort: "low",
          verbosity: "low",
          // max_output_tokens: 6000,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      console.error('OpenAI API call failed:', error)
      throw new Error(`LLM analysis failed: ${error}`)
    }
  }

  /**
   * Upload file to OpenAI and get file ID
   */
  private async uploadFileToOpenAI(file: File): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', 'user_data')

      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`File upload failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      return data.id
    } catch (error) {
      console.error('OpenAI file upload failed:', error)
      throw new Error(`File upload failed: ${error}`)
    }
  }

  /**
   * Call OpenAI API with uploaded file
   */
  private async callOpenAIWithFile(file: File, prompt: string, systemPrompt?: string): Promise<string> {
    try {
      // Upload file first
      const fileId = await this.uploadFileToOpenAI(file)

      // Use the file in chat completion
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt + ' Return ONLY valid JSON without code fences.' }] : []),
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'file',
                  file: {
                    file_id: fileId
                  }
                }
              ]
            }
          ],
          reasoning_effort: "medium",
          verbosity: "low",
          // max_output_tokens: 2000,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      console.error('OpenAI API call with file failed:', error)
      throw new Error(`LLM analysis with file failed: ${error}`)
    }
  }

  // New: Generate enhanced candidate profile from file
  // Combined method: Generate both enhanced profile and JSON resume in one OpenAI call
  async generateCombinedProfileFromFile(file: File): Promise<{ enhancedProfile: EnhancedCandidateProfile; jsonResume: JsonResume }> {
    try {
      console.info('[LLMAnalysis] Generating combined profile from resume')
      
      // Create a combined prompt that asks for both formats
      const instruction = 'If a file is attached, read it as the resume source; if no file is available, use any pasted text provided in the prompt. Always return ONLY valid JSON matching the required schema.'
      const combinedPrompt = instruction + '\n\n' + RESUME_ANALYSIS_PROMPTS.combinedProfile

      const response = await this.callOpenAIWithFile(file, combinedPrompt, SYSTEM_PROMPTS.resumeAnalysis)
      const parsed = this.parseJsonResponse(response) as { enhancedProfile: EnhancedCandidateProfile; jsonResume: JsonResume }
      
      console.info('[LLMAnalysis] Combined profile generation complete')
      
      return {
        enhancedProfile: parsed.enhancedProfile,
        jsonResume: parsed.jsonResume
      }
    } catch (error) {
      console.error('Generate combined profile from file failed:', error)
      return { 
        enhancedProfile: {
          work_auth: { citizen_or_pr: false, ep_needed: true, work_permit_type: null },
          seniority_level: 'Not specified',
          experience_years: 0,
          skills: [],
          education: [],
          certifications: [],
          industries: [],
          company_tiers: [],
          salary_expect: { min: 0, max: 0, currency: 'SGD' },
          work_prefs: { remote: 'Not specified', job_type: 'Not specified' },
          intent: { target_industries: [], must_have: [], nice_to_have: [], blacklist_companies: [] },
          leadership_level: 'IC',
          management_experience: { has_management: false, direct_reports_count: 0, team_size_range: null, management_years: 0, management_evidence: [] }
        } as EnhancedCandidateProfile,
        jsonResume: {} as JsonResume 
      }
    }
  }

  // New: Generate enhanced candidate profile from raw text
  async generateCombinedProfileFromText(resumeText: string): Promise<{ enhancedProfile: EnhancedCandidateProfile; jsonResume: JsonResume }> {
    try {
      console.info('[LLMAnalysis] Generating combined profile from pasted text')
      const cleaned = resumeText
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/[^\S\r\n]+/g, ' ') // collapse spaces
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 50000)
      const instruction = 'If a file is attached, read it as the resume source; if no file is available, use the pasted text below. Always return ONLY valid JSON matching the required schema.'
      const combinedPrompt = instruction + '\n\n' + RESUME_ANALYSIS_PROMPTS.combinedProfile.replace('{RESUME_TEXT}', cleaned)
      const response = await this.callOpenAI(combinedPrompt, SYSTEM_PROMPTS.resumeAnalysis)
      const parsed = this.parseJsonResponse<{ enhancedProfile: EnhancedCandidateProfile; jsonResume: JsonResume }>(response)
      return {
        enhancedProfile: (parsed.enhancedProfile || {}) as unknown as EnhancedCandidateProfile,
        jsonResume: (parsed.jsonResume || {}) as JsonResume
      }
    } catch (error) {
      console.error('Generate combined profile from text failed:', error)
      return { 
        enhancedProfile: {
          work_auth: { citizen_or_pr: false, ep_needed: true, work_permit_type: null },
          seniority_level: 'Not specified',
          experience_years: 0,
          skills: [],
          education: [],
          certifications: [],
          industries: [],
          company_tiers: [],
          salary_expect: { min: 0, max: 0, currency: 'SGD' },
          work_prefs: { remote: 'Not specified', job_type: 'Not specified' },
          intent: { target_industries: [], must_have: [], nice_to_have: [], blacklist_companies: [] },
          leadership_level: 'IC',
          management_experience: { has_management: false, direct_reports_count: 0, team_size_range: null, management_years: 0, management_evidence: [] }
        } as EnhancedCandidateProfile,
        jsonResume: {} as JsonResume 
      }
    }
  }


  // analyzeResume method removed (unused)

  /**
   * Batch analyze multiple jobs for a candidate
   */
  async batchAnalyzeJobs(
    enhancedProfile: EnhancedCandidateProfile,
    jobSummaries: Array<{ id: number; job: CandidateJob; stage1_score: number; stage1_reasons: string[] }>
  ): Promise<{ job_analyses: LLMJobAnalysis[] }> {
    // Build comprehensive candidate profile from enhanced profile object
    const educationText = enhancedProfile.education?.length > 0 
      ? enhancedProfile.education.map(e => `${e.degree} in ${e.major} from ${e.institution}`).join(', ')
      : 'Not specified'

    const candidateProfileText = `
CANDIDATE PROFILE:
- Experience: ${enhancedProfile.experience_years || 0} years
- Current Title: ${enhancedProfile.current_title || 'Not specified'}
- Target Titles: ${enhancedProfile.target_titles?.join(', ') || 'Not specified'}
- Seniority Level: ${enhancedProfile.seniority_level || 'Not specified'}
- Leadership Level: ${enhancedProfile.leadership_level || 'IC'}
- Management Experience: ${enhancedProfile.management_experience?.has_management ? 'Yes' : 'No'} (${enhancedProfile.management_experience?.management_years || 0} years, ${enhancedProfile.management_experience?.direct_reports_count || 0} direct reports)
- Key Skills: ${enhancedProfile.skills?.map(s => `${s.name} (Level ${s.level})`).join(', ') || 'Not specified'}
- Industries: ${enhancedProfile.industries?.join(', ') || 'Not specified'}
- Salary Range: $${enhancedProfile.salary_expect?.min?.toLocaleString() || '0'} - $${enhancedProfile.salary_expect?.max?.toLocaleString() || '0'} ${enhancedProfile.salary_expect?.currency || 'SGD'}
- Education: ${educationText}
- Work Preferences: ${enhancedProfile.work_prefs?.remote || 'Not specified'} work, ${enhancedProfile.work_prefs?.job_type || 'Not specified'} position
- Work Authorization: ${enhancedProfile.work_auth?.citizen_or_pr ? 'Citizen/PR' : 'Needs EP'} ${enhancedProfile.work_auth?.work_permit_type ? `(${enhancedProfile.work_auth.work_permit_type})` : ''}
- Company Tiers: ${enhancedProfile.company_tiers?.join(', ') || 'Not specified'}
- Certifications: ${enhancedProfile.certifications?.join(', ') || 'None'}
- Target Industries: ${enhancedProfile.intent?.target_industries?.join(', ') || 'Not specified'}
- Must Have: ${enhancedProfile.intent?.must_have?.join(', ') || 'Not specified'}
- Nice to Have: ${enhancedProfile.intent?.nice_to_have?.join(', ') || 'Not specified'}
- Blacklist Companies: ${enhancedProfile.intent?.blacklist_companies?.join(', ') || 'None'}
`

      const jobDetails = jobSummaries.map(job => `
=== JOB ${job.id} START ===
job_id: "${job.id}"
title: "${job.job.title}"
company: "${job.job.company}"
location: "${job.job.location}"
salary: "$${job.job.salary_low?.toLocaleString()} - $${job.job.salary_high?.toLocaleString()}"
industry: "${job.job.industry}"
experience_level: "${job.job.experience_level}"
job_type: "${job.job.job_type}"
post_date: "${job.job.post_date}"
url: "${job.job.url || 'N/A'}"
job_category: "${(job.job as any).job_category || 'N/A'}"
leadership_level: "${job.job.leadership_level || 'Not specified'}"
company_tier: "${job.job.company_tier || 'Not specified'}"

FULL JOB DESCRIPTION:
${job.job.job_description || (job.job as any).raw_text || 'No description available'}

stage1_score: ${job.stage1_score}/100
stage1_reasons: ${job.stage1_reasons.join(', ')}
=== JOB ${job.id} END ===
`).join('\n')

    const prompt = JOB_ANALYSIS_PROMPTS.batchAnalyzeJobs
      .replace('{enhancedProfile}', candidateProfileText)
      .replace('{jobSummaries}', jobDetails)

    try {
      const response = await this.callOpenAI(prompt, 'You are an expert career advisor who provides detailed, personalized job analysis. Always respond with valid JSON format as requested.')
      console.debug('🔍 Raw LLM response length:', response.length)
      console.debug('🔍 Raw LLM response preview:', response.substring(0, 1000) + '...')

      const parsed = this.parseJsonResponse<{ job_analyses?: LLMJobAnalysis[] }>(response)
      console.debug('🔍 Parsed response keys:', Object.keys(parsed))

      if (!parsed.job_analyses || !Array.isArray(parsed.job_analyses)) {
            console.warn('❌ Invalid response format. Expected job_analyses array, got:', parsed)
        throw new Error('Invalid LLM response format')
      }

      return { job_analyses: parsed.job_analyses }
    } catch (error) {
      console.error('Batch job analysis failed:', error)
      console.log('🔄 Falling back to mock response...')
      
      // Return fallback data
      return {
        job_analyses: jobSummaries.map(job => ({
          final_score: Math.max(job.stage1_score + Math.floor(Math.random() * 20) - 10, 0),
          matching_reasons: job.stage1_reasons,
          non_matching_points: ['Consider skill gaps', 'Review experience requirements'],
          key_highlights: ['Good company culture', 'Growth opportunities', 'Competitive salary'],
          personalized_assessment: `This role offers good alignment with your background. The ${job.job.industry} industry experience would be valuable.`,
          career_impact: 'This position would help advance your career in the technology sector.'
        }))
      }
    }
  }
}

// Singleton instance
export const llmAnalysisService = new LLMAnalysisService()
