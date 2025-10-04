-- Migration: Add leadership and management fields to candidate_basics table
-- Run this in your Supabase SQL Editor

-- Add leadership and management fields to candidate_basics table
ALTER TABLE candidate_basics 
ADD COLUMN IF NOT EXISTS leadership_level TEXT CHECK (leadership_level IN ('IC', 'Team Lead', 'Team Lead++')),
ADD COLUMN IF NOT EXISTS has_management BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS direct_reports_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS team_size_range TEXT,
ADD COLUMN IF NOT EXISTS management_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS management_evidence TEXT[];

-- Add leadership level to jobs table for job matching
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS leadership_level TEXT CHECK (leadership_level IN ('IC', 'Team Lead', 'Team Lead++')),
ADD COLUMN IF NOT EXISTS management_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS team_size_mentioned TEXT;

-- Create index for leadership level matching
CREATE INDEX IF NOT EXISTS idx_candidate_basics_leadership ON candidate_basics(leadership_level);
CREATE INDEX IF NOT EXISTS idx_jobs_leadership ON jobs(leadership_level);

-- Add comments for documentation
COMMENT ON COLUMN candidate_basics.leadership_level IS 'Leadership level: IC (Individual Contributor), Team Lead (manages 1-5), Team Lead++ (manages 6+)';
COMMENT ON COLUMN candidate_basics.has_management IS 'Whether candidate has management experience';
COMMENT ON COLUMN candidate_basics.direct_reports_count IS 'Number of direct reports managed';
COMMENT ON COLUMN candidate_basics.team_size_range IS 'Range of team sizes managed (e.g., "1-5", "6-10")';
COMMENT ON COLUMN candidate_basics.management_years IS 'Years of management experience';
COMMENT ON COLUMN candidate_basics.management_evidence IS 'Array of evidence for management experience';

COMMENT ON COLUMN jobs.leadership_level IS 'Required leadership level for the job';
COMMENT ON COLUMN jobs.management_required IS 'Whether management responsibilities are required';
COMMENT ON COLUMN jobs.team_size_mentioned IS 'Team size mentioned in job description';
