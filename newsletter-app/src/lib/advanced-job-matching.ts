// Advanced Two-Stage Job Recommendation System
import { JobMatchingService, CandidateProfile, JobRecommendation } from './job-matching'
import { llmAnalysisService } from './llm-analysis'
import { EnhancedCandidateProfileService } from './enhanced-candidate-profile'

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

interface Stage1JobSummary {
  id: number
  job: JobRecommendation['job']
  stage1_score: number
  stage1_reasons: string[]
}

interface LLMJobAnalysis {
  final_score: number
  matching_reasons: string[]
  non_matching_points: string[]
  key_highlights: string[]
  personalized_assessment: string
  career_impact: string
}

interface LLMJobAnalysisResponse {
  job_analyses: LLMJobAnalysis[]
}

export class AdvancedJobMatchingService {
  private jobMatchingService = new JobMatchingService()

  /**
   * Two-Stage Job Recommendation System
   * Stage 1: Coarse ranking using rules-based scoring (top 20 jobs)
   * Stage 2: LLM-powered fine ranking with detailed analysis
   */
  /**
   * Get two-stage recommendations with enhanced profile JSON string for Stage 2
   */
  async getTwoStageRecommendationsWithEnhanced(
    candidateProfile: CandidateProfile,
    enhancedProfileJson: string,
    limit: number = 5,
    userId?: string
  ): Promise<AdvancedJobRecommendation[]> {
    try {
      console.info('🚀 Starting Two-Stage Job Recommendation System')
      const stage1Start = Date.now()
      
      // Stage 1: Coarse Ranking - Get top 20 jobs using current logic
      console.info('📊 Stage 1: Coarse ranking (rules-based)')
      const stage1Limit = Math.max(limit * 4, 20)
      const stage1Recommendations = await this.jobMatchingService.getEnhancedRecommendations(
        candidateProfile,
        stage1Limit,
        userId
      )

      if (stage1Recommendations.length === 0) {
        console.warn('❌ No jobs passed Stage 1 filtering')
        return []
      }

      console.info('✅ Stage 1 complete', {
        count: stage1Recommendations.length,
        durationMs: Date.now() - stage1Start,
        shortlist: stage1Recommendations.map((rec, index) => `${index + 1}. ${rec.job?.company || 'Unknown'} – ${rec.job?.title || 'Untitled'}`)
      })

      // Stage 2: Fine Ranking - LLM analysis of top jobs using enhanced profile JSON
      console.info('🤖 Stage 2: Fine ranking (LLM-powered)')
      const stage2Start = Date.now()
      const stage2Recommendations = await this.performLLMFineRankingWithEnhanced(
        enhancedProfileJson,
        stage1Recommendations,
        limit
      )

      console.info('✅ Stage 2 complete', {
        count: stage2Recommendations.length,
        durationMs: Date.now() - stage2Start
      })
      return stage2Recommendations
      
    } catch (error) {
      console.error('❌ Two-stage recommendation failed:', error)
      throw error
    }
  }

  /**
   * Stage 2: LLM-powered fine ranking with enhanced profile JSON
   * Analyzes enhanced profile JSON + 20 jobs in a single LLM call
   */
  private async performLLMFineRankingWithEnhanced(
    enhancedProfileJson: string,
    stage1Jobs: JobRecommendation[],
    limit: number
  ): Promise<AdvancedJobRecommendation[]> {
    try {
      // Prepare job summaries for LLM
      const jobSummaries: Stage1JobSummary[] = stage1Jobs.map((rec, index) => ({
        id: index + 1,
        job: rec.job,
        stage1_score: rec.match_score,
        stage1_reasons: rec.match_reasons
      }))

      // Call LLM for batch analysis with enhanced profile JSON
      const llmStart = Date.now()
      const llmAnalysis = await this.callLLMForBatchAnalysis(enhancedProfileJson, jobSummaries)
      console.info('[Timing] Stage 2 LLM batch analysis (ms)', Date.now() - llmStart)

      // Process LLM results and create final recommendations
      const finalRecommendations: AdvancedJobRecommendation[] = stage1Jobs
        .slice(0, llmAnalysis.job_analyses.length)
        .map((stage1Rec, index) => {
          const llmResult = llmAnalysis.job_analyses[index]

          return {
            ...stage1Rec,
            stage1_score: stage1Rec.match_score,
            stage2_score: llmResult.final_score,
            match_score: llmResult.final_score,
            llm_analysis: {
              final_score: llmResult.final_score,
              matching_reasons: llmResult.matching_reasons,
              non_matching_points: llmResult.non_matching_points,
              key_highlights: llmResult.key_highlights,
              personalized_assessment: llmResult.personalized_assessment,
              career_impact: llmResult.career_impact
            }
          }
        })

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
    const educationText = candidateProfile.education && candidateProfile.education.length > 0 
      ? candidateProfile.education.map((educationItem) => {
          const degree = educationItem.study_type || educationItem.degree || 'Degree'
          const major = educationItem.area || educationItem.major || 'Unknown'
          const institution = educationItem.institution || 'Unknown Institution'
          return `${degree} in ${major} from ${institution}`
        }).join(', ')
      : 'Not specified'

    const summary = `
CANDIDATE PROFILE:
- Experience: ${candidateProfile.experience_years} years
- Current/Previous Titles: ${candidateProfile.titles.join(', ')}
- Key Skills: ${candidateProfile.skills.map(skill => skill.name).join(', ')}
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
    enhancedProfileJson: string,
    jobSummaries: Stage1JobSummary[]
  ): Promise<LLMJobAnalysisResponse> {
    const enhancedProfile = JSON.parse(enhancedProfileJson) as Record<string, unknown>
    
    try {
      console.debug('🤖 Calling LLM for job analysis...')

      // Use the new batch analysis method
      const response = await llmAnalysisService.batchAnalyzeJobs(enhancedProfile, jobSummaries)

      console.debug('✅ LLM API call successful')

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
    limit: number = 5
  ): Promise<AdvancedJobRecommendation[]> {
    try {
      // Get enhanced profile from database
      const enhancedProfile = await EnhancedCandidateProfileService.getEnhancedProfile(userId)
      
      if (!enhancedProfile) {
        console.warn('[AdvancedJobMatching] No enhanced profile found, falling back to legacy method')
        // Fallback to legacy method
        const candidateProfile = await this.jobMatchingService.buildCandidateProfile(userId)
        return await this.getTwoStageRecommendationsWithEnhanced(candidateProfile, JSON.stringify(candidateProfile), limit, userId)
      }

      // Build candidate profile for Stage 1
      const candidateProfile = await this.jobMatchingService.buildCandidateProfile(userId)
      
      // Get two-stage recommendations with enhanced profile JSON string for Stage 2
      return await this.getTwoStageRecommendationsWithEnhanced(candidateProfile, JSON.stringify(enhancedProfile), limit, userId)
      
    } catch (error) {
      console.error('Enhanced job recommendations failed:', error)
      throw error
    }
  }
}

// Singleton instance
export const advancedJobMatchingService = new AdvancedJobMatchingService()
