import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import { Toilet } from '@/types/toilet';
import { useToast } from '@/hooks/use-toast';

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface NewToiletData {
  lat: number;
  lng: number;
  title: string;
  type: string;
  accessibility?: string;
  accessType?: string;
  userId: string;
  source?: string;
  addedByUserName?: string;
}

interface ClusteredToilet extends Toilet {
  isCluster?: boolean;
  clusterCount?: number;
  clusterCenter?: { lat: number; lng: number };
}

// Fetch ALL toilets once and cache them
async function fetchAllToilets(): Promise<Toilet[]> {
  try {
    // Loading all toilets from database
    const response = await fetch('/api/toilets');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Toilets loaded successfully
    return data;
  } catch (error) {
    console.error('❌ Error fetching all toilets:', error);
    throw error;
  }
}

// Add a new toilet
async function addToilet(toiletData: NewToiletData): Promise<Toilet> {
  // Transform data to match server schema
  const serverData = {
    type: toiletData.type,
    title: toiletData.title,
    coordinates: {
      lat: toiletData.lat,
      lng: toiletData.lng
    },
    accessibility: toiletData.accessibility || 'unknown',
    accessType: toiletData.accessType || 'unknown',
    userId: toiletData.userId,
    source: toiletData.source || 'user',
    addedByUserName: toiletData.addedByUserName
  };
  
  // Sending toilet data to server
  
  const response = await fetch('/api/toilets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverData)
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    console.error('Server error:', response.status, errorData);
    throw new Error(`Server error: ${response.status}`);
  }
  
  return response.json();
}

// Calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Create clusters for zoomed-out views
function createClusters(toilets: Toilet[], zoomLevel: number): ClusteredToilet[] {
  // No clustering for zoom levels >= 14 (close-up views)
  if (zoomLevel >= 14) {
    // No clustering at this zoom level
    return toilets;
  }
  
  const clusterDistance = zoomLevel >= 12 ? 1 : zoomLevel >= 10 ? 3 : 5; // km
  const clusters: ClusteredToilet[] = [];
  const processed = new Set<string>();
  
  // Starting clustering process
  
  toilets.forEach(toilet => {
    if (processed.has(toilet.id)) return;
    
    // Ensure toilet has valid coordinates
    if (!toilet.coordinates || typeof toilet.coordinates.lat !== 'number' || typeof toilet.coordinates.lng !== 'number') {
      // Skipping toilet with invalid coordinates
      return;
    }
    
    // Find nearby toilets for clustering
    const nearbyToilets = toilets.filter(other => {
      if (processed.has(other.id)) return false;
      if (!other.coordinates || typeof other.coordinates.lat !== 'number' || typeof other.coordinates.lng !== 'number') {
        return false;
      }
      
      const distance = calculateDistance(
        toilet.coordinates.lat, toilet.coordinates.lng,
        other.coordinates.lat, other.coordinates.lng
      );
      return distance <= clusterDistance;
    });
    
    if (nearbyToilets.length === 1) {
      // Single toilet, no clustering needed
      clusters.push(toilet);
      processed.add(toilet.id);
    } else {
      // Create cluster
      const centerLat = nearbyToilets.reduce((sum, t) => sum + t.coordinates.lat, 0) / nearbyToilets.length;
      const centerLng = nearbyToilets.reduce((sum, t) => sum + t.coordinates.lng, 0) / nearbyToilets.length;
      
      const cluster: ClusteredToilet = {
        ...toilet, // Use first toilet as base
        id: `cluster-${toilet.id}`,
        isCluster: true,
        clusterCount: nearbyToilets.length,
        clusterCenter: { lat: centerLat, lng: centerLng },
        coordinates: { lat: centerLat, lng: centerLng }
      };
      
      clusters.push(cluster);
      nearbyToilets.forEach(t => processed.add(t.id));
      // Cluster created
    }
  });
  
  // Clustering complete
  return clusters;
}

