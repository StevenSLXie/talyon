// LLM Analysis Service for Resume Processing
import { RESUME_ANALYSIS_PROMPTS, SYSTEM_PROMPTS } from './prompts'

export type JsonResume = {
  basics?: any
  work?: any[]
  volunteer?: any[]
  education?: any[]
  awards?: any[]
  certificates?: any[]
  publications?: any[]
  skills?: any[]
  languages?: any[]
  interests?: any[]
  references?: any[]
  projects?: any[]
}

export interface CandidateProfile {
  strengths: string[]
  weaknesses: string[]
  skills: string[]
  companies: string[]
  experience_years: number
  salary_range_min: number
  salary_range_max: number
  industry_tags: string[]
  role_tags: string[]
}

export interface JobMatch {
  match_score: number
  match_reasons: string[]
}

export class LLMAnalysisService {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  }

  // Robust JSON parsing helper to handle code fences or extra text
  private parseJsonResponse(raw: string): any {
    try {
      return JSON.parse(raw)
    } catch (_e) {
      // Strip markdown fences like ```json ... ```
      const fenceMatch = raw.match(/```(?:json)?[\r\n]+([\s\S]*?)```/i)
      const candidate = fenceMatch ? fenceMatch[1] : raw
      try {
        return JSON.parse(candidate)
      } catch (_e2) {
        // Extract the first balanced JSON object as a last resort
        const start = candidate.indexOf('{')
        const end = candidate.lastIndexOf('}')
        if (start !== -1 && end !== -1 && end > start) {
          const slice = candidate.slice(start, end + 1)
          try {
            return JSON.parse(slice)
          } catch (_e3) {
            // Try to fix truncated JSON by adding missing closing brackets
            try {
              const fixedJson = this.fixTruncatedJson(slice)
              return JSON.parse(fixedJson)
            } catch (_e4) {
              console.log('❌ Failed to parse JSON slice:', slice.substring(0, 200) + '...')
              return {}
            }
          }
        }
        console.log('❌ No valid JSON found in response:', raw.substring(0, 200) + '...')
        return {}
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
          model: 'gpt-4o-mini',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt + ' Return ONLY valid JSON without code fences.' }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 6000,
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
      console.debug('[LLMAnalysis] File uploaded to OpenAI:', fileId)

      // Use the file in chat completion
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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
          temperature: 0.2,
          max_tokens: 2000,
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
  async generateCombinedProfileFromFile(file: File): Promise<{ enhancedProfile: any, jsonResume: JsonResume }> {
    try {
      console.debug('[LLMAnalysis] generateCombinedProfileFromFile start', { fileName: file.name, fileType: file.type })
      
      // Create a combined prompt that asks for both formats
      const combinedPrompt = `Please analyze the attached resume file and extract comprehensive candidate information.

Return your response as a JSON object with two main sections:

1. "enhancedProfile": Extract candidate profile information for job matching including:
   - work_auth: { citizen_or_pr: boolean, ep_needed: boolean, work_permit_type: string }
   - seniority_level: string (Junior/Mid/Senior/Lead/Manager/Director)
   - current_title: string
   - target_titles: string[]
   - experience_years: number
   - skills: [{ name: string, level: number (1-5), last_used: string, evidence: string }]
   - education: [{ degree: string, major: string, institution: string, grad_year: number }]
   - certifications: [{ name: string, issuer: string, date: string }]
   - industries: string[]
   - company_tiers: string[] (MNC/GLC/SME/Educational Institution)
   - salary_expect: { min: number, max: number, currency: string }
   - work_prefs: { remote: string, job_type: string }
   - intent: { target_industries: string[], must_have: string[], nice_to_have: string[], blacklist_companies: string[] }

2. "jsonResume": Extract information in JSON Resume format including:
   - basics: { name, email, phone, location, summary, profiles }
   - work: [{ company, position, startDate, endDate, summary, highlights }]
   - education: [{ institution, area, studyType, startDate, endDate, gpa }]
   - awards: [{ title, date, awarder, summary }]
   - certificates: [{ name, date, issuer, url }]
   - publications: [{ name, publisher, releaseDate, url, summary }]
   - skills: [{ name, level, keywords }]
   - languages: [{ language, fluency }]
   - interests: [{ name, keywords }]
   - references: [{ name, reference }]
   - projects: [{ name, description, highlights, keywords, startDate, endDate, url, roles }]

IMPORTANT DATE FORMAT REQUIREMENTS:
- All dates must be in YYYY-MM-DD format (e.g., "2020-02-01", "2015-09-01")
- For "Present" or current positions, use today's date in YYYY-MM-DD format
- For partial dates like "2015-07", convert to "2015-07-01"
- For year-only dates like "2019", convert to "2019-01-01"
- For "last_used" in skills, use YYYY-MM format (e.g., "2023-12")

Return ONLY valid JSON without code fences.`

      const response = await this.callOpenAIWithFile(file, combinedPrompt, SYSTEM_PROMPTS.resumeAnalysis)
      const parsed = this.parseJsonResponse(response)
      
      console.debug('[LLMAnalysis] generateCombinedProfileFromFile done', { 
        enhancedKeys: Object.keys(parsed.enhancedProfile || {}),
        jsonResumeKeys: Object.keys(parsed.jsonResume || {})
      })
      
      return {
        enhancedProfile: parsed.enhancedProfile || {},
        jsonResume: parsed.jsonResume || {}
      }
    } catch (error) {
      console.error('Generate combined profile from file failed:', error)
      return { enhancedProfile: {}, jsonResume: {} }
    }
  }

  // Legacy: Generate enhanced candidate profile from file
  async generateEnhancedProfileFromFile(file: File): Promise<any> {
    try {
      console.debug('[LLMAnalysis] generateEnhancedProfileFromFile start', { fileName: file.name, fileType: file.type })
      
      const prompt = RESUME_ANALYSIS_PROMPTS.enhancedProfile.replace('{resumeText}', 'Please analyze the attached resume file and extract comprehensive candidate profile information.')
      const response = await this.callOpenAIWithFile(file, prompt, SYSTEM_PROMPTS.resumeAnalysis)
      const parsed = this.parseJsonResponse(response)
      
      console.debug('[LLMAnalysis] generateEnhancedProfileFromFile done', { keys: Object.keys(parsed) })
      return parsed
    } catch (error) {
      console.error('Generate enhanced profile from file failed:', error)
      return {}
    }
  }

  // Legacy: Generate JSON Resume object from file
  async generateResumeJsonFromFile(file: File): Promise<JsonResume> {
    try {
      console.debug('[LLMAnalysis] generateResumeJsonFromFile start', { fileName: file.name, fileType: file.type })
      
      const prompt = RESUME_ANALYSIS_PROMPTS.jsonResume.replace('{resumeText}', 'Please analyze the attached resume file and extract all information into the JSON Resume format.')
      const response = await this.callOpenAIWithFile(file, prompt, SYSTEM_PROMPTS.resumeAnalysis)
      const parsed = this.parseJsonResponse(response)
      
      console.debug('[LLMAnalysis] generateResumeJsonFromFile done', { keys: Object.keys(parsed) })
      return parsed as JsonResume
    } catch (error) {
      console.error('Generate JSON Resume from file failed:', error)
      return {}
    }
  }


  // Legacy: Generate JSON Resume object from text (for fallback)
  async generateResumeJson(resumeText: string): Promise<JsonResume> {
    try {
      const prompt = RESUME_ANALYSIS_PROMPTS.jsonResume.replace('{resumeText}', resumeText)
      const response = await this.callOpenAI(prompt, SYSTEM_PROMPTS.resumeAnalysis)
      const parsed = this.parseJsonResponse(response)
      return parsed as JsonResume
    } catch (error) {
      console.error('Generate JSON Resume failed:', error)
      return {}
    }
  }

  /**
   * Analyze resume for strengths and weaknesses
   */
  async analyzeStrengthsWeaknesses(resumeText: string): Promise<{
    strengths: string[]
    weaknesses: string[]
  }> {
    try {
      const prompt = RESUME_ANALYSIS_PROMPTS.strengthsWeaknesses.replace('{resumeText}', resumeText)
      const response = await this.callOpenAI(prompt, SYSTEM_PROMPTS.resumeAnalysis)
      
      const parsed = this.parseJsonResponse(response)
      return {
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || []
      }
    } catch (error) {
      console.error('Strengths/weaknesses analysis failed:', error)
      // Return fallback data
      return {
        strengths: ['Strong technical background', 'Good communication skills', 'Team player'],
        weaknesses: ['Limited leadership experience', 'Could improve project management', 'Needs more industry-specific knowledge']
      }
    }
  }

  /**
   * Analyze suitable salary range
   */
  async analyzeSalaryRange(resumeText: string): Promise<{
    salary_min: number
    salary_max: number
    reasoning: string
  }> {
    try {
      const prompt = RESUME_ANALYSIS_PROMPTS.salaryRange.replace('{resumeText}', resumeText)
      const response = await this.callOpenAI(prompt, SYSTEM_PROMPTS.resumeAnalysis)
      
      const parsed = this.parseJsonResponse(response)
      return {
        salary_min: parsed.salary_min || 5000,
        salary_max: parsed.salary_max || 10000,
        reasoning: parsed.reasoning || 'Based on experience and skills'
      }
    } catch (error) {
      console.error('Salary analysis failed:', error)
      // Return fallback data
      return {
        salary_min: 5000,
        salary_max: 10000,
        reasoning: 'Default range based on general market rates'
      }
    }
  }

  /**
   * Extract profile tags and information
   */
  async extractProfileTags(resumeText: string): Promise<{
    skills: string[]
    companies: string[]
    experience_years: number
    industry_tags: string[]
    role_tags: string[]
  }> {
    try {
      const prompt = RESUME_ANALYSIS_PROMPTS.profileTags.replace('{resumeText}', resumeText)
      const response = await this.callOpenAI(prompt, SYSTEM_PROMPTS.resumeAnalysis)
      
      const parsed = this.parseJsonResponse(response)
      return {
        skills: parsed.skills || [],
        companies: parsed.companies || [],
        experience_years: parsed.experience_years || 0,
        industry_tags: parsed.industry_tags || [],
        role_tags: parsed.role_tags || []
      }
    } catch (error) {
      console.error('Profile tags extraction failed:', error)
      // Return fallback data
      return {
        skills: ['Communication', 'Problem Solving', 'Teamwork'],
        companies: ['Previous Employer'],
        experience_years: 2,
        industry_tags: ['Technology'],
        role_tags: ['Software Developer']
      }
    }
  }

  /**
   * Complete resume analysis
   */
  async analyzeResume(resumeText: string): Promise<CandidateProfile> {
    try {
      // Run all analyses in parallel
      const [strengthsWeaknesses, salaryRange, profileTags] = await Promise.all([
        this.analyzeStrengthsWeaknesses(resumeText),
        this.analyzeSalaryRange(resumeText),
        this.extractProfileTags(resumeText)
      ])

      return {
        strengths: strengthsWeaknesses.strengths,
        weaknesses: strengthsWeaknesses.weaknesses,
        skills: profileTags.skills,
        companies: profileTags.companies,
        experience_years: profileTags.experience_years,
        salary_range_min: salaryRange.salary_min,
        salary_range_max: salaryRange.salary_max,
        industry_tags: profileTags.industry_tags,
        role_tags: profileTags.role_tags
      }
    } catch (error) {
      console.error('Complete resume analysis failed:', error)
      throw new Error(`Resume analysis failed: ${error}`)
    }
  }

  /**
   * Batch analyze multiple jobs for a candidate
   */
  async batchAnalyzeJobs(
    candidateSummary: string,
    jobSummaries: Array<{ id: number; job: any; stage1_score: number; stage1_reasons: string[] }>
  ): Promise<{
    job_analyses: Array<{
      final_score: number
      matching_reasons: string[]
      non_matching_points: string[]
      key_highlights: string[]
      personalized_assessment: string
      career_impact: string
    }>
  }> {
    const jobDetails = jobSummaries.map(job => `
Job ${job.id}: ${job.job.title} at ${job.job.company}
- Location: ${job.job.location}
- Salary: $${job.job.salary_low?.toLocaleString()} - $${job.job.salary_high?.toLocaleString()}
- Industry: ${job.job.industry}
- Experience Level: ${job.job.experience_level}
- Job Type: ${job.job.job_type}
- Post Date: ${job.job.post_date}
- URL: ${job.job.url || 'N/A'}
- Job Category: ${job.job.job_category || 'N/A'}

FULL JOB DESCRIPTION:
${job.job.job_description || job.job.raw_text || 'No description available'}

- Stage 1 Score: ${job.stage1_score}/100
- Stage 1 Reasons: ${job.stage1_reasons.join(', ')}
`).join('\n')

    const prompt = `Analyze these jobs for the candidate:

${candidateSummary}

JOBS:
${jobDetails}

IMPORTANT: Pay special attention to education levels. If the candidate has a PhD, Doctorate, or Doctoral degree, this is the HIGHEST level of education and should be recognized as such. PhD holders are highly qualified for most positions.

ANALYSIS REQUIREMENTS:
- Read the FULL job description carefully to understand specific requirements, responsibilities, and qualifications
- Consider the candidate's exact background, skills, experience, and education level
- Analyze how well the candidate's profile matches the job requirements
- Consider career progression opportunities and growth potential
- Evaluate company culture fit based on job description and company information

Return JSON with job_analyses array containing exactly ${jobSummaries.length} items. Each item needs:
- final_score: 0-100 (consider PhD as highest qualification, analyze full job requirements)
- matching_reasons: array of 2-3 specific reasons why this job fits THIS candidate (be specific about skills, experience, education)
- non_matching_points: array of 1-2 specific concerns or gaps (reference actual job requirements)
- key_highlights: array of 2-3 key things about this job that matter for this candidate (growth, learning, impact)
- personalized_assessment: 2-3 sentences explaining why this job is good/bad for THIS specific candidate (reference their background)
- career_impact: 2-3 sentences about how this role would advance their career (be specific about progression)

Be specific and personalized. Consider the candidate's exact background, education level, and experience. Return ONLY valid JSON.`

    try {
      const response = await this.callOpenAI(prompt, 'You are an expert career advisor who provides detailed, personalized job analysis. Always respond with valid JSON format as requested.')
      console.log('🔍 Raw LLM response:', response.substring(0, 500) + '...')
      
      const parsed = this.parseJsonResponse(response)
      console.log('🔍 Parsed response keys:', Object.keys(parsed))
      
      if (!parsed.job_analyses || !Array.isArray(parsed.job_analyses)) {
        console.log('❌ Invalid response format. Expected job_analyses array, got:', parsed)
        throw new Error('Invalid LLM response format')
      }

      return parsed
    } catch (error) {
      console.error('Batch job analysis failed:', error)
      console.log('🔄 Falling back to mock response...')
      
      // Return fallback data
      return {
        job_analyses: jobSummaries.map((job, index) => ({
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
