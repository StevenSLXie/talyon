# Database Setup Guide

## Step-by-Step Instructions to Write JSON Data to Database

### 1. Prerequisites

Make sure you have:
- Supabase project created
- Environment variables configured
- Node.js installed

### 2. Environment Variables Setup

Create `.env.local` file in the talyon directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration (for LLM analysis)
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1

# Resend Configuration (for email login)
RESEND_API_KEY=your_resend_api_key
```

### 3. Database Schema Setup

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase-resume-schema.sql`
4. Click "Run" to execute the schema

**Option B: Using Command Line**

```bash
# If you have supabase CLI installed
supabase db reset
# Then manually run the schema file
```

### 4. Install Dependencies

```bash
cd talyon
npm install
```

### 5. Run Database Setup Script

```bash
# Run the complete setup script
node scripts/setup-database.js
```

This script will:
- ✅ Create storage bucket for resumes
- ✅ Set up storage policies
- ✅ Clear existing jobs (if any)
- ✅ Import all jobs from `consolidated_jobs_20250921_205754.json`
- ✅ Show progress and summary

### 6. Manual Steps (if needed)

If the automated script doesn't work, you can run these steps manually:

#### A. Create Storage Bucket

In Supabase Dashboard → Storage:
1. Click "New bucket"
2. Name: `resumes`
3. Public: `false`
4. File size limit: `10MB`
5. Allowed MIME types: `application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword`

#### B. Set Storage Policies

In Supabase Dashboard → Storage → Policies:

```sql
-- Policy for uploading resumes
CREATE POLICY "Users can upload resumes" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'resumes');

-- Policy for viewing resumes  
CREATE POLICY "Users can view own resumes" ON storage.objects
FOR SELECT USING (bucket_id = 'resumes');
```

#### C. Import Jobs Data

Run the jobs import script:

```bash
node scripts/populate-jobs-from-json.js
```

### 7. Verify Setup

Check that everything is working:

1. **Database Tables**: Go to Supabase Dashboard → Table Editor
   - Should see: `users`, `resumes`, `candidate_profiles`, `jobs`, `job_recommendations`

2. **Jobs Data**: Check `jobs` table has data
   ```sql
   SELECT COUNT(*) FROM jobs;
   ```

3. **Storage Bucket**: Check `resumes` bucket exists in Storage

### 8. Test the Application

```bash
npm run dev
```

Visit `http://localhost:3000` and test:
- ✅ Resume upload functionality
- ✅ Job recommendations
- ✅ User authentication

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Check `.env.local` file exists
   - Verify all required keys are present

2. **"Jobs file not found"**
   - Ensure `consolidated_jobs_20250921_205754.json` exists in `output/` directory
   - Check file path is correct

3. **"Storage bucket already exists"**
   - This is normal, the script handles it gracefully

4. **Permission errors**
   - Make sure you're using the service role key (not anon key)
   - Check RLS policies are set up correctly

### Manual Verification Queries

```sql
-- Check jobs count
SELECT COUNT(*) as total_jobs FROM jobs;

-- Check jobs by industry
SELECT industry, COUNT(*) as count 
FROM jobs 
GROUP BY industry 
ORDER BY count DESC;

-- Check salary ranges
SELECT 
  CASE 
    WHEN salary_low < 5000 THEN 'Under 5k'
    WHEN salary_low < 10000 THEN '5k-10k'
    WHEN salary_low < 15000 THEN '10k-15k'
    WHEN salary_low < 20000 THEN '15k-20k'
    ELSE '20k+'
  END as salary_range,
  COUNT(*) as count
FROM jobs 
GROUP BY salary_range
ORDER BY count DESC;
```

## Expected Results

After successful setup:
- ✅ ~1,342 jobs imported from JSON file
- ✅ Storage bucket created for resume uploads
- ✅ All database tables created with proper relationships
- ✅ RLS policies configured for security
- ✅ Application ready for resume upload and job matching
