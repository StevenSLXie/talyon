// LLM-powered action suggestions for job matching
import 'server-only'
import { llmAnalysisService } from './llm-analysis'
import type { CandidateProfile, JobRecommendation } from './job-matching'

export interface ActionSuggestion {
  type: 'skill_gap' | 'experience_gap' | 'education_gap' | 'certification_gap' | 'interview_prep'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  timeline: string
  resources: string[]
  specific_actions: string[]
}

export interface PersonalizedSuggestions {
  skill_gaps: ActionSuggestion[]
  experience_gaps: ActionSuggestion[]
  education_gaps: ActionSuggestion[]
  certification_gaps: ActionSuggestion[]
  interview_prep: ActionSuggestion[]
  overall_strategy: string
}

export class LLMActionSuggestionsService {
  /**
   * Generate personalized action suggestions using LLM
   */
  static async generatePersonalizedSuggestions(
    candidateProfile: CandidateProfile,
    jobRecommendation: JobRecommendation,
    gapsAndActions: GapAnalysis
  ): Promise<PersonalizedSuggestions> {
    try {
      const prompt = this.buildActionSuggestionsPrompt(candidateProfile, jobRecommendation, gapsAndActions)
      
      const response = await llmAnalysisService.callOpenAI(
        prompt,
        `You are an expert career coach specializing in the Singapore job market. You provide actionable, personalized advice to help candidates bridge gaps and succeed in their job applications. Always respond in valid JSON format as requested.`
      )

      const suggestions = llmAnalysisService.parseJsonResponse(response)
      
      return {
        skill_gaps: suggestions.skill_gaps || [],
        experience_gaps: suggestions.experience_gaps || [],
        education_gaps: suggestions.education_gaps || [],
        certification_gaps: suggestions.certification_gaps || [],
        interview_prep: suggestions.interview_prep || [],
        overall_strategy: suggestions.overall_strategy || 'Focus on your strengths and address key gaps systematically.'
      }
    } catch (error) {
      console.error('Failed to generate personalized suggestions:', error)
      return this.getFallbackSuggestions(gapsAndActions)
    }
  }

  /**
   * Build prompt for action suggestions
   */
  private static buildActionSuggestionsPrompt(
    candidateProfile: CandidateProfile,
    jobRecommendation: JobRecommendation,
    gapsAndActions: GapAnalysis
  ): string {
    return `
    Analyze this job match and provide personalized action suggestions for the candidate.
    
    Candidate Profile:
    - Experience: ${candidateProfile.experience_years} years
    - Skills: ${candidateProfile.skills?.map(skill => `${skill.name} (Level ${skill.level ?? 3})`).join(', ') || 'Not specified'}
    - Education: ${candidateProfile.education?.map(edu => `${edu.study_type || edu.degree || 'Degree'} in ${edu.area || edu.major || 'Specialization'}`).join(', ') || 'Not specified'}
    - Work Auth: ${candidateProfile.work_auth?.citizen_or_pr ? 'Citizen/PR' : 'EP needed'}
    
    Job Details:
    - Title: ${jobRecommendation.job.title}
    - Company: ${jobRecommendation.job.company}
    - Salary: $${jobRecommendation.job.salary_low}-$${jobRecommendation.job.salary_high}
    - Match Score: ${jobRecommendation.match_score}%
    
    Identified Gaps:
    - Skill Gaps: ${gapsAndActions.skill_gaps?.map(gap => `${gap.skill} (need ${gap.required_level}, have ${gap.current_level})`).join(', ') || 'None'}
    - Experience Gap: ${gapsAndActions.experience_gap ? `${gapsAndActions.experience_gap.gap_years} years` : 'None'}
    - Education Gaps: ${gapsAndActions.education_gaps?.map(gap => gap.requirement).join(', ') || 'None'}
    - Certification Gaps: ${gapsAndActions.certification_gaps?.map(gap => gap.requirement).join(', ') || 'None'}
    
    Provide personalized action suggestions in this JSON format:
    {
      "skill_gaps": [
        {
          "type": "skill_gap",
          "title": "Improve [Skill Name]",
          "description": "Detailed explanation of why this skill is important for the role",
          "priority": "high|medium|low",
          "timeline": "1-3 months|3-6 months|6+ months",
          "resources": ["Specific courses", "Practice projects", "Certifications"],
          "specific_actions": ["Action 1", "Action 2", "Action 3"]
        }
      ],
      "experience_gaps": [
        {
          "type": "experience_gap",
          "title": "Bridge Experience Gap",
          "description": "How to address experience shortage",
          "priority": "high|medium|low",
          "timeline": "Immediate|1-3 months|3-6 months",
          "resources": ["Volunteer work", "Side projects", "Freelance"],
          "specific_actions": ["Action 1", "Action 2"]
        }
      ],
      "education_gaps": [
        {
          "type": "education_gap",
          "title": "Address Education Requirements",
          "description": "Education gap analysis and solutions",
          "priority": "high|medium|low",
          "timeline": "6+ months|1-2 years",
          "resources": ["Online courses", "Certifications", "Bootcamps"],
          "specific_actions": ["Action 1", "Action 2"]
        }
      ],
      "certification_gaps": [
        {
          "type": "certification_gap",
          "title": "Obtain Required Certifications",
          "description": "Certification requirements and paths",
          "priority": "high|medium|low",
          "timeline": "1-6 months|6+ months",
          "resources": ["Official training", "Study materials", "Practice exams"],
          "specific_actions": ["Action 1", "Action 2"]
        }
      ],
      "interview_prep": [
        {
          "type": "interview_prep",
          "title": "Interview Preparation Strategy",
          "description": "Specific interview prep based on match analysis",
          "priority": "high|medium|low",
          "timeline": "1-2 weeks|2-4 weeks",
          "resources": ["Company research", "Practice questions", "Portfolio prep"],
          "specific_actions": ["Action 1", "Action 2", "Action 3"]
        }
      ],
      "overall_strategy": "Comprehensive strategy for this job application"
    }
    
    Guidelines:
    - Focus on Singapore-specific resources and opportunities
    - Consider the candidate's current level and realistic timelines
    - Prioritize actions that will have the biggest impact on match score
    - Provide specific, actionable steps
    - Consider cost-effective options for skill development
    - Include both immediate and long-term strategies
    `
  }

