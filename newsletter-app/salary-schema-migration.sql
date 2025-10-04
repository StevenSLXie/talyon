-- Migration: Add salary expectation fields to candidate_basics table
-- Run this in your Supabase SQL Editor

-- Add salary expectation fields to candidate_basics table
ALTER TABLE candidate_basics 
ADD COLUMN IF NOT EXISTS salary_expect_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_expect_max INTEGER,
ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'SGD';

-- Add other missing enhanced profile fields
ALTER TABLE candidate_basics 
ADD COLUMN IF NOT EXISTS work_auth JSONB,
ADD COLUMN IF NOT EXISTS seniority_level TEXT,
ADD COLUMN IF NOT EXISTS current_title TEXT,
ADD COLUMN IF NOT EXISTS target_titles TEXT[],
ADD COLUMN IF NOT EXISTS industries TEXT[],
ADD COLUMN IF NOT EXISTS company_tiers TEXT[],
ADD COLUMN IF NOT EXISTS work_prefs JSONB,
ADD COLUMN IF NOT EXISTS intent JSONB,
ADD COLUMN IF NOT EXISTS profile_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS extraction_meta JSONB;

-- Create indexes for salary matching
CREATE INDEX IF NOT EXISTS idx_candidate_basics_salary_min ON candidate_basics(salary_expect_min);
CREATE INDEX IF NOT EXISTS idx_candidate_basics_salary_max ON candidate_basics(salary_expect_max);

-- Add comments for documentation
COMMENT ON COLUMN candidate_basics.salary_expect_min IS 'Minimum salary expectation in SGD';
COMMENT ON COLUMN candidate_basics.salary_expect_max IS 'Maximum salary expectation in SGD';
COMMENT ON COLUMN candidate_basics.salary_currency IS 'Currency for salary expectations (default: SGD)';
COMMENT ON COLUMN candidate_basics.work_auth IS 'Work authorization status (citizen_or_pr, ep_needed, work_permit_type)';
COMMENT ON COLUMN candidate_basics.seniority_level IS 'Seniority level (Junior, Mid, Senior, Lead, etc.)';
COMMENT ON COLUMN candidate_basics.current_title IS 'Current job title';
COMMENT ON COLUMN candidate_basics.target_titles IS 'Array of target job titles';
COMMENT ON COLUMN candidate_basics.industries IS 'Array of industries worked in';
COMMENT ON COLUMN candidate_basics.company_tiers IS 'Array of company tiers (Startup, MNC, etc.)';
COMMENT ON COLUMN candidate_basics.work_prefs IS 'Work preferences (remote, job_type)';
COMMENT ON COLUMN candidate_basics.intent IS 'Career intent (target_industries, must_have, nice_to_have, blacklist_companies)';
COMMENT ON COLUMN candidate_basics.profile_version IS 'Version of the enhanced profile schema';
COMMENT ON COLUMN candidate_basics.extraction_meta IS 'Metadata about profile extraction (method, timestamp)';
