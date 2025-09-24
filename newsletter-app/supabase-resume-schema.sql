-- Resume-based Job Matching System Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (replacing subscribers)
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create resumes table
CREATE TABLE resumes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT NOT NULL,
    raw_text TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DEPRECATED: candidate_profiles table
-- DROP and replace with candidate_resumes that stores JSON Resume
DROP TABLE IF EXISTS candidate_profiles CASCADE;

-- New: candidate_resumes stores JSON Resume schema object
CREATE TABLE candidate_resumes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    json_resume JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    salary_low INTEGER,
    salary_high INTEGER,
    industry TEXT,
    job_type TEXT,
    experience_level TEXT,
    post_date DATE,
    job_hash TEXT UNIQUE,
    url TEXT,
    job_description TEXT,
    job_category TEXT,
    raw_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_recommendations table
CREATE TABLE job_recommendations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2),
    match_reasons TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_resumes_user_id ON candidate_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_industry ON jobs(industry);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_low ON jobs(salary_low);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_high ON jobs(salary_high);
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_job_recommendations_user_id ON job_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_job_recommendations_match_score ON job_recommendations(match_score);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidate_resumes_updated_at 
    BEFORE UPDATE ON candidate_resumes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (true);

CREATE POLICY "Users can view own resumes" ON resumes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own resumes" ON resumes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own candidate resumes" ON candidate_resumes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own candidate resumes" ON candidate_resumes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own candidate resumes" ON candidate_resumes
    FOR UPDATE USING (true);

CREATE POLICY "Jobs are viewable by all" ON jobs
    FOR SELECT USING (true);

CREATE POLICY "Users can view own recommendations" ON job_recommendations
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own recommendations" ON job_recommendations
    FOR INSERT WITH CHECK (true);

-- FLAT JSON RESUME SCHEMA (unpack JSON into normalized tables)

-- Cleanup previous JSON storage table if exists
DROP TABLE IF EXISTS candidate_resumes CASCADE;

-- Basics (one row per user/resume)
CREATE TABLE IF NOT EXISTS candidate_basics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    name TEXT,
    label TEXT,
    image TEXT,
    email TEXT,
    phone TEXT,
    url TEXT,
    summary TEXT,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country_code TEXT,
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social profiles
CREATE TABLE IF NOT EXISTS candidate_profiles_social (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    network TEXT,
    username TEXT,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work experience
CREATE TABLE IF NOT EXISTS candidate_work (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    company TEXT,
    position TEXT,
    url TEXT,
    start_date DATE,
    end_date DATE,
    summary TEXT,
    highlights TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Volunteer
CREATE TABLE IF NOT EXISTS candidate_volunteer (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    organization TEXT,
    position TEXT,
    url TEXT,
    start_date DATE,
    end_date DATE,
    summary TEXT,
    highlights TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Education
CREATE TABLE IF NOT EXISTS candidate_education (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    institution TEXT,
    url TEXT,
    area TEXT,
    study_type TEXT,
    start_date DATE,
    end_date DATE,
    score TEXT,
    courses TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Awards
CREATE TABLE IF NOT EXISTS candidate_awards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    title TEXT,
    date DATE,
    awarder TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificates
CREATE TABLE IF NOT EXISTS candidate_certificates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    name TEXT,
    date DATE,
    issuer TEXT,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Publications
CREATE TABLE IF NOT EXISTS candidate_publications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    name TEXT,
    publisher TEXT,
    release_date DATE,
    url TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills
CREATE TABLE IF NOT EXISTS candidate_skills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    name TEXT,
    level TEXT,
    keywords TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Languages
CREATE TABLE IF NOT EXISTS candidate_languages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    language TEXT,
    fluency TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interests
CREATE TABLE IF NOT EXISTS candidate_interests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    name TEXT,
    keywords TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- References
CREATE TABLE IF NOT EXISTS candidate_references (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    name TEXT,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS candidate_projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    name TEXT,
    start_date DATE,
    end_date DATE,
    description TEXT,
    highlights TEXT[],
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidate_basics_user ON candidate_basics(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_work_user ON candidate_work(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_education_user ON candidate_education(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_user ON candidate_skills(user_id);

-- Triggers
CREATE TRIGGER update_candidate_basics_updated_at 
    BEFORE UPDATE ON candidate_basics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE candidate_basics ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles_social ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_volunteer ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  PERFORM 1;
  -- Generic simple view policies
  EXECUTE 'CREATE POLICY IF NOT EXISTS "view_basics" ON candidate_basics FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY IF NOT EXISTS "ins_basics" ON candidate_basics FOR INSERT WITH CHECK (true)';
  EXECUTE 'CREATE POLICY IF NOT EXISTS "view_work" ON candidate_work FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY IF NOT EXISTS "ins_work" ON candidate_work FOR INSERT WITH CHECK (true)';
  EXECUTE 'CREATE POLICY IF NOT EXISTS "view_skills" ON candidate_skills FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY IF NOT EXISTS "ins_skills" ON candidate_skills FOR INSERT WITH CHECK (true)';
END $$;
