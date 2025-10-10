-- Migration: Add job_family field to candidate_basics table
-- Run this in your Supabase SQL Editor

-- Add job_family field to candidate_basics table
ALTER TABLE candidate_basics 
ADD COLUMN IF NOT EXISTS job_family TEXT;

-- Create index for job family matching
CREATE INDEX IF NOT EXISTS idx_candidate_basics_job_family ON candidate_basics(job_family);

-- Add comment for documentation
COMMENT ON COLUMN candidate_basics.job_family IS 'Primary job family: Engineering|IT|Finance|Marketing|Operations|Sales|HR|Other';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'candidate_basics' 
AND column_name = 'job_family';
