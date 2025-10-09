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

Return ONLY valid JSON without code fences.`
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
1. DISCIPLINE ALIGNMENT (40 points baseline) - Core role function match
2. SKILL MATCH + JOB SCOPE (60 points baseline) - Required skills vs candidate proficiency + job scope alignment
3. SALARY PENALTY (penalty only) - Apply penalties for jobs below candidate expectations

SCORING GUIDELINES:
- Discipline alignment = 40 points baseline
  * Perfect same-discipline: +40 (Software Engineer → Software Developer)
  * Adjacent disciplines: +20~30 (Software Engineer → Data Analyst)
  * Cross-discipline: 0–10 (Software Engineer → Finance Manager)
- Skill match + Job scope = 60 points baseline
  * >80% skill overlap + good scope match: +50–60 (most required skills match + appropriate job scope)
  * 50–80% skill overlap + moderate scope: +30–40 (some required skills match + reasonable scope)
  * <50% skill overlap + poor scope: +0–20 (few required skills match + mismatched scope)
- Salary penalty (subtract from total)
  * Within expectation: 0 penalty
  * Slightly below (10-20%): -5 to -10 points
  * Significantly below (>20%): -15 to -25 points
- Leadership level mismatch: -10 points penalty

Sum discipline + skill/scope scores, then subtract penalties for final_score (0–100).

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

LEADERSHIP MATCH RULES:
- If candidate's leadership level is not explicitly stated, assume they are IC unless otherwise inferred from the profile
- Never output null or uncertain; must return true or false
- Infer candidate leadership from: management experience, team size, direct reports count
- Apply -10 points penalty only for clear mismatches (e.g., IC candidate for Team Lead++ role)

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