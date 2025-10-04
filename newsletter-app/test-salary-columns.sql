-- Test query to check if salary columns exist in candidate_basics table
-- Run this in your Supabase SQL Editor to verify the migration was applied

-- Check if salary columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'candidate_basics' 
AND column_name IN ('salary_expect_min', 'salary_expect_max', 'salary_currency')
ORDER BY column_name;

-- If the above returns no rows, the migration wasn't applied
-- If it returns 3 rows, the columns exist but there might be another issue

-- Also check the latest data in candidate_basics
SELECT user_id, resume_id, salary_expect_min, salary_expect_max, salary_currency, created_at
FROM candidate_basics 
WHERE user_id = 'edbfd527-7ff3-44e3-9f66-3d9c397b6662'
ORDER BY created_at DESC 
LIMIT 5;
