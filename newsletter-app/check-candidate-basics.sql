-- Check candidate_basics table job_family field
-- Run this in Supabase SQL Editor

-- Check candidate_basics table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'candidate_basics' 
AND column_name IN ('job_family', 'current_title', 'user_id')
ORDER BY column_name;

-- Check sample data from candidate_basics
SELECT user_id, current_title, job_family, created_at
FROM candidate_basics 
WHERE user_id = 'edbfd527-7ff3-44e3-9f66-3d9c397b6662'
ORDER BY created_at DESC 
LIMIT 5;

-- Count candidates with job_family field
SELECT 
  COUNT(*) as total_candidates,
  COUNT(job_family) as candidates_with_family,
  COUNT(*) - COUNT(job_family) as candidates_without_family
FROM candidate_basics;
