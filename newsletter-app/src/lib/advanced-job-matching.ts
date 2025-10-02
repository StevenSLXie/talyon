// Advanced Two-Stage Job Recommendation System
import { supabase } from './supabase'
import { JobMatchingService, CandidateProfile, JobRecommendation } from './job-matching'
import { llmAnalysisService } from './llm-analysis'

export interface AdvancedJobRecommendation extends JobRecommendation {
  llm_analysis: {
    final_score: number
    matching_reasons: string[]
    non_matching_points: string[]
    key_highlights: string[]
    personalized_assessment: string
    career_impact: string
  }
  stage1_score: number
  stage2_score: number
}

export class AdvancedJobMatchingService {
  private jobMatchingService = new JobMatchingService()

  /**
   * Two-Stage Job Recommendation System
   * Stage 1: Coarse ranking using rules-based scoring (top 20 jobs)
   * Stage 2: LLM-powered fine ranking with detailed analysis
   */
  async getTwoStageRecommendations(
    candidateProfile: CandidateProfile,
    limit: number = 3,
    userId?: string
  ): Promise<AdvancedJobRecommendation[]> {
    try {
      console.log('🚀 Starting Two-Stage Job Recommendation System')
      
      // Stage 1: Coarse Ranking - Get top 20 jobs using current logic
      console.log('📊 Stage 1: Coarse ranking (rules-based)')
      const stage1Recommendations = await this.jobMatchingService.getEnhancedRecommendations(
        candidateProfile,
        20, // Get top 20 for fine ranking
        userId
      )

      if (stage1Recommendations.length === 0) {
        console.log('❌ No jobs passed Stage 1 filtering')
        return []
      }

      console.log(`✅ Stage 1 complete: ${stage1Recommendations.length} jobs selected`)

      // Stage 2: Fine Ranking - LLM analysis of top 20 jobs
      console.log('🤖 Stage 2: Fine ranking (LLM-powered)')
      const stage2Recommendations = await this.performLLMFineRanking(
        candidateProfile,
        stage1Recommendations,
        limit
      )

      console.log(`✅ Stage 2 complete: ${stage2Recommendations.length} final recommendations`)
      return stage2Recommendations

    } catch (error) {
      console.error('❌ Two-stage recommendation failed:', error)
      throw error
    }
  }

  /**
   * Stage 2: LLM-powered fine ranking
   * Analyzes resume + 20 jobs in a single LLM call
   */
  private async performLLMFineRanking(
    candidateProfile: CandidateProfile,
    stage1Jobs: JobRecommendation[],
    limit: number
  ): Promise<AdvancedJobRecommendation[]> {
    try {
      // Prepare candidate summary for LLM
      const candidateSummary = this.buildCandidateSummary(candidateProfile)
      
      // Prepare job summaries for LLM
      const jobSummaries = stage1Jobs.map((rec, index) => ({
        id: index + 1,
        job: rec.job,
        stage1_score: rec.match_score,
        stage1_reasons: rec.match_reasons
      }))

      // Call LLM for batch analysis
      const llmAnalysis = await this.callLLMForBatchAnalysis(candidateProfile, jobSummaries)

      // Process LLM results and create final recommendations
      const finalRecommendations: AdvancedJobRecommendation[] = []

      for (let i = 0; i < Math.min(stage1Jobs.length, llmAnalysis.job_analyses.length); i++) {
        const stage1Rec = stage1Jobs[i]
        const llmResult = llmAnalysis.job_analyses[i]

        const advancedRec: AdvancedJobRecommendation = {
          ...stage1Rec,
          stage1_score: stage1Rec.match_score,
          stage2_score: llmResult.final_score,
          match_score: llmResult.final_score, // Use LLM score as final score
          llm_analysis: {
            final_score: llmResult.final_score,
            matching_reasons: llmResult.matching_reasons,
            non_matching_points: llmResult.non_matching_points,
            key_highlights: llmResult.key_highlights,
            personalized_assessment: llmResult.personalized_assessment,
            career_impact: llmResult.career_impact
          }
        }

        finalRecommendations.push(advancedRec)
      }

      // Sort by LLM score and return top recommendations
      return finalRecommendations
        .sort((a, b) => b.llm_analysis.final_score - a.llm_analysis.final_score)
        .slice(0, limit)

    } catch (error) {
      console.error('❌ LLM fine ranking failed:', error)
      // Fallback to Stage 1 results
      return stage1Jobs.slice(0, limit).map(rec => ({
        ...rec,
        stage1_score: rec.match_score,
        stage2_score: rec.match_score,
        llm_analysis: {
          final_score: rec.match_score,
          matching_reasons: rec.match_reasons,
          non_matching_points: ['LLM analysis unavailable'],
          key_highlights: ['Job matches your profile'],
          personalized_assessment: 'Analysis based on rule-based matching',
          career_impact: 'Consider this opportunity based on your current profile'
        }
      }))
    }
  }

