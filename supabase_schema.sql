-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create toilets table with geospatial support
CREATE TABLE public.toilets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic toilet information
    coordinates JSONB NOT NULL, -- {lat: number, lng: number}
    type VARCHAR(50) NOT NULL, -- 'public', 'gas-station', 'restaurant', 'mall', etc.
    source VARCHAR(20) NOT NULL DEFAULT 'osm', -- 'osm' or 'user'
    
    -- Optional metadata
    tags JSONB, -- OpenStreetMap tags and other metadata
    notes TEXT, -- User notes
    is_removed BOOLEAN DEFAULT FALSE, -- Soft delete flag
    
    -- PostGIS geometry column for efficient spatial queries
    location GEOMETRY(POINT, 4326) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index for ultra-fast location queries
CREATE INDEX toilets_location_idx ON public.toilets USING GIST (location);

-- Create regular indexes for common queries
CREATE INDEX toilets_type_idx ON public.toilets (type);
CREATE INDEX toilets_source_idx ON public.toilets (source);
CREATE INDEX toilets_is_removed_idx ON public.toilets (is_removed);
CREATE INDEX toilets_created_at_idx ON public.toilets (created_at);

-- Create function to automatically update the location column from coordinates
CREATE OR REPLACE FUNCTION update_toilet_location()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract lat/lng from coordinates JSONB and create PostGIS point
    NEW.location = ST_SetSRID(
        ST_Point(
            (NEW.coordinates->>'lng')::FLOAT,
            (NEW.coordinates->>'lat')::FLOAT
        ), 
        4326
    );
    
    -- Update the updated_at timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update location when coordinates change
CREATE TRIGGER update_toilet_location_trigger
    BEFORE INSERT OR UPDATE ON public.toilets
    FOR EACH ROW
    EXECUTE FUNCTION update_toilet_location();

-- Create function for efficient bounding box queries
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
    updated_at TIMESTAMP WITH TIME ZONE,
    distance_meters FLOAT
) AS $$
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
        t.updated_at,
        NULL::FLOAT as distance_meters
    FROM public.toilets t
    WHERE 
        t.is_removed = FALSE
        AND ST_Within(
            t.location, 
            ST_MakeEnvelope(west, south, east, north, 4326)
        );
END;
$$ LANGUAGE plpgsql;

-- Create function for radius-based queries
CREATE OR REPLACE FUNCTION get_toilets_near_point(
    lat FLOAT,
    lng FLOAT,
    radius_meters FLOAT DEFAULT 5000
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
    updated_at TIMESTAMP WITH TIME ZONE,
    distance_meters FLOAT
) AS $$
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
        t.updated_at,
        ST_Distance(
            t.location::geography, 
            ST_Point(lng, lat)::geography
        )::FLOAT as distance_meters
    FROM public.toilets t
    WHERE 
        t.is_removed = FALSE
        AND ST_DWithin(
            t.location::geography,
            ST_Point(lng, lat)::geography,
            radius_meters
        )
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Create RLS (Row Level Security) policies if needed
ALTER TABLE public.toilets ENABLE ROW LEVEL SECURITY;

-- Allow all users to read toilets
CREATE POLICY "Toilets are viewable by everyone" ON public.toilets
    FOR SELECT USING (true);

-- Allow authenticated users to insert toilets
CREATE POLICY "Authenticated users can insert toilets" ON public.toilets
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own toilets or admins to update any
CREATE POLICY "Users can update their own toilets" ON public.toilets
    FOR UPDATE USING (
        auth.role() = 'authenticated' 
        AND (source = 'user' OR auth.jwt() ->> 'is_admin' = 'true')
    );

-- Sample data validation
ALTER TABLE public.toilets 
ADD CONSTRAINT valid_coordinates 
CHECK (
    coordinates ? 'lat' 
    AND coordinates ? 'lng'
    AND (coordinates->>'lat')::FLOAT BETWEEN -90 AND 90
    AND (coordinates->>'lng')::FLOAT BETWEEN -180 AND 180
);

ALTER TABLE public.toilets 
ADD CONSTRAINT valid_source 
CHECK (source IN ('osm', 'user'));

-- Comments for documentation
COMMENT ON TABLE public.toilets IS 'Toilet locations with geospatial indexing';
COMMENT ON COLUMN public.toilets.location IS 'PostGIS geometry point for spatial queries';
COMMENT ON COLUMN public.toilets.coordinates IS 'JSON coordinates for application compatibility';
COMMENT ON INDEX toilets_location_idx IS 'Spatial index for efficient location-based queries'; 