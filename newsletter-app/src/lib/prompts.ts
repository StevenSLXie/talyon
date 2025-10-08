// LLM Prompt Templates
// All LLM prompts should be kept in this separate templates file

export const RESUME_ANALYSIS_PROMPTS = {
  combinedProfile: `Analyze this resume and extract information in TWO formats:

1. "enhancedProfile": Extract detailed candidate profile including:
   - titles: string[] (job titles they've held)
   - skills: [{ name: string, level: number (1-5), last_used: string, evidence: string }]
   - education: [{ degree: string, major: string, institution: string, grad_year: number }]
   - certifications: [{ name: string, issuer: string, date: string }]
   - industries: string[]
   - company_tiers: string[] (MNC/GLC/SME/Educational Institution)
   - salary_expect: { min: number, max: number, currency: string }
   - work_prefs: { remote: string, job_type: string }
   - intent: { target_industries: string[], must_have: string[], nice_to_have: string[], blacklist_companies: string[] }
   - leadership_level: "IC" | "Team Lead" | "Team Lead++" (analyze management experience)
   - management_experience: {
       has_management: boolean,
       direct_reports_count: number,
       team_size_range: string,
       management_years: number,
       management_evidence: string[]
     }

2. "jsonResume": Extract information in JSON Resume format including:
   - basics: { name, email, phone, location, summary, profiles }
   - work: [{ name, position, startDate, endDate, summary, highlights }]  (note: use "name" for company name)
   - education: [{ institution, area, studyType, startDate, endDate, gpa }]
   - awards: [{ title, date, awarder, summary }]
   - certificates: [{ name, date, issuer, url }]
   - publications: [{ name, publisher, releaseDate, url, summary }]
   - skills: [{ name, level, keywords }]
   - languages: [{ language, fluency }]
   - interests: [{ name, keywords }]
   - references: [{ name, reference }]
   - projects: [{ name, description, highlights, keywords, startDate, endDate, url, roles }]

LEADERSHIP ANALYSIS GUIDELINES:
- IC (Individual Contributor): No management responsibilities, individual work focus
- Team Lead: Manages 1-5 direct reports, team coordination, some management duties
- Team Lead++: Manages 6+ direct reports, senior management, strategic leadership

Look for evidence of:
- "Managed", "Led", "Supervised", "Directed" teams
- Team size mentions
- Management titles (Manager, Director, VP, etc.)
- Budget responsibilities
- Strategic planning involvement
- Cross-functional leadership

IMPORTANT DATE FORMAT REQUIREMENTS:
- All dates must be in YYYY-MM-DD format (e.g., "2020-02-01", "2015-09-01")
- For "Present" or current positions, use today's date in YYYY-MM-DD format
- For partial dates like "2015-07", convert to "2015-07-01"
- For year-only dates like "2019", convert to "2019-01-01"
- For "last_used" in skills, use YYYY-MM format (e.g., "2023-12")

Return ONLY valid JSON without code fences.`,

  enhancedProfile: `{resumeText}

Extract comprehensive candidate profile information for job matching. Return JSON with:
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
- leadership_level: "IC" | "Team Lead" | "Team Lead++"
- management_experience: { has_management: boolean, direct_reports_count: number, team_size_range: string, management_years: number, management_evidence: string[] }

IMPORTANT DATE FORMAT REQUIREMENTS:
- All dates must be in YYYY-MM-DD format (e.g., "2020-02-01", "2015-09-01")
- For "Present" or current positions, use today's date in YYYY-MM-DD format
- For partial dates like "2015-07", convert to "2015-07-01"
- For year-only dates like "2019", convert to "2019-01-01"
- For "last_used" in skills, use YYYY-MM format (e.g., "2023-12")

Return ONLY valid JSON without code fences.`,

  jsonResume: `{resumeText}

Extract all information into the JSON Resume format. Return JSON with:
- basics: { name, email, phone, location, summary, profiles }
- work: [{ name, position, startDate, endDate, summary, highlights }]  (note: use "name" for company name)
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

Return ONLY valid JSON without code fences.`,

  strengthsWeaknesses: `{resumeText}

Analyze the resume and identify:
- strengths: string[] (3-5 key professional strengths)
- weaknesses: string[] (2-3 areas for improvement)

Return JSON with strengths and weaknesses arrays.`,

  salaryRange: `{resumeText}

Analyze the resume and determine appropriate salary range in Singapore context:
- salary_min: number (minimum expected salary)
- salary_max: number (maximum expected salary)
- reasoning: string (explanation for the range)

Consider experience level, skills, education, and industry. Return JSON format.`,

  profileTags: `{resumeText}

Extract key profile information:
- skills: string[] (technical and soft skills)
- companies: string[] (companies worked for)
- experience_years: number (total years of experience)
- salary_range_min: number (minimum salary expectation)
- salary_range_max: number (maximum salary expectation)
- industry_tags: string[] (industries/sectors)
- role_tags: string[] (job roles/functions)

Return JSON format.`,

  comprehensiveAnalysis: `You are an expert career counselor and talent acquisition specialist analyzing a resume comprehensively.

Analyze the following resume text and provide a complete candidate profile analysis:

Resume text:
{resumeText}

Please provide ALL of the following analysis in a single JSON response:

1. **Strengths and Weaknesses**
2. **Salary Range Analysis** 
3. **Skills and Profile Tags**

Return your response as JSON with this exact structure:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "salary_min": 5000,
  "salary_max": 12000,
  "salary_reasoning": "Brief explanation of the salary range",
  "skills": ["skill1", "skill2", "skill3"],
  "companies": ["company1", "company2"],
  "experience_years": 5,
  "industry_tags": ["industry1", "industry2"],
  "role_tags": ["role1", "role2"]
}

Guidelines:
- For salary analysis, consider Singapore market rates, experience level, education, and industry
- Extract all technical and soft skills mentioned
- Count total years of work experience accurately
- Identify industries and role types from work history
- Be specific and actionable in strengths/weaknesses
- Return ONLY valid JSON without code fences`
}

