import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Toilet, InsertToilet, InsertReview, InsertReport, Review, MapLocation } from "@/types/toilet";

export const useToilets = (location?: MapLocation) => {
  const queryKey = location ? ["toilets", "nearby", location.lat, location.lng] : ["toilets"];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = location ? 
        new URLSearchParams({
          lat: location.lat.toString(),
          lng: location.lng.toString(),
          radius: '10'
        }) : '';
      
      const url = `/api/toilets${params ? `?${params}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch toilets');
      return response.json() as Promise<Toilet[]>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAddToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (toilet: InsertToilet) => {
      const response = await apiRequest('POST', '/api/toilets', toilet);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
    },
  });
};

export const useToiletReviews = (toiletId: string) => {
  return useQuery({
    queryKey: ["reviews", toiletId],
    queryFn: async () => {
      const response = await fetch(`/api/toilets/${toiletId}/reviews`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      return response.json() as Promise<Review[]>;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useAddReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (review: InsertReview) => {
      const response = await apiRequest('POST', `/api/toilets/${review.toiletId}/reviews`, review);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", variables.toiletId] });
      // Don't invalidate toilets cache to avoid clearing map markers
    },
  });
};

export const useAddReport = () => {
  return useMutation({
    mutationFn: async (report: InsertReport) => {
      const response = await apiRequest('POST', '/api/reports', report);
      return response.json();
    },
  });
};

export const useUserReviewStatus = (toiletId: string, userId?: string) => {
  return useQuery({
    queryKey: ["user-review", toiletId, userId],
    queryFn: async () => {
      if (!userId) return false;
      
      const params = new URLSearchParams();
      params.set('userId', userId);
      
      const response = await fetch(`/api/toilets/${toiletId}/user-review-status?${params}`);
      if (!response.ok) throw new Error('Failed to check review status');
      const data = await response.json();
      return data.hasReviewed as boolean;
    },
    enabled: !!userId,
  });
};

export const useDeleteToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (toiletId: string) => {
      const response = await apiRequest('DELETE', `/api/toilets/${toiletId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
    },
  });
};
