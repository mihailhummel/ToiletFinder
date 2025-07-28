-- Setup script for missing tables in Supabase
-- Run this in your Supabase SQL Editor

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    toilet_id TEXT NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    toilet_id TEXT NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create toilet_reports table
CREATE TABLE IF NOT EXISTS toilet_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    toilet_id TEXT NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_toilet_id ON reviews(toilet_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_toilet_id ON reports(toilet_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);

CREATE INDEX IF NOT EXISTS idx_toilet_reports_toilet_id ON toilet_reports(toilet_id);
CREATE INDEX IF NOT EXISTS idx_toilet_reports_user_id ON toilet_reports(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE toilet_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reviews
CREATE POLICY "Reviews are viewable by everyone" ON reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reviews" ON reviews
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own reviews" ON reviews
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own reviews" ON reviews
    FOR DELETE USING (user_id = auth.uid()::text);

-- Create RLS policies for reports
CREATE POLICY "Reports are viewable by everyone" ON reports
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reports" ON reports
    FOR INSERT WITH CHECK (true);

-- Create RLS policies for toilet_reports
CREATE POLICY "Toilet reports are viewable by everyone" ON toilet_reports
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own toilet reports" ON toilet_reports
    FOR INSERT WITH CHECK (true);

-- Add unique constraints to prevent duplicate reviews/reports
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_toilet_review 
ON reviews(user_id, toilet_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_toilet_report 
ON reports(user_id, toilet_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_toilet_report_not_exists 
ON toilet_reports(user_id, toilet_id);

-- Verify tables were created
SELECT 'reviews' as table_name, COUNT(*) as row_count FROM reviews
UNION ALL
SELECT 'reports' as table_name, COUNT(*) as row_count FROM reports
UNION ALL
SELECT 'toilet_reports' as table_name, COUNT(*) as row_count FROM toilet_reports; 