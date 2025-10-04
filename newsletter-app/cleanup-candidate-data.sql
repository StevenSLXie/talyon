-- Clean up all candidate data to start fresh with salary columns
-- Run this in your Supabase SQL Editor

-- Delete all candidate data (this will clear old records without salary columns)
DELETE FROM candidate_basics;
DELETE FROM candidate_skills;
DELETE FROM candidate_education;
DELETE FROM candidate_certificates;
DELETE FROM candidate_work;
DELETE FROM candidate_awards;
DELETE FROM candidate_publications;
DELETE FROM candidate_languages;
DELETE FROM candidate_interests;
DELETE FROM candidate_references;
DELETE FROM candidate_projects;
DELETE FROM candidate_profiles_social;
DELETE FROM candidate_volunteer;

-- Verify the cleanup
SELECT 'candidate_basics' as table_name, COUNT(*) as record_count FROM candidate_basics
UNION ALL
SELECT 'candidate_skills', COUNT(*) FROM candidate_skills
UNION ALL
SELECT 'candidate_education', COUNT(*) FROM candidate_education
UNION ALL
SELECT 'candidate_certificates', COUNT(*) FROM candidate_certificates
UNION ALL
SELECT 'candidate_work', COUNT(*) FROM candidate_work
UNION ALL
SELECT 'candidate_awards', COUNT(*) FROM candidate_awards
UNION ALL
SELECT 'candidate_publications', COUNT(*) FROM candidate_publications
UNION ALL
SELECT 'candidate_languages', COUNT(*) FROM candidate_languages
UNION ALL
SELECT 'candidate_interests', COUNT(*) FROM candidate_interests
UNION ALL
SELECT 'candidate_references', COUNT(*) FROM candidate_references
UNION ALL
SELECT 'candidate_projects', COUNT(*) FROM candidate_projects
UNION ALL
SELECT 'candidate_profiles_social', COUNT(*) FROM candidate_profiles_social
UNION ALL
SELECT 'candidate_volunteer', COUNT(*) FROM candidate_volunteer;

-- All counts should be 0 after cleanup
