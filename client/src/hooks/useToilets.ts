import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Toilet, InsertToilet, InsertReview, InsertReport, Review, MapLocation } from "@/types/toilet";
import { useCallback, useRef, useState, useMemo, useEffect } from 'react';

// EXTREMELY AGGRESSIVE CACHING SYSTEM
const CACHE_KEY = 'toilet-cache-v2';
const CACHE_EXPIRY_HOURS = 72; // 3 days cache expiry - very long to minimize DB reads
const CHUNK_SIZE_KM = 50; // Larger chunks to cover more area
const STALE_SERVE_DAYS = 7; // Serve stale data for up to a week if needed

interface CachedToiletData {
  chunks: Record<string, { 
    toilets: Toilet[]; 
    timestamp: number; 
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  }>;
  lastUpdate: number;
}

// Pending requests tracker to prevent duplicate API calls
const pendingRequests = new Map<string, Promise<Toilet[]>>();

// Get chunk key for spatial caching (larger chunks)
function getChunkKey(lat: number, lng: number): string {
  const chunkLat = Math.floor(lat * 4) / 4; // 0.25 degree chunks (~28km)
  const chunkLng = Math.floor(lng * 4) / 4;
  return `${chunkLat},${chunkLng}`;
}

// Get cache for area
function getCachedData(): CachedToiletData {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return { chunks: {}, lastUpdate: 0 };
    return JSON.parse(cached) as CachedToiletData;
  } catch {
    return { chunks: {}, lastUpdate: 0 };
  }
}

// Update cache
function setCachedData(data: CachedToiletData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to cache toilet data:', error);
  }
}