  /**
   * Build candidate summary for LLM analysis
   */
  private buildCandidateSummary(candidateProfile: CandidateProfile): string {
    const educationText = candidateProfile.education?.length > 0 
      ? candidateProfile.education.map(e => {
          // Handle different degree formats
          const degree = e.study_type || e.degree || 'Degree'
          const major = e.area || e.major || 'Unknown'
          const institution = e.institution || 'Unknown Institution'
          return `${degree} in ${major} from ${institution}`
        }).join(', ')
      : 'Not specified'

    const summary = `
CANDIDATE PROFILE:
- Experience: ${candidateProfile.experience_years} years
- Current/Previous Titles: ${candidateProfile.titles.join(', ')}
- Key Skills: ${candidateProfile.skills.map(s => s.name).join(', ')}
- Industries: ${candidateProfile.industries.join(', ')}
- Salary Range: $${candidateProfile.salary_range_min?.toLocaleString()} - $${candidateProfile.salary_range_max?.toLocaleString()}
- Education: ${educationText}
- Work Preferences: ${candidateProfile.work_prefs ? `${candidateProfile.work_prefs.remote} work, ${candidateProfile.work_prefs.job_type} position` : 'Not specified'}
- Work Authorization: ${candidateProfile.work_auth ? (candidateProfile.work_auth.citizen_or_pr ? 'Citizen/PR' : 'Needs EP') : 'Not specified'}
`

    return summary.trim()
  }

  /**
   * Call LLM for batch analysis of multiple jobs
   */
  private async callLLMForBatchAnalysis(
    candidateProfile: CandidateProfile,
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
    // Build comprehensive candidate profile for LLM
    const educationText = candidateProfile.education?.length > 0 
      ? candidateProfile.education.map(e => {
          const degree = e.study_type || e.degree || 'Degree'
          const major = e.area || e.major || 'Unknown'
          const institution = e.institution || 'Unknown Institution'
          return `${degree} in ${major} from ${institution}`
        }).join(', ')
      : 'Not specified'

    const candidateProfileText = `
CANDIDATE PROFILE:
- Experience: ${candidateProfile.experience_years} years
- Current/Previous Titles: ${candidateProfile.titles.join(', ')}
- Key Skills: ${candidateProfile.skills.map(s => s.name).join(', ')}
- Industries: ${candidateProfile.industries.join(', ')}
- Salary Range: $${candidateProfile.salary_range_min?.toLocaleString()} - $${candidateProfile.salary_range_max?.toLocaleString()}
- Education: ${educationText}
- Work Preferences: ${candidateProfile.work_prefs ? `${candidateProfile.work_prefs.remote} work, ${candidateProfile.work_prefs.job_type} position` : 'Not specified'}
- Work Authorization: ${candidateProfile.work_auth ? (candidateProfile.work_auth.citizen_or_pr ? 'Citizen/PR' : 'Needs EP') : 'Not specified'}
- Company Tiers: ${candidateProfile.company_tiers?.join(', ') || 'Not specified'}
- Certifications: ${candidateProfile.certifications?.map(c => c.name).join(', ') || 'None'}
`

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

${candidateProfileText}

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
      console.log('🤖 Calling LLM for job analysis...')

      // Use the new batch analysis method
      const response = await llmAnalysisService.batchAnalyzeJobs(candidateProfileText, jobSummaries)

      console.log('✅ LLM API call successful')

      return response

    } catch (error) {
      console.error('❌ LLM analysis failed:', error)
      throw error
    }
  }

  /**
   * Get job recommendations with enhanced analysis
   */
  async getEnhancedJobRecommendations(
    userId: string,
    limit: number = 3
  ): Promise<AdvancedJobRecommendation[]> {
    try {
      // Build candidate profile
      const candidateProfile = await this.jobMatchingService.buildCandidateProfile(userId)
      
      // Get two-stage recommendations
      return await this.getTwoStageRecommendations(candidateProfile, limit, userId)
      
    } catch (error) {
      console.error('Enhanced job recommendations failed:', error)
      throw error
    }
  }
}

// Singleton instance
export const advancedJobMatchingService = new AdvancedJobMatchingService()
