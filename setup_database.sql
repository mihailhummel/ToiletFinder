-- SQL script to set up the database tables in Supabase
-- Run this in your Supabase SQL editor

-- Create toilets table
CREATE TABLE IF NOT EXISTS toilets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  notes TEXT,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  added_by_user_name TEXT,
  osm_id TEXT,
  tags JSONB,
  report_count INTEGER DEFAULT 0 NOT NULL,
  is_removed BOOLEAN DEFAULT FALSE NOT NULL,
  removed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  average_rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0 NOT NULL
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toilet_id TEXT REFERENCES toilets(id) NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toilet_id TEXT REFERENCES toilets(id) NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create toilet_reports table
CREATE TABLE IF NOT EXISTS toilet_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toilet_id TEXT REFERENCES toilets(id) NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_toilets_location ON toilets(lat, lng);
CREATE INDEX IF NOT EXISTS idx_toilets_removed ON toilets(is_removed);
CREATE INDEX IF NOT EXISTS idx_reviews_toilet_id ON reviews(toilet_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_toilet_id ON reports(toilet_id);
CREATE INDEX IF NOT EXISTS idx_toilet_reports_toilet_id ON toilet_reports(toilet_id);

-- Enable Row Level Security (RLS)
ALTER TABLE toilets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE toilet_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to toilets" ON toilets
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to reviews" ON reviews
  FOR SELECT USING (true);

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to insert toilets" ON toilets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert reviews" ON reviews
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert reports" ON reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert toilet_reports" ON toilet_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policy for admin deletion (you'll need to implement this based on your admin system)
-- For now, we'll allow service role to delete
CREATE POLICY "Allow service role to delete toilets" ON toilets
  FOR DELETE USING (auth.role() = 'service_role');

-- Create policy for service role to update toilets
CREATE POLICY "Allow service role to update toilets" ON toilets
  FOR UPDATE USING (auth.role() = 'service_role'); 