// Check if cached data covers viewport (with overlap tolerance)
function findCoveringCache(viewport: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Toilet[] | null {
  const cached = getCachedData();
  const now = Date.now();
  const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  const staleTime = STALE_SERVE_DAYS * 24 * 60 * 60 * 1000;
  
  // Look for any chunk that covers the viewport
  for (const [key, chunk] of Object.entries(cached.chunks)) {
    const age = now - chunk.timestamp;
    
    // Skip expired chunks unless we're desperate
    if (age > staleTime) continue;
    
    // Check if this chunk covers our viewport
    const buffer = 0.01; // Small buffer for overlap
    if (chunk.bounds && 
        chunk.bounds.minLat <= viewport.minLat + buffer &&
        chunk.bounds.maxLat >= viewport.maxLat - buffer &&
        chunk.bounds.minLng <= viewport.minLng + buffer &&
        chunk.bounds.maxLng >= viewport.maxLng - buffer) {
      
      console.log(`✅ Serving ${chunk.toilets.length} toilets from cache (age: ${Math.round(age/1000/60)}min)`);
      
      // Filter to exact viewport
      return chunk.toilets.filter(toilet => 
        toilet.coordinates.lat >= viewport.minLat &&
        toilet.coordinates.lat <= viewport.maxLat &&
        toilet.coordinates.lng >= viewport.minLng &&
        toilet.coordinates.lng <= viewport.maxLng &&
        !toilet.isRemoved
      );
    }
  }
  
  // Try to piece together from multiple chunks
  const allCachedToilets: Toilet[] = [];
  for (const chunk of Object.values(cached.chunks)) {
    if (now - chunk.timestamp < staleTime) {
      allCachedToilets.push(...chunk.toilets);
    }
  }
  
  if (allCachedToilets.length > 0) {
    const viewportToilets = allCachedToilets.filter(toilet => 
      toilet.coordinates.lat >= viewport.minLat &&
      toilet.coordinates.lat <= viewport.maxLat &&
      toilet.coordinates.lng >= viewport.minLng &&
      toilet.coordinates.lng <= viewport.maxLng &&
      !toilet.isRemoved
    );
    
    if (viewportToilets.length > 10) { // If we have reasonable coverage
      console.log(`✅ Serving ${viewportToilets.length} toilets from pieced cache`);
      return viewportToilets;
    }
  }
  
  return null;
}

// Save toilets to cache with expanded bounds
function cacheToilets(toilets: Toilet[], viewport: { minLat: number; maxLat: number; minLng: number; maxLng: number }): void {
  const cached = getCachedData();
  const centerLat = (viewport.minLat + viewport.maxLat) / 2;
  const centerLng = (viewport.minLng + viewport.maxLng) / 2;
  const chunkKey = getChunkKey(centerLat, centerLng);
  
  // Expand bounds for future coverage
  const expandedBounds = {
    minLat: viewport.minLat - 0.02,
    maxLat: viewport.maxLat + 0.02,
    minLng: viewport.minLng - 0.02,
    maxLng: viewport.maxLng + 0.02
  };
  
  cached.chunks[chunkKey] = {
    toilets,
    timestamp: Date.now(),
    bounds: expandedBounds
  };
  cached.lastUpdate = Date.now();
  
  // Limit cache size
  const chunks = Object.entries(cached.chunks);
  if (chunks.length > 20) {
    // Keep only the 15 newest chunks
    const sorted = chunks.sort((a, b) => b[1].timestamp - a[1].timestamp);
    cached.chunks = Object.fromEntries(sorted.slice(0, 15));
  }
  
  setCachedData(cached);
  console.log(`💾 Cached ${toilets.length} toilets for area`);
}

// Debounced viewport hook with EXTREME caching
export const useToiletsInViewport = (viewport?: { 
  minLat: number; 
  maxLat: number; 
  minLng: number; 
  maxLng: number; 
}) => {
  const [stableViewport, setStableViewport] = useState<typeof viewport | null>(null);
  const lastFetchTime = useRef<number>(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Aggressive debouncing - only update viewport after 500ms of no changes
  useEffect(() => {
    if (!viewport) return;
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      const now = Date.now();
      
      // Only update if viewport changed significantly OR it's been a while
      if (!stableViewport || now - lastFetchTime.current > 30000) { // 30 seconds minimum
        const latDiff = Math.abs(stableViewport?.minLat || 0 - viewport.minLat);
        const lngDiff = Math.abs(stableViewport?.minLng || 0 - viewport.minLng);
        
        if (!stableViewport || latDiff > 0.01 || lngDiff > 0.01) {
          console.log('📍 Viewport changed significantly, checking cache...');
          setStableViewport(viewport);
          lastFetchTime.current = now;
        }
      }
    }, 500);
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [viewport, stableViewport]);
  
  return useQuery({
    queryKey: ['toilets-viewport-v2', stableViewport],
    queryFn: async () => {
      if (!stableViewport) return [];
      
      // STEP 1: Try to serve from cache AGGRESSIVELY
      const cachedToilets = findCoveringCache(stableViewport);
      if (cachedToilets) {
        return cachedToilets;
      }
      
      // STEP 2: Check for pending request for same area
      const requestKey = `${stableViewport.minLat}-${stableViewport.maxLat}-${stableViewport.minLng}-${stableViewport.maxLng}`;
      if (pendingRequests.has(requestKey)) {
        console.log('⏳ Using pending request for same area');
        return await pendingRequests.get(requestKey)!;
      }
      
      // STEP 3: Make new request only if absolutely necessary
      console.log('🌐 Cache miss - making database request (THIS SHOULD BE RARE!)');
      
      const requestPromise = (async () => {
        try {
          const url = `/api/toilets-in-area?minLat=${stableViewport.minLat}&maxLat=${stableViewport.maxLat}&minLng=${stableViewport.minLng}&maxLng=${stableViewport.maxLng}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const toilets = await response.json() as Toilet[];
          
          // Cache immediately for future use
          cacheToilets(toilets, stableViewport);
          
          return toilets.filter(toilet => !toilet.isRemoved);
        } finally {
          pendingRequests.delete(requestKey);
        }
      })();
      
      pendingRequests.set(requestKey, requestPromise);
      return await requestPromise;
    },
    enabled: !!stableViewport,
    staleTime: 60 * 60 * 1000, // 1 hour stale time
    gcTime: 4 * 60 * 60 * 1000, // 4 hours garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    retry: (failureCount, error) => {
      // Don't retry on 503 (quota exceeded)
      if ((error as any)?.message?.includes('503')) return false;
      return failureCount < 2;
    },
  });
};

// Legacy hook - now with minimal database usage
export const useToilets = (location?: MapLocation) => {
  return useQuery({
    queryKey: ["toilets", "legacy-v2", location?.lat, location?.lng],
    queryFn: async () => {
      console.log('⚠️ Legacy useToilets called - consider switching to useToiletsInViewport');
      
      if (!location) {
        // Return empty for now to avoid loading all toilets
        console.log('🚫 No location provided, returning empty array to prevent full DB load');
        return [];
      }
      
      // Try to serve from cache first
      const cached = getCachedData();
      const chunkKey = getChunkKey(location.lat, location.lng);
      
      if (cached.chunks[chunkKey]) {
        const age = Date.now() - cached.chunks[chunkKey].timestamp;
        if (age < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
          console.log('✅ Serving from legacy cache');
          return cached.chunks[chunkKey].toilets.filter(toilet => !toilet.isRemoved);
        }
      }
      
      // Fallback to nearby API
      const params = new URLSearchParams({
          lat: location.lat.toString(),
          lng: location.lng.toString(),
        radius: '15' // Reduced radius
      });
      
      const response = await fetch(`/api/toilets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch toilets');
      
      const toilets = await response.json() as Toilet[];
      
      // Cache the result
      const bounds = {
        minLat: location.lat - 0.1,
        maxLat: location.lat + 0.1,
        minLng: location.lng - 0.1,
        maxLng: location.lng + 0.1
      };
      
      cached.chunks[chunkKey] = {
        toilets,
        timestamp: Date.now(),
        bounds
      };
      setCachedData(cached);
      
      return toilets.filter(toilet => !toilet.isRemoved);
    },
    staleTime: 2 * 60 * 60 * 1000, // 2 hours
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export const useAddToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (toilet: InsertToilet): Promise<Toilet> => {
      return await apiRequest("/api/toilets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toilet),
      });
    },
    onSuccess: (newToilet) => {
      // Invalidate all toilet queries to refresh the map
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
      
      // Clear local cache since we have new data
      clearToiletCache();
      
      console.log("New toilet added successfully");
    },
    onError: (error) => {
      console.error("Failed to add toilet:", error);
    },
  });
};

export const useToiletReviews = (toiletId: string) => {
  return useQuery({
    queryKey: ["toilets", toiletId, "reviews"],
    queryFn: async (): Promise<Review[]> => {
      return await apiRequest(`/api/toilets/${toiletId}/reviews`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!toiletId,
  });
};

export const useAddReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ toiletId, review }: { toiletId: string; review: InsertReview }): Promise<Review> => {
      return await apiRequest(`/api/toilets/${toiletId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(review),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["toilets", variables.toiletId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
    },
  });
};

export const useAddReport = () => {
  return useMutation({
    mutationFn: async (report: InsertReport): Promise<void> => {
      await apiRequest("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    },
  });
};

export const useUserReviewStatus = (toiletId: string, userId?: string) => {
  return useQuery({
    queryKey: ["user-review-status", toiletId, userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const response = await fetch(`/api/toilets/${toiletId}/user-review?userId=${userId}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch user review status');
      
      return await response.json();
    },
    enabled: !!toiletId && !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDeleteToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (toiletId: string): Promise<void> => {
      const response = await fetch(`/api/toilets/${toiletId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete toilet');
      }
    },
    onSuccess: () => {
      // Invalidate and refetch toilet queries
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
      
      // Clear cache to ensure deleted toilet doesn't show up
      clearToiletCache();
      
      console.log("Toilet deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete toilet:", error);
    },
  });
};

// Clear cache utility
export const clearToiletCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Toilet cache cleared');
  } catch (error) {
    console.warn('Failed to clear toilet cache:', error);
  }
};

// Preload function - now much more conservative
export const preloadToiletsForRegion = async (lat: number, lng: number, radiusKm: number = 15) => {
  const cached = getCachedData();
  const chunkKey = getChunkKey(lat, lng);
  
  // Check if we already have recent data for this region
  if (cached.chunks[chunkKey]) {
    const age = Date.now() - cached.chunks[chunkKey].timestamp;
    if (age < 60 * 60 * 1000) { // 1 hour
      console.log('✅ Region already cached, skipping preload');
      return;
    }
  }
  
  console.log('🔄 Preloading region data...');
  
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius: Math.min(radiusKm, 20).toString() // Cap at 20km
    });
    
    const response = await fetch(`/api/toilets?${params}`);
    if (!response.ok) return;
    
    const toilets = await response.json() as Toilet[];
    
    // Cache with bounds
    const bounds = {
      minLat: lat - radiusKm / 111,
      maxLat: lat + radiusKm / 111,
      minLng: lng - radiusKm / (111 * Math.cos(lat * Math.PI / 180)),
      maxLng: lng + radiusKm / (111 * Math.cos(lat * Math.PI / 180))
    };
    
    cached.chunks[chunkKey] = {
      toilets,
      timestamp: Date.now(),
      bounds
    };
    setCachedData(cached);
    
    console.log(`💾 Preloaded ${toilets.length} toilets for region`);
  } catch (error) {
    console.error('Failed to preload region:', error);
  }
};
