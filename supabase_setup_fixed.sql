-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create toilets table
CREATE TABLE IF NOT EXISTS toilets (
  id TEXT PRIMARY KEY,
  coordinates JSONB NOT NULL,
  type TEXT NOT NULL DEFAULT 'public',
  source TEXT NOT NULL DEFAULT 'user',
  notes TEXT,
  tags JSONB DEFAULT '{}',
  is_removed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_toilets_coordinates 
ON toilets 
USING GIST (ST_SetSRID(ST_MakePoint((coordinates->>'lng')::float, (coordinates->>'lat')::float), 4326));

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

-- Enable RLS
ALTER TABLE toilets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON toilets;
DROP POLICY IF EXISTS "Allow authenticated insert" ON toilets;
DROP POLICY IF EXISTS "Allow authenticated update" ON toilets;
DROP POLICY IF EXISTS "Allow authenticated delete" ON toilets;

-- Create policies
CREATE POLICY "Allow public read access" ON toilets
  FOR SELECT USING (true);
  
CREATE POLICY "Allow authenticated insert" ON toilets
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Allow authenticated update" ON toilets
  FOR UPDATE USING (true);
  
CREATE POLICY "Allow authenticated delete" ON toilets
  FOR DELETE USING (true); 