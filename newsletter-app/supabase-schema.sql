-- Newsletter System Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subscribers table
CREATE TABLE subscribers (
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

-- Create campaigns table
CREATE TABLE campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL,
    subject TEXT NOT NULL,
    jobs_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_logs table
CREATE TABLE email_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
    job_id TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced'))
);

-- Create indexes for better performance
CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE INDEX idx_subscribers_status ON subscribers(status);
CREATE INDEX idx_subscribers_confirmation_token ON subscribers(confirmation_token);
CREATE INDEX idx_campaigns_date ON campaigns(date);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_email_logs_campaign_id ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_subscriber_id ON email_logs(subscriber_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subscribers table
CREATE TRIGGER update_subscribers_updated_at 
    BEFORE UPDATE ON subscribers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Subscribers can only see their own data
CREATE POLICY "Users can view own subscriber data" ON subscribers
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own subscriber data" ON subscribers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own subscriber data" ON subscribers
    FOR UPDATE USING (true);

-- Campaigns are readable by all authenticated users
CREATE POLICY "Campaigns are viewable by all" ON campaigns
    FOR SELECT USING (true);

-- Email logs are readable by all authenticated users
CREATE POLICY "Email logs are viewable by all" ON email_logs
    FOR SELECT USING (true);

-- Insert some sample data for testing
INSERT INTO subscribers (email, name, status, preferences) VALUES
('test@example.com', 'Test User', 'active', '{"industries": ["engineering", "it"], "salary_range": "10000-15000", "frequency": "daily"}'),
('demo@example.com', 'Demo User', 'pending', '{"industries": ["finance"], "salary_range": "15000+", "frequency": "weekly"}');
