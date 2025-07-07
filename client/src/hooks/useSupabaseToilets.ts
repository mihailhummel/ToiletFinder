import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Toilet } from '../types/toilet';

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface UseSupabaseToiletsOptions {
  userLocation?: { lat: number; lng: number };
  bounds?: ViewportBounds;
  enabled?: boolean;
}

interface CacheEntry {
  toilets: Toilet[];
  timestamp: number;
  bounds: ViewportBounds;
}

const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days
const STALE_SERVE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_DEBOUNCE_MS = 500;
const MIN_FETCH_INTERVAL = 30 * 1000; // 30 seconds

// In-memory cache for ultra-fast access
const toiletCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<Toilet[]>>();

/**
 * Generate cache key from bounds
 */
function getCacheKey(bounds: ViewportBounds): string {
  const precision = 2; // ~1km precision
  return [
    Math.round(bounds.north * 10 ** precision),
    Math.round(bounds.south * 10 ** precision), 
    Math.round(bounds.east * 10 ** precision),
    Math.round(bounds.west * 10 ** precision)
  ].join(',');
}

/**
 * Check if bounds are covered by existing cache entries
 */
function findCachedToilets(bounds: ViewportBounds): Toilet[] | null {
  const cacheKey = getCacheKey(bounds);
  const cached = toiletCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < STALE_SERVE_DURATION) {
    console.log(`🎯 Cache hit for bounds: ${cacheKey}`);
    return cached.toilets;
  }
  
  // Try to piece together from multiple cache entries
  const allCachedToilets: Toilet[] = [];
  let coverage = 0;
  
  for (const [key, entry] of toiletCache.entries()) {
    if (Date.now() - entry.timestamp < STALE_SERVE_DURATION) {
      // Check if this cache entry overlaps with our bounds
      const overlaps = !(
        entry.bounds.east < bounds.west ||
        entry.bounds.west > bounds.east ||
        entry.bounds.north < bounds.south ||
        entry.bounds.south > bounds.north
      );
      
      if (overlaps) {
        // Add toilets that fall within our target bounds
        const relevantToilets = entry.toilets.filter(toilet => 
          toilet.coordinates.lat >= bounds.south &&
          toilet.coordinates.lat <= bounds.north &&
          toilet.coordinates.lng >= bounds.west &&
          toilet.coordinates.lng <= bounds.east
        );
        
        allCachedToilets.push(...relevantToilets);
        coverage += 0.3; // Rough coverage estimate
      }
    }
  }
  
  // If we have decent coverage, return cached data
  if (coverage >= 0.7 && allCachedToilets.length > 0) {
    console.log(`🧩 Pieced together ${allCachedToilets.length} toilets from cache`);
    return allCachedToilets;
  }
  
  return null;
}

/**
 * Fetch toilets from Supabase using spatial queries
 */
