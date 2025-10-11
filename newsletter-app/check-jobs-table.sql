-- Check if jobs table has job_family field
-- Run this in Supabase SQL Editor

-- Check jobs table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('job_family', 'title', 'company', 'location')
ORDER BY column_name;

-- Check sample data from jobs table
SELECT id, title, company, job_family, created_at
FROM jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Count jobs with job_family field
SELECT 
  COUNT(*) as total_jobs,
  COUNT(job_family) as jobs_with_family,
  COUNT(*) - COUNT(job_family) as jobs_without_family
FROM jobs;
