# Singapore Job Matcher

A targeted job matching platform that analyzes resumes and provides personalized job recommendations instead of generic job alerts.

## Features

- **Resume Upload**: Upload PDF/DOCX resumes for analysis
- **AI-Powered Analysis**: Extract skills, experience, strengths, and weaknesses
- **Smart Job Matching**: Get personalized job recommendations based on your profile
- **Targeted Approach**: Stop sending the same resume to 100 companies

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1

# Resend Configuration (for email login)
RESEND_API_KEY=your_resend_api_key
```

### 2. Database Setup

1. Run the database schema in your Supabase SQL Editor:
   ```bash
   # Copy and paste the contents of supabase-resume-schema.sql
   ```

2. Create a storage bucket for resumes:
   ```sql
   INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
   ```

3. Set up storage policies:
   ```sql
   CREATE POLICY "Users can upload resumes" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'resumes');
   
   CREATE POLICY "Users can view own resumes" ON storage.objects
   FOR SELECT USING (bucket_id = 'resumes');
   ```

### 3. Populate Jobs Database

Run the script to populate jobs from the consolidated JSON file:

```bash
cd scripts
node populate-jobs-from-json.js
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/           # Email-based authentication
│   │   ├── jobs/           # Job-related endpoints
│   │   └── resume/         # Resume upload and analysis
│   ├── dashboard/          # User dashboard
│   └── jobs/               # Job listing pages
├── components/
│   ├── ResumeUpload.tsx    # Resume upload component
│   ├── JobRecommendations.tsx # Job recommendations display
│   └── ...                 # Other UI components
└── lib/
    ├── prompts.ts          # LLM prompt templates
    ├── resume-parser.ts    # Resume parsing utilities
    ├── llm-analysis.ts     # LLM analysis service
    └── job-matching.ts     # Job matching algorithm
```

## Key Components

### Resume Analysis Flow

1. **Upload**: User uploads PDF/DOCX resume
2. **Parse**: Extract text from resume file
3. **Analyze**: LLM analyzes resume for:
   - Strengths and weaknesses
   - Skills and experience
   - Salary expectations
   - Industry tags
4. **Match**: Compare profile against job database
5. **Recommend**: Return top 3 matching jobs

### Job Matching Algorithm

- **LLM-based matching**: Uses OpenAI to analyze job-candidate compatibility
- **Fallback matching**: Simple keyword and criteria-based matching
- **Scoring**: 0-100 match score with detailed reasons

## API Endpoints

- `POST /api/resume/upload` - Upload and analyze resume
- `POST /api/jobs/recommendations` - Get job recommendations
- `GET /api/jobs` - List all jobs
- `POST /api/auth/send-code` - Send login code
- `POST /api/auth/verify-code` - Verify login code

## Development Notes

- Resume parsing currently uses placeholder text extraction
- In production, implement proper PDF/DOCX parsing with libraries like `pdf-parse` and `mammoth`
- LLM prompts are stored in separate template files as per requirements
- All database operations use Supabase with proper RLS policies

## Future Improvements

- Implement proper PDF/DOCX parsing
- Add more sophisticated job matching algorithms
- Add user preferences and saved jobs
- Implement job application tracking
- Add email notifications for new matching jobs