import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fvohytokcumrauwplnwo.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4OTA3MzgsImV4cCI6MjA2NzQ2NjczOH0.nJZx7uUcM0U1Uj8eL8P1eR97OQLhfS3jUinT6K74utk'

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