async function fetchToiletsFromSupabase(bounds: ViewportBounds): Promise<Toilet[]> {
  const cacheKey = getCacheKey(bounds);
  
  // Check for pending request to avoid duplicates
  if (pendingRequests.has(cacheKey)) {
    console.log(`⏳ Request already pending for ${cacheKey}`);
    return pendingRequests.get(cacheKey)!;
  }
  
  console.log(`🔍 Fetching toilets from Supabase for bounds:`, bounds);
  
  const fetchPromise = (async () => {
    try {
      // Expand bounds slightly for better cache coverage
      const expandedBounds = {
        north: bounds.north + 0.01,
        south: bounds.south - 0.01,
        east: bounds.east + 0.01,
        west: bounds.west - 0.01
      };
      
      const { data, error } = await supabase
        .rpc('get_toilets_in_bounds', {
          west: expandedBounds.west,
          south: expandedBounds.south,
          east: expandedBounds.east,
          north: expandedBounds.north
        });
      
      if (error) {
        console.error('❌ Supabase query error:', error);
        throw error;
      }
      
      // Transform Supabase data to Toilet format
      const toilets: Toilet[] = data.map((row: any) => ({
        id: row.id,
        coordinates: row.coordinates,
        type: row.type,
        tags: row.tags || {},
        source: row.source,
        notes: row.notes,
        isRemoved: row.is_removed || false,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
      
      // Cache the result
      toiletCache.set(cacheKey, {
        toilets,
        timestamp: Date.now(),
        bounds: expandedBounds
      });
      
      console.log(`✅ Fetched ${toilets.length} toilets from Supabase`);
      return toilets;
      
    } catch (error) {
      console.error('❌ Error fetching from Supabase:', error);
      throw error;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  
  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Hook for fetching toilets in viewport with Supabase
 */
export function useSupabaseToilets({ bounds, enabled = true }: UseSupabaseToiletsOptions) {
  const queryClient = useQueryClient();
  const lastFetchTime = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create stable query key
  const queryKey = bounds ? ['toilets-supabase', getCacheKey(bounds)] : ['toilets-supabase', 'no-bounds'];
  
  const {
    data: toilets = [],
    error: queryError,
    isLoading: queryLoading,
    refetch
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!bounds) return [];
      
      // Check cache first
      const cached = findCachedToilets(bounds);
      if (cached) {
        return cached;
      }
      
      // Rate limiting
      const now = Date.now();
      if (now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
        console.log(`⏱️ Rate limited: ${Math.round((MIN_FETCH_INTERVAL - (now - lastFetchTime.current)) / 1000)}s remaining`);
        throw new Error('Rate limited - try again soon');
      }
      
      lastFetchTime.current = now;
      return await fetchToiletsFromSupabase(bounds);
    },
    enabled: enabled && !!bounds,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
    retry: (failureCount, error) => {
      // Don't retry rate limit errors
      if (error.message.includes('Rate limited')) return false;
      return failureCount < 2;
    },
    retryDelay: 2000
  });
  
  // Combine loading states
  const finalIsLoading = queryLoading || isLoading;
  const finalError = queryError?.message || error;
  
  // Debounced bounds update
  const debouncedRefetch = useCallback(() => {
    if (!bounds) return;
    
    setIsLoading(true);
    setError(null);
    
    const timer = setTimeout(() => {
      refetch().finally(() => {
        setIsLoading(false);
      });
    }, FETCH_DEBOUNCE_MS);
    
    return () => clearTimeout(timer);
  }, [bounds, refetch]);
  
  // Cache management utilities
  const clearCache = useCallback(() => {
    toiletCache.clear();
    pendingRequests.clear();
    queryClient.removeQueries({ queryKey: ['toilets-supabase'] });
    console.log('🧹 Toilet cache cleared');
  }, [queryClient]);
  
  const getCacheStats = useCallback(() => {
    return {
      cacheSize: toiletCache.size,
      pendingRequests: pendingRequests.size,
      entries: Array.from(toiletCache.entries()).map(([key, entry]) => ({
        key,
        toilets: entry.toilets.length,
        age: Math.round((Date.now() - entry.timestamp) / 1000 / 60), // minutes
        bounds: entry.bounds
      }))
    };
  }, []);
  
  // Expose debug utilities
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.debugSupabaseToiletCache = getCacheStats;
      window.clearSupabaseToiletCache = clearCache;
    }
  }, [getCacheStats, clearCache]);
  
  return {
    toilets,
    isLoading: finalIsLoading,
    error: finalError,
    refetch: debouncedRefetch,
    clearCache,
    getCacheStats
  };
}

/**
 * Hook for getting toilets near a specific location
 */
export function useNearbyToilets(
  location: { lat: number; lng: number } | null,
  radiusKm: number = 5
) {
  return useQuery({
    queryKey: ['toilets-nearby', location?.lat, location?.lng, radiusKm],
    queryFn: async () => {
      if (!location) return [];
      
      const { data, error } = await supabase
        .rpc('get_toilets_near_point', {
          lat: location.lat,
          lng: location.lng,
          radius_meters: radiusKm * 1000
        });
      
      if (error) throw error;
      
      return data.map((row: any) => ({
        id: row.id,
        coordinates: row.coordinates,
        type: row.type,
        tags: row.tags || {},
        source: row.source,
        notes: row.notes,
        isRemoved: row.is_removed || false,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        distance: row.distance_meters
      }));
    },
    enabled: !!location,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes
  });
} 