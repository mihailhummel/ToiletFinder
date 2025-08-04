import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Toilet, InsertToilet, InsertReview, InsertReport, Review, MapLocation } from "@/types/toilet";

// 🎯 SIMPLIFIED TOILET HOOKS - Single source of truth with React Query

interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 📍 Main hook for fetching toilets in viewport
export const useToiletsInViewport = (viewport?: ViewportBounds) => {
  return useQuery({
    queryKey: ['toilets-viewport', viewport],
    queryFn: async () => {
      if (!viewport) return [];
      
      const params = new URLSearchParams({
        minLat: viewport.minLat.toString(),
        maxLat: viewport.maxLat.toString(),
        minLng: viewport.minLng.toString(),
        maxLng: viewport.maxLng.toString()
      });
      
      const response = await fetch(`/api/toilets-in-area?${params}`);
      if (!response.ok) throw new Error('Failed to fetch toilets');
      
      return await response.json() as Toilet[];
    },
    enabled: !!viewport,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,   // 30 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 503 (quota exceeded)
      if ((error as any)?.message?.includes('503')) return false;
      return failureCount < 2;
    },
  });
};

// 🚽 Legacy hook for backward compatibility
export const useToilets = (location?: MapLocation) => {
  return useQuery({
    queryKey: ["toilets", location?.lat, location?.lng],
    queryFn: async () => {
      if (!location) return [];
      
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        radius: '15' // 15km radius
      });
      
      const response = await fetch(`/api/toilets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch toilets');
      
      return await response.json() as Toilet[];
    },
    enabled: !!location,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,   // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

// ➕ Add toilet mutation
export const useAddToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (toilet: InsertToilet): Promise<Toilet> => {
      const response = await apiRequest("POST", "/api/toilets", toilet);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate all toilet queries to refresh the map
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
      queryClient.invalidateQueries({ queryKey: ["toilets-viewport"] });
      queryClient.invalidateQueries({ queryKey: ["toilets-supabase"] });
    },
    onError: (error) => {
      console.error("Failed to add toilet:", error);
    },
  });
};

// ⭐ Toilet reviews
export const useToiletReviews = (toiletId: string) => {
  return useQuery({
    queryKey: ["toilets", toiletId, "reviews"],
    queryFn: async (): Promise<Review[]> => {
      const response = await apiRequest("GET", `/api/toilets/${toiletId}/reviews`);
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!toiletId,
  });
};

// 📝 Add review mutation
export const useAddReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ toiletId, review }: { toiletId: string; review: InsertReview }): Promise<Review> => {
      const response = await apiRequest("POST", `/api/toilets/${toiletId}/reviews`, review);
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["toilets", variables.toiletId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
    },
  });
};

// 🚨 Report mutations
export const useAddReport = () => {
  return useMutation({
    mutationFn: async (report: InsertReport): Promise<void> => {
      await apiRequest("POST", "/api/reports", report);
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

// 🗑️ Delete toilet (admin only)
export const useDeleteToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ toiletId, adminEmail, userId }: { toiletId: string; adminEmail: string; userId: string }): Promise<void> => {
      const response = await fetch(`/api/toilets/${toiletId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail, userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete toilet');
      }
    },
    onSuccess: () => {
      // Invalidate all toilet queries
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
      queryClient.invalidateQueries({ queryKey: ["toilets-viewport"] });
      queryClient.invalidateQueries({ queryKey: ["toilets-supabase"] });
    },
    onError: (error) => {
      console.error("Failed to delete toilet:", error);
    },
  });
};

// 🧹 Utility function to clear all caches (for debugging)
export const clearAllCaches = () => {
  // Clear localStorage
  localStorage.clear();
  
  // Clear React Query cache
  const queryClient = useQueryClient();
  queryClient.clear();
  
  console.log('🧹 All caches cleared');
};