import { useQueries, useQueryClient, useMutation } from '@tanstack/react-query';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Toilet } from '@/types/toilet';
import { useToast } from '@/hooks/use-toast';

const CHUNK_SIZE = 0.05; // ~5.5km squares

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
}

// Generate chunk key from coordinates
function getChunkKey(lat: number, lng: number): string {
  const chunkLat = Math.floor(lat / CHUNK_SIZE) * CHUNK_SIZE;
  const chunkLng = Math.floor(lng / CHUNK_SIZE) * CHUNK_SIZE;
  return `chunk-${chunkLat.toFixed(2)}-${chunkLng.toFixed(2)}`;
}

// Get required chunks for a viewport with smart limits
function getRequiredChunks(bounds: ViewportBounds): string[] {
  const chunks: string[] = [];
  
  // Calculate viewport size
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;
  
  // If viewport is too large (zoomed out too much), use fallback approach
  const MAX_CHUNKS = 9; // 3x3 grid maximum
  const maxLatChunks = Math.ceil(latRange / CHUNK_SIZE);
  const maxLngChunks = Math.ceil(lngRange / CHUNK_SIZE);
  const totalChunks = maxLatChunks * maxLngChunks;
  
  if (totalChunks > MAX_CHUNKS) {
    console.log(`⚠️ Viewport too large: ${totalChunks} chunks needed, limiting to center area`);
    
    // Use center chunk + immediate neighbors only
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    const centerChunkLat = Math.floor(centerLat / CHUNK_SIZE) * CHUNK_SIZE;
    const centerChunkLng = Math.floor(centerLng / CHUNK_SIZE) * CHUNK_SIZE;
    
    // 3x3 grid around center
    for (let latOffset = -CHUNK_SIZE; latOffset <= CHUNK_SIZE; latOffset += CHUNK_SIZE) {
      for (let lngOffset = -CHUNK_SIZE; lngOffset <= CHUNK_SIZE; lngOffset += CHUNK_SIZE) {
        chunks.push(getChunkKey(centerChunkLat + latOffset, centerChunkLng + lngOffset));
      }
    }
    
    return chunks;
  }
  
  // Normal case: load all chunks in viewport
  const startLat = Math.floor(bounds.south / CHUNK_SIZE) * CHUNK_SIZE;
  const endLat = Math.ceil(bounds.north / CHUNK_SIZE) * CHUNK_SIZE;
  const startLng = Math.floor(bounds.west / CHUNK_SIZE) * CHUNK_SIZE;
  const endLng = Math.ceil(bounds.east / CHUNK_SIZE) * CHUNK_SIZE;
  
  for (let lat = startLat; lat <= endLat; lat += CHUNK_SIZE) {
    for (let lng = startLng; lng <= endLng; lng += CHUNK_SIZE) {
      chunks.push(getChunkKey(lat, lng));
    }
  }
  
  // Normal viewport chunks calculated
  return chunks;
}

