-- Migration: Add job_family field to jobs table
-- Run this in Supabase SQL Editor

-- Add job_family field to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS job_family TEXT;

-- Create index for job family matching
CREATE INDEX IF NOT EXISTS idx_jobs_job_family ON jobs(job_family);

-- Add comment for documentation
COMMENT ON COLUMN jobs.job_family IS 'Job family category: Engineering|IT|Finance|Marketing|Operations|Sales|HR|Other';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name = 'job_family';

-- Check current jobs data
SELECT COUNT(*) as total_jobs, COUNT(job_family) as jobs_with_family
FROM jobs;
