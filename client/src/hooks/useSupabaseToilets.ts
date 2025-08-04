import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Toilet } from '@/types/toilet';

const DEBUG = false; // Disabled all debug logging for performance

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

// Simple function to fetch all toilets from the server API
async function fetchAllToiletsFromServer(): Promise<Toilet[]> {
  try {
    const response = await fetch('/api/toilets');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Error fetching all toilets from server:', error);
    throw error;
  }
}

// Simple function to fetch toilets within bounds from the server API
async function fetchToiletsInBoundsFromServer(bounds: ViewportBounds): Promise<Toilet[]> {
  try {
    // Add 200m buffer around viewport bounds to ensure edge toilets are always visible
    const bufferDegrees = 0.002; // ~200m in degrees (approximate)
    
    const expandedBounds = {
      north: bounds.north + bufferDegrees,
      south: bounds.south - bufferDegrees,
      east: bounds.east + bufferDegrees,
      west: bounds.west - bufferDegrees
    };
    
    // Calculate center point and radius from expanded bounds
    const centerLat = (expandedBounds.north + expandedBounds.south) / 2;
    const centerLng = (expandedBounds.east + expandedBounds.west) / 2;
    
    // Calculate radius in km (approximate)
    const latDiff = expandedBounds.north - expandedBounds.south;
    const lngDiff = expandedBounds.east - expandedBounds.west;
    const radiusKm = Math.max(latDiff, lngDiff) * 111; // Rough conversion to km
    
    // Add additional buffer for smooth experience (1000m = 1km)
    const radiusWithBuffer = Math.max(radiusKm + 1, 5); // Minimum 5km radius
    
    const params = new URLSearchParams({
      lat: centerLat.toString(),
      lng: centerLng.toString(),
      radius: radiusWithBuffer.toString()
    });
    
    const response = await fetch(`/api/toilets?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Error fetching toilets in bounds from server:', error);
    throw error;
  }
}

export function useSupabaseToilets({ bounds, enabled = true }: UseSupabaseToiletsOptions) {
  const queryClient = useQueryClient();
  
  // Create stable query key - use consistent key but include bounds in data fetching
  const queryKey = ['toilets-supabase'];
  
  // Silent for performance
  
  const {
    data: toilets = [],
    error: queryError,
    isLoading: queryLoading,
    refetch
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!bounds) {
        // No bounds yet - return empty array and wait for bounds to be set
        return [];
      }
      
      // Fetch toilets within bounds
      return await fetchToiletsInBoundsFromServer(bounds);
    },
    enabled: enabled, // Always enabled when requested
    staleTime: 60 * 1000, // Data is fresh for 1 minute - balanced
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes after unmount
    refetchOnMount: true, // Always fetch on mount to ensure initial load
    refetchOnWindowFocus: false, // Don't refetch on window focus (reduces requests)
    refetchOnReconnect: true, // Refetch when reconnecting (network issues)
    retry: 1, // Retry failed requests once
    retryDelay: 1000 // 1 second delay between retries
  });
  
  // Force refetch when bounds change
  const boundsRef = useRef(bounds);
  useEffect(() => {
    // Refetch if bounds changed and we have bounds
    if (bounds && boundsRef.current !== bounds) {
      refetch();
    }
    boundsRef.current = bounds;
  }, [bounds, refetch]);
  
  return {
    data: toilets,
    error: queryError,
    isLoading: queryLoading,
    refetch
  };
}

// Simple hook for nearby toilets
export function useNearbyToilets(
  location: { lat: number; lng: number } | null,
  radiusKm: number = 5
) {
  const bounds = location ? {
    north: location.lat + (radiusKm / 111.32),
    south: location.lat - (radiusKm / 111.32),
    east: location.lng + (radiusKm / (111.32 * Math.cos(location.lat * Math.PI / 180))),
    west: location.lng - (radiusKm / (111.32 * Math.cos(location.lat * Math.PI / 180)))
  } : undefined;

  return useSupabaseToilets({ bounds, enabled: !!location });
} 