export const JOB_ANALYSIS_PROMPTS = {
  batchAnalyzeJobs: `You are an expert career advisor analyzing job matches for a candidate. 

CANDIDATE PROFILE:
{enhancedProfile}

ANALYZE THESE JOBS:
{jobSummaries}

For each job, provide:
- final_score: number (0-100) - overall match quality
- matching_reasons: string[] - why this job fits the candidate
- non_matching_points: string[] - potential concerns or gaps
- key_highlights: string[] - 2-3 most important job aspects
- personalized_assessment: string - 2-3 sentences explaining why this job is good/bad for THIS specific candidate
- career_impact: string - 2-3 sentences about how this role would advance their career
- leadership_match: boolean - does the job's leadership level match candidate's experience?

LEADERSHIP LEVEL MATCHING:
- IC roles: Individual contributor positions, no management required
- Team Lead roles: Managing 1-5 people, team coordination
- Team Lead++ roles: Managing 6+ people, senior management, strategic leadership

For jobs without explicit leadership level, infer from:
- Job title keywords (Director, Manager, Lead, etc.)
- Job description mentions of team management
- Responsibilities involving people management

Consider the candidate's leadership_level and match appropriately. Apply penalties for mismatched leadership expectations.

Return ONLY valid JSON in this format:
{
  "job_analyses": [
    {
      "job_id": "string",
      "final_score": number,
      "matching_reasons": ["string"],
      "non_matching_points": ["string"],
      "key_highlights": ["string"],
      "personalized_assessment": "string",
      "career_impact": "string",
      "leadership_match": boolean
    }
  ]
}`
}

export const SYSTEM_PROMPTS = {
  resumeAnalysis: 'You are an expert resume analyst. Extract comprehensive candidate information with special attention to leadership and management experience. Always respond with valid JSON format.',
  jobAnalysis: 'You are an expert career advisor who provides detailed, personalized job analysis. Always respond with valid JSON format as requested.'
}