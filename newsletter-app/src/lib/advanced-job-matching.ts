// Advanced Two-Stage Job Recommendation System
import { supabase } from './supabase'
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
      console.log('🚀 Starting Two-Stage Job Recommendation System')
      
      // Stage 1: Coarse Ranking - Get top 20 jobs using current logic
      console.log('📊 Stage 1: Coarse ranking (rules-based)')
      const stage1Recommendations = await this.jobMatchingService.getEnhancedRecommendations(
        candidateProfile,
        20,
        userId
      )

      if (stage1Recommendations.length === 0) {
        console.log('❌ No jobs passed Stage 1 filtering')
        return []
      }

      console.log('✅ Stage 1 complete:', stage1Recommendations.length, 'jobs selected')
      console.log(
        '📋 Stage 1 shortlist:',
        stage1Recommendations.map((rec, index) => `${index + 1}. ${rec.job?.company || 'Unknown'} – ${rec.job?.title || 'Untitled'}`)
      )

      // Stage 2: Fine Ranking - LLM analysis of top jobs using enhanced profile JSON
      console.log('🤖 Stage 2: Fine ranking (LLM-powered)')
      const stage2Recommendations = await this.performLLMFineRankingWithEnhanced(
        enhancedProfileJson,
        stage1Recommendations,
        5
      )

      console.log(`✅ Stage 2 complete: ${stage2Recommendations.length} final recommendations`)
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
      const jobSummaries = stage1Jobs.map((rec, index) => ({
        id: index + 1,
        job: rec.job,
        stage1_score: rec.match_score,
        stage1_reasons: rec.match_reasons
      }))

      // Call LLM for batch analysis with enhanced profile JSON
      const llmAnalysis = await this.callLLMForBatchAnalysis(enhancedProfileJson, jobSummaries)

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
    const educationText = candidateProfile.education && candidateProfile.education.length > 0 
      ? candidateProfile.education.map((e: any) => {
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
- Key Skills: ${candidateProfile.skills.map((s: any) => s.name).join(', ')}
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
    // Parse the enhanced profile JSON to get the object
    const enhancedProfile = JSON.parse(enhancedProfileJson)
    
    try {
      console.log('🤖 Calling LLM for job analysis...')

      // Use the new batch analysis method
      const response = await llmAnalysisService.batchAnalyzeJobs(enhancedProfile, jobSummaries)

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
    limit: number = 5
  ): Promise<AdvancedJobRecommendation[]> {
    try {
      // Get enhanced profile from database
      const enhancedProfile = await EnhancedCandidateProfileService.getEnhancedProfile(userId)
      
      if (!enhancedProfile) {
        console.log('[AdvancedJobMatching] No enhanced profile found, falling back to legacy method')
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
