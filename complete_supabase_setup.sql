-- Complete Supabase setup for Toilet Finder App
-- This sets up all tables and imports sample toilet data

-- Create toilets table (if not exists)
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

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    toilet_id UUID REFERENCES public.toilets(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    location JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create toilet_reports table
CREATE TABLE IF NOT EXISTS public.toilet_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    toilet_id UUID REFERENCES public.toilets(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS toilets_type_idx ON public.toilets (type);
CREATE INDEX IF NOT EXISTS toilets_source_idx ON public.toilets (source);
CREATE INDEX IF NOT EXISTS toilets_is_removed_idx ON public.toilets (is_removed);
CREATE INDEX IF NOT EXISTS toilets_created_at_idx ON public.toilets (created_at);
CREATE INDEX IF NOT EXISTS reviews_toilet_id_idx ON public.reviews (toilet_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews (user_id);
CREATE INDEX IF NOT EXISTS toilet_reports_toilet_id_idx ON public.toilet_reports (toilet_id);

-- Enable Row Level Security
ALTER TABLE public.toilets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toilet_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Toilets are viewable by everyone" ON public.toilets;
DROP POLICY IF EXISTS "Authenticated users can insert toilets" ON public.toilets;
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Reports are viewable by admins" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Toilet reports are viewable by admins" ON public.toilet_reports;
DROP POLICY IF EXISTS "Authenticated users can insert toilet reports" ON public.toilet_reports;

-- Create policies for toilets
CREATE POLICY "Toilets are viewable by everyone" 
ON public.toilets FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert toilets" 
ON public.toilets FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their toilets" 
ON public.toilets FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete their toilets" 
ON public.toilets FOR DELETE USING (auth.role() = 'authenticated');

-- Create policies for reviews
CREATE POLICY "Reviews are viewable by everyone" 
ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reviews" 
ON public.reviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policies for reports
CREATE POLICY "Reports are viewable by admins" 
ON public.reports FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert reports" 
ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policies for toilet reports
CREATE POLICY "Toilet reports are viewable by admins" 
ON public.toilet_reports FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert toilet reports" 
ON public.toilet_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create the RPC function for spatial queries
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

-- Clear existing toilet data
DELETE FROM public.toilets;

-- Insert priority toilets near user's location (42.644, 23.294)
INSERT INTO public.toilets (coordinates, type, source, notes) VALUES
('{"lat": 42.6443, "lng": 23.2948}', 'public', 'user', 'Public toilet near your location - 100m walk'),
('{"lat": 42.6439, "lng": 23.2952}', 'gas-station', 'osm', 'Gas station toilet - 200m away'),
('{"lat": 42.6447, "lng": 23.2943}', 'restaurant', 'user', 'Restaurant toilet - very close'),
('{"lat": 42.6450, "lng": 23.2955}', 'mall', 'osm', 'Shopping center toilet'),
('{"lat": 42.6440, "lng": 23.2940}', 'public', 'user', 'Public toilet - walking distance'),
('{"lat": 42.6445, "lng": 23.2965}', 'cafe', 'user', 'Cafe toilet - 300m away'),
('{"lat": 42.6435, "lng": 23.2935}', 'public', 'osm', 'Municipal toilet - accessible');

-- Insert Sofia area toilets
INSERT INTO public.toilets (coordinates, type, source, notes) VALUES
('{"lat": 42.6977, "lng": 23.3219}', 'public', 'osm', 'Sofia center - Alexander Nevsky area'),
('{"lat": 42.6950, "lng": 23.3200}', 'museum', 'user', 'National Museum area'),
('{"lat": 42.7000, "lng": 23.3250}', 'public', 'osm', 'City Garden park toilet'),
('{"lat": 42.6920, "lng": 23.3180}', 'restaurant', 'user', 'Restaurant near cathedral'),
('{"lat": 42.6881, "lng": 23.4138}', 'airport', 'osm', 'Sofia Airport Terminal 1 - accessible'),
('{"lat": 42.6886, "lng": 23.4156}', 'airport', 'osm', 'Sofia Airport Terminal 2 - clean facilities'),
('{"lat": 42.6515, "lng": 23.3343}', 'gas-station', 'osm', 'OMV gas station - clean toilet'),
('{"lat": 42.7069, "lng": 23.3158}', 'mall', 'osm', 'Shopping mall - multiple toilets'),
('{"lat": 42.6831, "lng": 23.3184}', 'restaurant', 'user', 'Restaurant toilet near park'),
('{"lat": 42.7102, "lng": 23.3501}', 'public', 'osm', 'Public toilet in residential area');

-- Insert sample toilets from the JSON data (representative sample)
INSERT INTO public.toilets (id, coordinates, type, source, notes, tags) VALUES
('osm-node-300587432', '{"lat": 42.8359513, "lng": 22.6515496}', 'public', 'osm', 'Public toilet in western Bulgaria', '{"amenity": "toilets"}'),
('osm-node-369821922', '{"lat": 43.0832066, "lng": 23.3789873}', 'public', 'osm', 'Public toilet in northern Bulgaria', '{"amenity": "toilets"}'),
('osm-node-422464060', '{"lat": 43.0828814, "lng": 25.6505178}', 'public', 'osm', 'Wheelchair accessible: no', '{"amenity": "toilets", "wheelchair": "no"}'),
('osm-node-583205503', '{"lat": 42.7319873, "lng": 23.2755631}', 'public', 'osm', 'Fee: no', '{"amenity": "toilets", "fee": "no", "unisex": "yes"}'),
('osm-node-847728045', '{"lat": 42.2112021, "lng": 27.8049257}', 'public', 'osm', 'Fee: yes', '{"amenity": "toilets", "fee": "yes"}'),
('osm-node-1034001284', '{"lat": 42.6881381, "lng": 23.4138488}', 'public', 'osm', 'Fee: no, Wheelchair accessible: yes', '{"amenity": "toilets", "fee": "no", "wheelchair": "yes"}'),
('osm-node-1141386689', '{"lat": 42.5826104, "lng": 23.2919686}', 'public', 'osm', 'Fee: yes, Wheelchair accessible: no', '{"amenity": "toilets", "fee": "yes", "wheelchair": "no"}');

-- Add more toilets throughout Bulgaria
INSERT INTO public.toilets (coordinates, type, source, notes) VALUES
('{"lat": 42.6500, "lng": 23.3000}', 'shopping', 'osm', 'Shopping mall toilet'),
('{"lat": 42.6750, "lng": 23.3000}', 'metro', 'osm', 'Metro station Serdika'),
('{"lat": 42.6800, "lng": 23.3100}', 'public', 'user', 'Public toilet near market'),
('{"lat": 42.7150, "lng": 23.3400}', 'park', 'osm', 'Borisova Garden toilet'),
('{"lat": 42.6600, "lng": 23.2800}', 'hospital', 'user', 'Hospital facility - accessible'),
('{"lat": 42.6700, "lng": 23.2900}', 'gas-station', 'osm', 'Shell station - 24h access'),
('{"lat": 42.6650, "lng": 23.3050}', 'restaurant', 'user', 'McDonald''s - fast food toilet'),
('{"lat": 42.6850, "lng": 23.2950}', 'public', 'osm', 'Bus terminal toilet'),
('{"lat": 42.7200, "lng": 23.3600}', 'mall', 'osm', 'Paradise Center mall'),
('{"lat": 42.6400, "lng": 23.3200}', 'public', 'user', 'Vitosha Boulevard area'),
('{"lat": 42.6300, "lng": 23.3400}', 'restaurant', 'osm', 'Restaurant in south Sofia'),
('{"lat": 43.2086912, "lng": 27.9032066}', 'public', 'osm', 'Coastal toilet - Varna area'),
('{"lat": 42.8239302, "lng": 27.8822042}', 'public', 'osm', 'Black Sea coast toilet'),
('{"lat": 43.0812182, "lng": 25.645772}', 'public', 'osm', 'Central Bulgaria toilet'),
('{"lat": 42.087662, "lng": 27.857761}', 'public', 'osm', 'Southern coast toilet - no lighting');

-- Display success message
SELECT 'Successfully created all tables and added ' || COUNT(*) || ' toilets to Bulgaria database!' as result
FROM public.toilets; 