// Filter toilets by viewport with buffer
function filterToiletsByViewport(toilets: Toilet[], bounds: ViewportBounds, bufferKm: number = 2): Toilet[] {
  const bufferDegrees = bufferKm / 111.32; // Rough conversion km to degrees
  
  const expandedBounds = {
    north: bounds.north + bufferDegrees,
    south: bounds.south - bufferDegrees,
    east: bounds.east + bufferDegrees,
    west: bounds.west - bufferDegrees
  };
  
  const filtered = toilets.filter(toilet => 
    toilet.coordinates.lat >= expandedBounds.south &&
    toilet.coordinates.lat <= expandedBounds.north &&
    toilet.coordinates.lng >= expandedBounds.west &&
    toilet.coordinates.lng <= expandedBounds.east
  );
  
  return filtered;
}

// Main hook for toilet cache management
export function useToiletCache(bounds: ViewportBounds | undefined, zoomLevel: number = 14) {
  const queryClient = useQueryClient();
  
  // Load ALL toilets once and cache them
  const { data: allToilets = [], isLoading, error } = useQuery({
    queryKey: ['all-toilets'],
    queryFn: fetchAllToilets,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
  
  // Filter toilets by current viewport and create clusters
  const visibleToilets = useMemo(() => {
    if (!bounds || !allToilets.length) return [];
    
    // Filter by viewport with buffer
    const filteredToilets = filterToiletsByViewport(allToilets, bounds, 2);
    
    // Create clusters based on zoom level
    const clusteredToilets = createClusters(filteredToilets, zoomLevel);
    
    // Viewport filtering and clustering complete
    
    return clusteredToilets;
  }, [allToilets, bounds, zoomLevel]);
  
  return {
    toilets: visibleToilets,
    allToiletsCount: allToilets.length,
    isLoading,
    error,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['all-toilets'] })
  };
}

// Hook for adding toilets with smart cache updates
export function useAddToiletOptimized() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: addToilet,
    
    // Optimistic update
    onMutate: async (toiletData: NewToiletData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['all-toilets'] });
      
      // Get snapshot of current data
      const previousToilets = queryClient.getQueryData(['all-toilets']);
      
      // Create temporary toilet object
      const tempToilet: Toilet = {
        id: `temp-${Date.now()}`,
        coordinates: { lat: toiletData.lat, lng: toiletData.lng },
        lat: toiletData.lat,
        lng: toiletData.lng,
        title: toiletData.title,
        type: toiletData.type as any,
        accessibility: toiletData.accessibility || 'unknown',
        accessType: toiletData.accessType || 'unknown',
        userId: toiletData.userId,
        source: 'user',
        addedByUserName: toiletData.addedByUserName,
        averageRating: 0,
        reviewCount: 0,
        reportCount: 0,
        isRemoved: false,
        createdAt: new Date(),
        isTemporary: true
      } as any;
      
      // Add to cache immediately
      queryClient.setQueryData(['all-toilets'], (old: Toilet[] | undefined) => {
        return old ? [...old, tempToilet] : [tempToilet];
      });
      
      return { previousToilets, tempToilet };
    },
    
    // Success: replace temp with real data
    onSuccess: (newToilet, toiletData, context) => {
      if (!context) return;
      
      queryClient.setQueryData(['all-toilets'], (old: Toilet[] | undefined) => {
        if (!old) return [newToilet];
        
        // Replace temporary toilet with real one
        return old.map(toilet => 
          toilet.id === context.tempToilet.id ? newToilet : toilet
        );
      });
      
      toast({
        title: "Toilet Added Successfully!",
        description: "Your toilet location is now visible to everyone."
      });
    },
    
    // Error: rollback changes
    onError: (error, toiletData, context) => {
      if (!context) return;
      
      // Restore previous state
      queryClient.setQueryData(['all-toilets'], context.previousToilets);
      
      toast({
        title: "Failed to Add Toilet",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    }
  });
}

// Export utility functions
export { filterToiletsByViewport, createClusters };