import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { auth } from "@/lib/firebase";
import type { Toilet, InsertReview, InsertReport, Review } from "@/types/toilet";

// Caching is React Query's job. The only localStorage remnant is the key below,
// cleared on delete so a removed toilet can't be resurrected from an old cache
// written by a previous version of the app.
const CACHE_KEY = 'toilet-map-cache';

export const useUpdateToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ toiletId, updateData, idToken }: {
      toiletId: string;
      idToken: string;
      updateData: { type: string; title: string; accessibility: string; accessType: string; notes?: string; coordinates?: { lat: number; lng: number } };
    }) => {
      const response = await fetch(`/api/toilets/${toiletId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update toilet');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['toilets'] });

      // Patch the map's cache in place rather than invalidating it. Invalidating
      // triggers a refetch of /api/toilets, which the browser may answer from its
      // own 30s HTTP cache вЂ” so the edit could appear not to have applied. We use
      // the row the server echoes back, not the request body, because the server
      // strips coordinates/isDomestos for non-admins.
      if (data?.toilet) {
        queryClient.setQueryData(['all-toilets'], (old: Toilet[] | undefined) =>
          old?.map((t) => (t.id === variables.toiletId ? data.toilet : t))
        );
      }
    },
  });
};

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

export const useAddReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ toiletId, review }: { toiletId: string; review: InsertReview }): Promise<{
      review: Review;
      toilet: { id: string; averageRating: number; reviewCount: number } | null;
    }> => {
      const response = await apiRequest("POST", `/api/toilets/${toiletId}/reviews`, review);
      return await response.json();
    },
    // Both caches are patched from the POST response вЂ” no refetch anywhere.
    //
    // This previously invalidated ["toilets", id, "reviews"] and ["all-toilets"],
    // but both routes send `Cache-Control: max-age=30`, and the fetches don't set
    // a cache mode, so the browser answered the refetch from its own HTTP cache.
    // In the normal flow (open a toilet, read the reviews, then write one) that
    // response is only seconds old вЂ” so the user could not see their own review,
    // or the marker's updated rating, for up to 30 seconds.
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
      queryClient.invalidateQueries({ queryKey: ["toilets-supabase"] });

      if (data?.review) {
        // Insert exactly what the server sent вЂ” same shape the GET route yields
        // (createdAt is an ISO string over JSON). Converting it here would make
        // this one entry differ from every other review in the list.
        queryClient.setQueryData(
          ["toilets", variables.toiletId, "reviews"],
          (old: Review[] | undefined) => (old ? [data.review, ...old] : [data.review])
        );
      }

      // The map renders from 'all-toilets' вЂ” patch this marker's aggregates, which
      // the DB trigger recomputed and the server returned to us.
      if (data?.toilet) {
        queryClient.setQueryData(['all-toilets'], (old: Toilet[] | undefined) =>
          old?.map((t) =>
            t.id === variables.toiletId
              ? { ...t, averageRating: data.toilet!.averageRating, reviewCount: data.toilet!.reviewCount }
              : t
          )
        );
      }

      // The user just reviewed this toilet вЂ” reflect that without a round trip so
      // the "already reviewed" guard is correct immediately.
      queryClient.setQueryData(
        ["user-review-status", variables.toiletId, variables.review.userId],
        { hasReviewed: true }
      );
    },
  });
};

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

      // Endpoint is auth-gated; apiRequest attaches the Firebase token and the
      // server derives identity from it (the userId query param is ignored).
      const response = await apiRequest("GET", `/api/toilets/${toiletId}/user-review`);
      return await response.json();
    },
    enabled: !!toiletId && !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDeleteToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ toiletId }: { toiletId: string; adminEmail?: string; userId?: string }): Promise<void> => {
      const user = auth?.currentUser;
      if (!user) {
        throw new Error('Authentication required');
      }
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/toilets/${toiletId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      });
      
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("вќЊ Delete failed:", errorData);
        throw new Error(errorData.error || 'Failed to delete toilet');
      }
      
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
      queryClient.invalidateQueries({ queryKey: ["toilets-supabase"] });

      // The map renders from 'all-toilets' вЂ” splice the marker out directly. This
      // used to invalidate, which refetches /api/toilets; that response carries
      // `max-age=30`, so the browser could serve a pre-delete list from its own
      // HTTP cache and the pin would reappear. The server has already removed it
      // from its cached list, so no round trip is needed to agree.
      queryClient.setQueryData(['all-toilets'], (old: Toilet[] | undefined) =>
        old?.filter((t) => t.id !== variables.toiletId)
      );

      // Clear cache to ensure deleted toilet doesn't show up
      clearToiletCache();

    },
    onError: (error) => {
      console.error("вќЊ Failed to delete toilet:", error);
    },
  });
};

// Clear cache utility
export const clearToiletCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear toilet cache:', error);
  }
};

