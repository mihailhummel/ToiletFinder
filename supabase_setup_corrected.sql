-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create toilets table with correct schema matching the implementation
CREATE TABLE IF NOT EXISTS toilets (
  id TEXT PRIMARY KEY,
  coordinates JSONB NOT NULL, -- This matches the actual implementation
  type TEXT NOT NULL DEFAULT 'public',
  source TEXT NOT NULL DEFAULT 'user',
  notes TEXT,
  tags JSONB DEFAULT '{}',
  is_removed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index for fast queries
CREATE INDEX IF NOT EXISTS idx_toilets_coordinates 
ON toilets 
USING GIST (ST_SetSRID(ST_MakePoint((coordinates->>'lng')::float, (coordinates->>'lat')::float), 4326));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_toilets_type ON toilets(type);
CREATE INDEX IF NOT EXISTS idx_toilets_source ON toilets(source);
CREATE INDEX IF NOT EXISTS idx_toilets_created_at ON toilets(created_at);
CREATE INDEX IF NOT EXISTS idx_toilets_is_removed ON toilets(is_removed);

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_toilets_in_bounds(double precision, double precision, double precision, double precision);

-- Create spatial query function
CREATE OR REPLACE FUNCTION get_toilets_in_bounds(
  west DOUBLE PRECISION,
  south DOUBLE PRECISION,
  east DOUBLE PRECISION,
  north DOUBLE PRECISION
)
RETURNS TABLE (
  id TEXT,
  coordinates JSONB,
  type TEXT,
  source TEXT,
  notes TEXT,
  tags JSONB,
  is_removed BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.coordinates,
    t.type,
    t.source,
    t.notes,
    t.tags,
    t.is_removed,
    t.created_at,
    t.updated_at
  FROM toilets t
  WHERE 
    t.is_removed = FALSE
    AND ST_Within(
      ST_SetSRID(ST_MakePoint((t.coordinates->>'lng')::float, (t.coordinates->>'lat')::float), 4326),
      ST_MakeEnvelope(west, south, east, north, 4326)
    );
END;
$$;

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  toilet_id TEXT NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  toilet_id TEXT NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create toilet_reports table
CREATE TABLE IF NOT EXISTS toilet_reports (
  id TEXT PRIMARY KEY,
  toilet_id TEXT NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_toilet_id ON reviews(toilet_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);

-- Create indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_toilet_id ON reports(toilet_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Create indexes for toilet_reports
CREATE INDEX IF NOT EXISTS idx_toilet_reports_toilet_id ON toilet_reports(toilet_id);
CREATE INDEX IF NOT EXISTS idx_toilet_reports_user_id ON toilet_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_toilet_reports_created_at ON toilet_reports(created_at);

-- Enable RLS
ALTER TABLE toilets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE toilet_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON toilets;
DROP POLICY IF EXISTS "Allow authenticated insert" ON toilets;
DROP POLICY IF EXISTS "Allow authenticated update" ON toilets;
DROP POLICY IF EXISTS "Allow authenticated delete" ON toilets;

DROP POLICY IF EXISTS "Allow public read access" ON reviews;
DROP POLICY IF EXISTS "Allow authenticated insert" ON reviews;
DROP POLICY IF EXISTS "Allow authenticated update" ON reviews;
DROP POLICY IF EXISTS "Allow authenticated delete" ON reviews;

DROP POLICY IF EXISTS "Allow public read access" ON reports;
DROP POLICY IF EXISTS "Allow authenticated insert" ON reports;
DROP POLICY IF EXISTS "Allow authenticated update" ON reports;
DROP POLICY IF EXISTS "Allow authenticated delete" ON reports;

DROP POLICY IF EXISTS "Allow public read access" ON toilet_reports;
DROP POLICY IF EXISTS "Allow authenticated insert" ON toilet_reports;
DROP POLICY IF EXISTS "Allow authenticated update" ON toilet_reports;
DROP POLICY IF EXISTS "Allow authenticated delete" ON toilet_reports;

-- Create policies for toilets
CREATE POLICY "Allow public read access" ON toilets
  FOR SELECT USING (true);
  
CREATE POLICY "Allow authenticated insert" ON toilets
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Allow authenticated update" ON toilets
  FOR UPDATE USING (true);
  
CREATE POLICY "Allow authenticated delete" ON toilets
  FOR DELETE USING (true);

-- Create policies for reviews
CREATE POLICY "Allow public read access" ON reviews
  FOR SELECT USING (true);
  
CREATE POLICY "Allow authenticated insert" ON reviews
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Allow authenticated update" ON reviews
  FOR UPDATE USING (true);
  
CREATE POLICY "Allow authenticated delete" ON reviews
  FOR DELETE USING (true);

-- Create policies for reports
CREATE POLICY "Allow public read access" ON reports
  FOR SELECT USING (true);
  
CREATE POLICY "Allow authenticated insert" ON reports
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Allow authenticated update" ON reports
  FOR UPDATE USING (true);
  
CREATE POLICY "Allow authenticated delete" ON reports
  FOR DELETE USING (true);

-- Create policies for toilet_reports
CREATE POLICY "Allow public read access" ON toilet_reports
  FOR SELECT USING (true);
  
CREATE POLICY "Allow authenticated insert" ON toilet_reports
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Allow authenticated update" ON toilet_reports
  FOR UPDATE USING (true);
  
CREATE POLICY "Allow authenticated delete" ON toilet_reports
  FOR DELETE USING (true); 