  /**
   * Fallback suggestions when LLM fails
   */
  private static getFallbackSuggestions(gapsAndActions: GapAnalysis): PersonalizedSuggestions {
    const suggestions: PersonalizedSuggestions = {
      skill_gaps: [],
      experience_gaps: [],
      education_gaps: [],
      certification_gaps: [],
      interview_prep: [],
      overall_strategy: 'Focus on addressing identified gaps systematically.'
    }

    // Generate basic suggestions from gaps
    if (gapsAndActions.skill_gaps?.length > 0) {
      suggestions.skill_gaps = gapsAndActions.skill_gaps.map(gap => ({
        type: 'skill_gap' as const,
        title: `Improve ${gap.skill}`,
        description: `Bridge the gap between your current level (${gap.current_level}) and required level (${gap.required_level})`,
        priority: gap.required_level - gap.current_level > 2 ? 'high' : 'medium' as const,
        timeline: gap.required_level - gap.current_level > 2 ? '3-6 months' : '1-3 months',
        resources: ['Online courses', 'Practice projects', 'Certifications'],
        specific_actions: [gap.action, 'Practice regularly', 'Build portfolio projects']
      }))
    }

    if (gapsAndActions.experience_gap) {
      suggestions.experience_gaps = [{
        type: 'experience_gap' as const,
        title: 'Bridge Experience Gap',
        description: `Address the ${gapsAndActions.experience_gap.gap_years} year experience gap`,
        priority: 'medium' as const,
        timeline: '3-6 months',
        resources: ['Volunteer work', 'Side projects', 'Freelance opportunities'],
        specific_actions: [gapsAndActions.experience_gap.action, 'Highlight transferable skills', 'Seek mentorship']
      }]
    }

    // Add interview prep
    suggestions.interview_prep = [{
      type: 'interview_prep' as const,
      title: 'Interview Preparation',
      description: 'Prepare for technical and behavioral interviews',
      priority: 'high' as const,
      timeline: '1-2 weeks',
      resources: ['Company research', 'Practice questions', 'Portfolio preparation'],
      specific_actions: ['Research company culture', 'Practice technical questions', 'Prepare STAR examples']
    }]

    return suggestions
  }

  /**
   * Generate skill-specific learning path
   */
  static async generateSkillLearningPath(skillName: string, currentLevel: number, targetLevel: number): Promise<{
    learning_path: string[]
    resources: string[]
    timeline: string
    milestones: string[]
  }> {
    try {
      const prompt = `
      Create a detailed learning path for improving ${skillName} from level ${currentLevel} to level ${targetLevel}.
      
      Skill: ${skillName}
      Current Level: ${currentLevel}/5
      Target Level: ${targetLevel}/5
      
      Return JSON format:
      {
        "learning_path": ["Step 1", "Step 2", "Step 3"],
        "resources": ["Resource 1", "Resource 2", "Resource 3"],
        "timeline": "X weeks/months",
        "milestones": ["Milestone 1", "Milestone 2", "Milestone 3"]
      }
      
      Focus on Singapore-available resources and practical applications.
      `

      const response = await llmAnalysisService.callOpenAI(
        prompt,
        'You are an expert technical mentor specializing in skill development for the Singapore job market.'
      )

      return llmAnalysisService.parseJsonResponse(response)
    } catch (error) {
      console.error('Failed to generate skill learning path:', error)
      return {
        learning_path: [`Study ${skillName} fundamentals`, `Practice ${skillName} projects`, `Build ${skillName} portfolio`],
        resources: ['Online courses', 'Documentation', 'Practice projects'],
        timeline: '2-4 weeks',
        milestones: ['Complete basics', 'Build project', 'Portfolio ready']
      }
    }
  }
}
