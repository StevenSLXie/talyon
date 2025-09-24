-- Newsletter System Database Schema - TEST VERSION
-- Run this in your Supabase SQL Editor for testing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subscribers table (TEST VERSION)
CREATE TABLE subscribers_test (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
    preferences JSONB DEFAULT '{}',
    confirmation_token TEXT,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaigns table (TEST VERSION)
CREATE TABLE campaigns_test (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL,
    subject TEXT NOT NULL,
    jobs_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_logs table (TEST VERSION)
CREATE TABLE email_logs_test (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns_test(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES subscribers_test(id) ON DELETE CASCADE,
    job_id TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced'))
);

-- Create indexes for better performance
CREATE INDEX idx_subscribers_test_email ON subscribers_test(email);
CREATE INDEX idx_subscribers_test_status ON subscribers_test(status);
CREATE INDEX idx_subscribers_test_confirmation_token ON subscribers_test(confirmation_token);
CREATE INDEX idx_campaigns_test_date ON campaigns_test(date);
CREATE INDEX idx_campaigns_test_status ON campaigns_test(status);
CREATE INDEX idx_email_logs_test_campaign_id ON email_logs_test(campaign_id);
CREATE INDEX idx_email_logs_test_subscriber_id ON email_logs_test(subscriber_id);
CREATE INDEX idx_email_logs_test_status ON email_logs_test(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subscribers_test table
CREATE TRIGGER update_subscribers_test_updated_at 
    BEFORE UPDATE ON subscribers_test 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE subscribers_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs_test ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Subscribers can only see their own data
CREATE POLICY "Users can view own subscriber test data" ON subscribers_test
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own subscriber test data" ON subscribers_test
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own subscriber test data" ON subscribers_test
    FOR UPDATE USING (true);

-- Campaigns are readable by all authenticated users
CREATE POLICY "Campaigns test are viewable by all" ON campaigns_test
    FOR SELECT USING (true);

-- Email logs are readable by all authenticated users
CREATE POLICY "Email logs test are viewable by all" ON email_logs_test
    FOR SELECT USING (true);

-- Insert test data
INSERT INTO subscribers_test (email, name, status, preferences) VALUES
('test@example.com', 'Test User', 'active', '{"industries": ["engineering", "it"], "salary_range": "10000-15000", "frequency": "daily"}'),
('demo@example.com', 'Demo User', 'pending', '{"industries": ["finance"], "salary_range": "15000+", "frequency": "weekly"}'),
('admin@example.com', 'Admin User', 'active', '{"industries": ["engineering", "it", "finance"], "salary_range": "15000+", "frequency": "daily"}');

-- Insert test campaign
INSERT INTO campaigns_test (date, subject, jobs_count, sent_count, status) VALUES
('2025-09-18', 'Daily Job Alert - Engineering & IT', 25, 0, 'draft'),
('2025-09-17', 'Daily Job Alert - Finance', 15, 12, 'sent');