// Fetch toilets for a specific chunk
async function fetchToiletsForChunk(chunkKey: string): Promise<Toilet[]> {
  try {
    // Fetching chunk data
    const response = await fetch(`/api/toilets/chunk/${chunkKey}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Chunk loaded successfully
    return data;
  } catch (error) {
    console.error(`❌ Error fetching chunk ${chunkKey}:`, error);
    throw error;
  }
}

// Add a new toilet
async function addToilet(toiletData: NewToiletData): Promise<Toilet> {
  const response = await fetch('/api/toilets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toiletData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to add toilet');
  }
  
  return response.json();
}

// Main hook for chunk-based toilet loading
export function useToiletChunks(bounds: ViewportBounds | undefined) {
  const queryClient = useQueryClient();
  
  const requiredChunks = useMemo(() => {
    const chunks = bounds ? getRequiredChunks(bounds) : [];
    console.log(`🗺️ Required chunks for bounds:`, bounds, '→', chunks.length, 'chunks');
    return chunks;
  }, [bounds]);
  
  // Debounce bounds changes to prevent rapid chunk loading during map movement
  const [debouncedChunks, setDebouncedChunks] = useState<string[]>([]);
  const boundsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear existing timeout
    if (boundsTimeoutRef.current) {
      clearTimeout(boundsTimeoutRef.current);
    }
    
    // Debounce chunk calculation by 500ms
    boundsTimeoutRef.current = setTimeout(() => {
      setDebouncedChunks(requiredChunks);
    }, 500);
    
    return () => {
      if (boundsTimeoutRef.current) {
        clearTimeout(boundsTimeoutRef.current);
      }
    };
  }, [requiredChunks]);

  // Batch chunk loading: only load first 6 chunks initially, then load more
  const [enabledChunks, setEnabledChunks] = useState<string[]>([]);
  
  useEffect(() => {
    if (debouncedChunks.length === 0) {
      setEnabledChunks([]);
      return;
    }
    
    // Load chunks in batches of 4 to prevent overwhelming the server
    const BATCH_SIZE = 4;
    const firstBatch = debouncedChunks.slice(0, BATCH_SIZE);
    setEnabledChunks(firstBatch);
    
    // Load remaining chunks after a delay
    if (debouncedChunks.length > BATCH_SIZE) {
      setTimeout(() => {
        setEnabledChunks(debouncedChunks);
      }, 800); // 800ms delay
    }
  }, [debouncedChunks]);

  // Query each enabled chunk separately
  const chunkQueries = useQueries({
    queries: enabledChunks.map(chunkKey => ({
      queryKey: ['toilet-chunk', chunkKey],
      queryFn: () => fetchToiletsForChunk(chunkKey),
      staleTime: 30 * 60 * 1000, // 30 minutes - long cache
      gcTime: 60 * 60 * 1000, // 1 hour
      refetchOnWindowFocus: false,
      enabled: !!bounds, // Only fetch when bounds are available
    }))
  });

  // Combine all chunk data into a single array
  const allToilets = useMemo(() => {
    const toilets = chunkQueries
      .filter(query => query.data)
      .flatMap(query => query.data || []);
    // Chunk system processing complete
    return toilets;
  }, [chunkQueries, enabledChunks.length, debouncedChunks.length]);

  const isLoading = chunkQueries.some(q => q.isLoading);
  const hasError = chunkQueries.some(q => q.error);
  const error = chunkQueries.find(q => q.error)?.error;

  return {
    toilets: allToilets,
    isLoading,
    error: hasError ? error : null,
    refetch: () => {
      chunkQueries.forEach(query => query.refetch());
    }
  };
}

// Hook for adding toilets with optimistic updates
export function useAddToilet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: addToilet,
    
    // 🚀 INSTANT: Show toilet immediately (optimistic update)
    onMutate: async (toiletData: NewToiletData) => {
      const tempToilet: Toilet = {
        id: `temp-${Date.now()}`,
        coordinates: { lat: toiletData.lat, lng: toiletData.lng },
        title: toiletData.title,
        type: toiletData.type as any,
        accessibility: toiletData.accessibility || '',
        accessType: toiletData.accessType || '',
        reviews: [],
        averageRating: 0,
        createdAt: new Date().toISOString(),
        isTemporary: true // Flag for styling
      } as any;
      
      const chunkKey = getChunkKey(toiletData.lat, toiletData.lng);
      
      // Cancel any outgoing refetches for this chunk
      await queryClient.cancelQueries({ queryKey: ['toilet-chunk', chunkKey] });
      
      // Get snapshot of current data
      const previousChunk = queryClient.getQueryData(['toilet-chunk', chunkKey]);
      
      // Add toilet to cache immediately
      queryClient.setQueryData(['toilet-chunk', chunkKey], (old: Toilet[] | undefined) => {
        return old ? [...old, tempToilet] : [tempToilet];
      });
      
      return { previousChunk, tempToilet, chunkKey };
    },
    
    // ✅ SUCCESS: Replace with real data
    onSuccess: (newToilet, toiletData, context) => {
      if (!context) return;
      
      queryClient.setQueryData(['toilet-chunk', context.chunkKey], (old: Toilet[] | undefined) => {
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
    
    // ❌ ERROR: Rollback changes
    onError: (error, toiletData, context) => {
      if (!context) return;
      
      // Restore previous state
      queryClient.setQueryData(['toilet-chunk', context.chunkKey], context.previousChunk);
      
      toast({
        title: "Failed to Add Toilet",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    }
  });
}

// Export utility functions for use elsewhere
export { getChunkKey, getRequiredChunks };