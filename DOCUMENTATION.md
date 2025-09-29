# Enhanced Job Matching System

## Overview
AI-powered job matching platform with detailed analysis, personalized suggestions, and comprehensive candidate profiling.

## Key Features

### 🎯 Enhanced Matching Algorithm
- **Multi-criteria scoring**: Skills (25%), Title (20%), Salary (20%), Experience (15%), Education (10%), Job Family (10%), Work Preferences (5%), Industry (5%)
- **Hard filtering**: Work authorization, blacklisted companies, preferences
- **Detailed explanations**: Why matches work, gaps analysis, action items

### 🤖 LLM-Powered Analysis
- **Job profiling**: Extract structured data from job descriptions
- **Candidate analysis**: Parse resumes into structured profiles
- **Action suggestions**: Personalized improvement recommendations

### 🎨 Rich Frontend
- **Enhanced recommendation cards**: Detailed match breakdowns
- **Advanced filtering**: Score ranges, probability categories
- **Profile management**: Skills, experience, preferences editing

## Architecture

```
Python (Job Profiling) → Supabase (Database) → TypeScript (Matching) → React (Frontend)
```

### Database Schema
- **jobs**: Enhanced job data with structured requirements
- **candidate_***: Structured candidate profiles
- **matches**: Detailed match results with explanations
- **normalization**: Standardized titles, skills, industries

## API Endpoints

### Job Recommendations
```bash
POST /api/jobs/recommendations
{
  "userId": "string",
  "limit": 3
}
```

### Candidate Profile
```bash
GET /api/candidate/profile
PUT /api/candidate/profile
```

## Usage

### 1. Setup Environment
```bash
export SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key
export OPENAI_API_KEY=your_key
```

### 2. Run Migrations
```bash
# Migrate job data
python migrate_jobs.py consolidated_jobs.json

# Migrate candidate profiles
python migrate_candidates.py
```

### 3. Test System
```bash
python test_enhanced_matching.py
```

### 4. Start Application
```bash
npm run dev
```

## Matching Algorithm

### Scoring Components
1. **Skills Match (25%)**: Required/optional skills with levels
2. **Title Match (20%)**: Fuzzy matching with seniority
3. **Salary Match (20%)**: Overlap calculation
4. **Experience Match (15%)**: Years alignment with penalties
5. **Education Match (10%)**: Degree requirements
6. **Job Family Match (10%)**: Functional area alignment
7. **Work Preferences (5%)**: Remote/onsite preferences
8. **Industry Match (5%)**: Industry and company tier

### Hard Filters
- Work authorization requirements
- Blacklisted companies
- Work arrangement preferences
- Minimum salary thresholds

## Job Profiling

### Python Pipeline
```python
# Enhance job with LLM
enhanced_data = await enhance_job_with_llm(job_data)

# Insert structured data
await insert_enhanced_job(job_data, enhanced_data)
await insert_job_skills(job_data, enhanced_data)
```

### Extracted Data
- Company tier (MNC/GLC/SME/Educational)
- Skills with proficiency levels (1-5)
- Experience requirements (min/max years)
- Education and certification requirements
- Remote policy and visa requirements

## Frontend Components

### EnhancedJobRecommendationCard
- Match score with color coding
- Detailed breakdown tabs
- Gap analysis and action items
- LLM-powered suggestions

### CandidateProfileManagement
- Tabbed interface (Overview, Skills, Experience, Education, Preferences)
- Edit mode with validation
- Skills visualization with levels
- Work history tracking

### MatchFilter
- Score range filtering (0-100%)
- Probability categories (High ≥70%, Medium 50-69%, Low <50%)
- Quick filter buttons
- Multiple sorting options

## Testing

### Test Suite Coverage
- ✅ Job profiling pipeline
- ✅ Candidate profile migration
- ✅ Matching algorithm accuracy
- ✅ API endpoint functionality
- ✅ Database schema validation
- ✅ Frontend component rendering

### Run Tests
```bash
python test_enhanced_matching.py
```

## Performance

### Optimization
- Database indexing on key fields
- LLM response caching
- Batch processing for migrations
- Rate limiting for API calls

### Monitoring
- Match accuracy metrics
- API response times
- LLM processing performance
- Data quality indicators

## Migration Scripts

### Job Data Migration
```bash
python migrate_jobs.py consolidated_jobs.json
```

### Candidate Profile Migration
```bash
python migrate_candidates.py
```

Both scripts include:
- LLM enhancement
- Structured data extraction
- Database insertion
- Progress reporting
- Error handling

## Future Enhancements

- Advanced analytics and career tracking
- Machine learning optimization
- LinkedIn integration
- Mobile app development
- Real-time notifications

---

*Complete system ready for production deployment*
