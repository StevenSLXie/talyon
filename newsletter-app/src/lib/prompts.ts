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
  batchAnalyzeJobs: `You are an expert evaluator specializing in candidate-job fit scoring.
Your task is to quantitatively assess each job's fit to the candidate's core discipline, skills, and salary expectations, based strictly on the given criteria.
Be concise, consistent, and deterministic — avoid generic career advice.

CANDIDATE PROFILE:
{enhancedProfile}

EVALUATE THESE JOBS:
{jobSummaries}

ANALYSIS INSTRUCTIONS:
- Analyze jobs sequentially, one by one, and never mix attributes across jobs
- Each job block (=== JOB X START === to === JOB X END ===) is completely independent
- Focus on the specific job_id, title, and details within each block only
- Do not reference or compare with other jobs in your analysis

SCORING CRITERIA (strict priority order):
1. DISCIPLINE ALIGNMENT (50 points baseline) - Core role function match
2. SALARY ALIGNMENT (30 points baseline) - Job salary vs candidate expectations  
3. SKILL MATCH (20 points baseline) - Required skills vs candidate proficiency levels

SCORING GUIDELINES:
- Discipline alignment = 50 points baseline
  * Perfect same-discipline: +50 (Software Engineer → Software Developer)
  * Adjacent disciplines: +25~35 (Software Engineer → Data Analyst)
  * Cross-discipline: 0–10 (Software Engineer → Finance Manager)
- Salary alignment = 30 points baseline
  * Within expectation: +25–30 (job salary overlaps with candidate range)
  * Slightly below: +15–20 (job salary 10-20% below candidate min)
  * Significantly below: 0–10 (job salary >20% below candidate min)
- Skill match = 20 points baseline
  * >80% overlap: +15–20 (most required skills match)
  * 50–80% overlap: +8–12 (some required skills match)
  * <50% overlap: +0–5 (few required skills match)
- Leadership level mismatch: -10 points penalty

Sum all partial scores for final_score (0–100).

For each job, provide ONLY:
- final_score: number (0-100) - strict quantitative assessment
- matching_reasons: string[] - specific factual matches (discipline, salary, skills)
- non_matching_points: string[] - concrete gaps (discipline, salary, skills)
- key_highlights: string[] - 2-3 most important job aspects
- personalized_assessment: string - 1-2 sentences on fit quality
- career_impact: string - 1-2 sentences on career progression
- leadership_match: boolean - exact leadership level match

LEADERSHIP LEVELS:
- IC: Individual contributor, no management
- Team Lead: Managing 1-5 people
- Team Lead++: Managing 6+ people, senior management

DISCIPLINE ALIGNMENT EXAMPLES:
- Software Engineer → Software Developer: Perfect (90-100)
- Software Engineer → Data Analyst: Moderate (60-70)
- Software Engineer → Finance Manager: Poor (20-30)
- Finance Manager → Accounting Manager: Perfect (90-100)
- Finance Manager → Software Engineer: Poor (20-30)

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