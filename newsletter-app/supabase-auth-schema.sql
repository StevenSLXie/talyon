-- Authentication System Database Schema
-- Run this AFTER the main supabase-schema.sql
-- This adds passwordless authentication tables

-- Create login_codes table for 6-digit verification codes
CREATE TABLE login_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL CHECK (LENGTH(code) = 6),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attempts INTEGER DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5)
);

-- Create user_sessions table for JWT session management
CREATE TABLE user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

-- Create user_profiles table for extended user data
CREATE TABLE user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES subscribers(id) ON DELETE CASCADE UNIQUE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    linkedin_url TEXT,
    resume_url TEXT,
    experience_level TEXT CHECK (experience_level IN ('entry', 'mid', 'senior', 'executive')),
    current_salary INTEGER,
    expected_salary INTEGER,
    availability TEXT CHECK (availability IN ('immediate', '2weeks', '1month', '3months', 'flexible')),
    job_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create saved_jobs table for user job interactions
CREATE TABLE saved_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
    job_hash TEXT NOT NULL,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    salary_low INTEGER,
    salary_high INTEGER,
    location TEXT,
    industry TEXT,
    job_type TEXT,
    experience_level TEXT,
    post_date DATE,
    application_url TEXT,
    status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'interviewed', 'rejected', 'offered')),
    applied_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, job_hash)
);

-- Create job_applications table for tracking applications
CREATE TABLE job_applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
    job_hash TEXT NOT NULL,
    application_url TEXT,
    application_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'under_review', 'interview_scheduled', 'interviewed', 'rejected', 'offered', 'accepted', 'withdrawn')),
    notes TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_login_codes_email ON login_codes(email);
CREATE INDEX idx_login_codes_code ON login_codes(code);
CREATE INDEX idx_login_codes_expires_at ON login_codes(expires_at);
CREATE INDEX idx_login_codes_used_at ON login_codes(used_at);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_experience_level ON user_profiles(experience_level);

CREATE INDEX idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX idx_saved_jobs_job_hash ON saved_jobs(job_hash);
CREATE INDEX idx_saved_jobs_status ON saved_jobs(status);
CREATE INDEX idx_saved_jobs_company ON saved_jobs(company);
CREATE INDEX idx_saved_jobs_industry ON saved_jobs(industry);

CREATE INDEX idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX idx_job_applications_job_hash ON job_applications(job_hash);
CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_job_applications_application_date ON job_applications(application_date);

-- Create updated_at trigger for new tables
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_jobs_updated_at 
    BEFORE UPDATE ON saved_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at 
    BEFORE UPDATE ON job_applications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for new tables
ALTER TABLE login_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authentication tables
-- Login codes are only accessible during the login process
CREATE POLICY "Login codes are accessible during login" ON login_codes
    FOR ALL USING (expires_at > NOW() AND used_at IS NULL);

-- User sessions: Allow insert for session creation, restrict other operations
CREATE POLICY "Allow session creation" ON user_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (true); -- Handled by API logic

CREATE POLICY "Users can update own sessions" ON user_sessions
    FOR UPDATE USING (true); -- Handled by API logic

CREATE POLICY "Users can delete own sessions" ON user_sessions
    FOR DELETE USING (true); -- Handled by API logic

-- User profiles are only accessible by the profile owner
CREATE POLICY "Users can manage own profile" ON user_profiles
    FOR ALL USING (user_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

-- Saved jobs are only accessible by the job owner
CREATE POLICY "Users can manage own saved jobs" ON saved_jobs
    FOR ALL USING (user_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

-- Job applications are only accessible by the applicant
CREATE POLICY "Users can manage own applications" ON job_applications
    FOR ALL USING (user_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

-- Create function to clean up expired login codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_login_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM login_codes 
    WHERE expires_at < NOW() OR used_at IS NOT NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample user profile for testing
INSERT INTO user_profiles (user_id, first_name, last_name, experience_level, current_salary, expected_salary, availability, job_preferences) 
SELECT 
    s.id,
    'John',
    'Doe',
    'mid',
    8000,
    12000,
    '1month',
    '{"industries": ["engineering", "it"], "locations": ["Singapore"], "remote_work": true, "company_size": "medium"}'
FROM subscribers s 
WHERE s.email = 'test@example.com';
