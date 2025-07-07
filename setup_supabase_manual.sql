-- Create toilets table with basic structure (no PostGIS needed for now)
CREATE TABLE IF NOT EXISTS public.toilets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coordinates JSONB NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'public',
    source VARCHAR(20) NOT NULL DEFAULT 'osm', 
    tags JSONB DEFAULT '{}',
    notes TEXT,
    is_removed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS toilets_type_idx ON public.toilets (type);
CREATE INDEX IF NOT EXISTS toilets_source_idx ON public.toilets (source);
CREATE INDEX IF NOT EXISTS toilets_is_removed_idx ON public.toilets (is_removed);
CREATE INDEX IF NOT EXISTS toilets_created_at_idx ON public.toilets (created_at);

-- Enable Row Level Security
ALTER TABLE public.toilets ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read toilets
CREATE POLICY "Toilets are viewable by everyone" 
ON public.toilets FOR SELECT USING (true);

-- Allow authenticated users to insert toilets
CREATE POLICY "Authenticated users can insert toilets" 
ON public.toilets FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create the RPC function that the hook expects
CREATE OR REPLACE FUNCTION get_toilets_in_bounds(
    west FLOAT,
    south FLOAT,
    east FLOAT,
    north FLOAT
)
RETURNS TABLE (
    id UUID,
    coordinates JSONB,
    type VARCHAR(50),
    source VARCHAR(20),
    tags JSONB,
    notes TEXT,
    is_removed BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.coordinates,
        t.type,
        t.source,
        t.tags,
        t.notes,
        t.is_removed,
        t.created_at,
        t.updated_at
    FROM public.toilets t
    WHERE 
        t.is_removed = FALSE
        AND (t.coordinates->>'lat')::FLOAT >= south
        AND (t.coordinates->>'lat')::FLOAT <= north
        AND (t.coordinates->>'lng')::FLOAT >= west
        AND (t.coordinates->>'lng')::FLOAT <= east;
END;
$$;

-- Insert sample data for testing
INSERT INTO public.toilets (coordinates, type, source, notes) VALUES
('{"lat": 42.6977, "lng": 23.3219}', 'public', 'user', 'Public toilet in Sofia center'),
('{"lat": 42.6515, "lng": 23.3343}', 'gas-station', 'osm', 'Toilet at OMV gas station'),
('{"lat": 42.7069, "lng": 23.3158}', 'mall', 'osm', 'Toilet in shopping mall'),
('{"lat": 42.6831, "lng": 23.3184}', 'restaurant', 'user', 'Restaurant toilet near park'),
('{"lat": 42.7102, "lng": 23.3501}', 'public', 'osm', 'Public toilet in residential area');

-- Display success message
SELECT 'Toilets table created successfully! ' || COUNT(*) || ' sample toilets added.' as result
FROM public.toilets; 