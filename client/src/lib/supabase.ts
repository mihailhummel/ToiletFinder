import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL environment variable is required');
}
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY environment variable is required');
}

// Environment check for production builds
if (import.meta.env.PROD && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.error('🚨 CRITICAL: Supabase environment variables are required in production');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
  throw new Error('Missing Supabase configuration');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-my-custom-header': 'toilet-finder-app'
    }
  }
})

// Types for our toilet data
export interface SupabaseToilet {
  id: string
  coordinates: {
    lat: number
    lng: number
  }
  type: string
  tags?: Record<string, any>
  source: 'osm' | 'user'
  notes?: string
  isRemoved?: boolean
  created_at?: string
  updated_at?: string
  // PostGIS geometry column for spatial queries
  location?: string
}

// Spatial query helpers
export const getToiletsInBounds = async (bounds: {
  north: number
  south: number
  east: number
  west: number
}) => {
  const { data, error } = await supabase
    .rpc('get_toilets_in_bounds', {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north
    })

  if (error) throw error
  return data
}

export const getToiletsNearPoint = async (lat: number, lng: number, radiusKm: number = 5) => {
  const { data, error } = await supabase
    .rpc('get_toilets_near_point', {
      lat: lat,
      lng: lng,
      radius_meters: radiusKm * 1000
    })

  if (error) throw error
  return data
} 