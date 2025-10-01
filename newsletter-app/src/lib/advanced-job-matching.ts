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
      const llmAnalysis = await this.callLLMForBatchAnalysis(candidateSummary, jobSummaries)

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
    const summary = `
CANDIDATE PROFILE:
- Experience: ${candidateProfile.experience_years} years
- Current/Previous Titles: ${candidateProfile.titles.join(', ')}
- Key Skills: ${candidateProfile.skills.map(s => s.name).join(', ')}
- Industries: ${candidateProfile.industries.join(', ')}
- Salary Range: $${candidateProfile.salary_range_min?.toLocaleString()} - $${candidateProfile.salary_range_max?.toLocaleString()}
- Education: ${candidateProfile.education?.map(e => `${e.study_type} in ${e.area}`).join(', ') || 'Not specified'}
- Work Preferences: ${candidateProfile.work_prefs ? `${candidateProfile.work_prefs.remote} work, ${candidateProfile.work_prefs.job_type} position` : 'Not specified'}
- Work Authorization: ${candidateProfile.work_auth ? (candidateProfile.work_auth.citizen_or_pr ? 'Citizen/PR' : 'Needs EP') : 'Not specified'}
`

    return summary.trim()
  }

  /**
   * Call LLM for batch analysis of multiple jobs
   */
  private async callLLMForBatchAnalysis(
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
- Description: ${job.job.job_description?.substring(0, 500)}...
- Stage 1 Score: ${job.stage1_score}/100
- Stage 1 Reasons: ${job.stage1_reasons.join(', ')}
`).join('\n')

    const prompt = `
You are an expert career advisor analyzing job opportunities for a candidate. 

${candidateSummary}

AVAILABLE JOBS:
${jobDetails}

For EACH job, provide a detailed analysis in this EXACT JSON format:
{
  "job_analyses": [
    {
      "final_score": 85,
      "matching_reasons": ["Strong technical skills match", "Salary expectations aligned", "Career progression opportunity"],
      "non_matching_points": ["Requires 2 more years experience", "Different industry background"],
      "key_highlights": ["Leading tech company", "Remote work option", "Learning opportunities"],
      "personalized_assessment": "This role aligns well with your software engineering background and offers good growth potential. Your Python and React skills are directly applicable.",
      "career_impact": "This position would advance your career by providing leadership experience and exposure to cloud technologies."
    }
  ]
}

IMPORTANT GUIDELINES:
1. Score each job 0-100 based on overall fit for THIS specific candidate
2. Be specific about why each job is good/bad for THIS candidate
3. Highlight 2-3 key things about each job that matter for this candidate
4. Write naturally, like a career advisor explaining opportunities
5. Consider career progression, skill development, and personal fit
6. Provide exactly ${jobSummaries.length} analyses in the array
7. Return ONLY valid JSON, no other text

Analyze each job thoughtfully and provide personalized insights.
`

    try {
      console.log('🤖 Calling LLM for job analysis...')

      // Use the new batch analysis method
      const response = await llmAnalysisService.batchAnalyzeJobs(candidateSummary, jobSummaries)

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
