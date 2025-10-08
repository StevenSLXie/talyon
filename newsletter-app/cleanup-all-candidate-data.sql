-- Clean up ALL candidate-related data
-- Run this in your Supabase SQL Editor
-- WARNING: This will permanently delete all candidate data!

-- Delete all candidate data tables (order matters due to foreign keys)
DELETE FROM candidate_awards;
DELETE FROM candidate_certificates;
DELETE FROM candidate_education;
DELETE FROM candidate_interests;
DELETE FROM candidate_languages;
DELETE FROM candidate_profiles_social;
DELETE FROM candidate_projects;
DELETE FROM candidate_publications;
DELETE FROM candidate_references;
DELETE FROM candidate_skills;
DELETE FROM candidate_volunteer;
DELETE FROM candidate_work;
DELETE FROM candidate_basics;

-- Delete job recommendations and matches
DELETE FROM job_recommendations;
DELETE FROM matches;

-- Delete resumes (this will cascade delete related candidate data if ON DELETE CASCADE is set)
DELETE FROM resumes;

-- Optional: Delete saved jobs and applications if you want a complete reset
-- Uncomment these lines if you want to delete user job interactions as well
-- DELETE FROM saved_jobs;
-- DELETE FROM job_applications;

-- Verify the cleanup - all counts should be 0
SELECT 'candidate_awards' as table_name, COUNT(*) as record_count FROM candidate_awards
UNION ALL
SELECT 'candidate_basics', COUNT(*) FROM candidate_basics
UNION ALL
SELECT 'candidate_certificates', COUNT(*) FROM candidate_certificates
UNION ALL
SELECT 'candidate_education', COUNT(*) FROM candidate_education
UNION ALL
SELECT 'candidate_interests', COUNT(*) FROM candidate_interests
UNION ALL
SELECT 'candidate_languages', COUNT(*) FROM candidate_languages
UNION ALL
SELECT 'candidate_profiles_social', COUNT(*) FROM candidate_profiles_social
UNION ALL
SELECT 'candidate_projects', COUNT(*) FROM candidate_projects
UNION ALL
SELECT 'candidate_publications', COUNT(*) FROM candidate_publications
UNION ALL
SELECT 'candidate_references', COUNT(*) FROM candidate_references
UNION ALL
SELECT 'candidate_skills', COUNT(*) FROM candidate_skills
UNION ALL
SELECT 'candidate_volunteer', COUNT(*) FROM candidate_volunteer
UNION ALL
SELECT 'candidate_work', COUNT(*) FROM candidate_work
UNION ALL
SELECT 'resumes', COUNT(*) FROM resumes
UNION ALL
SELECT 'job_recommendations', COUNT(*) FROM job_recommendations
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
ORDER BY table_name;

-- All counts should be 0 after cleanup
