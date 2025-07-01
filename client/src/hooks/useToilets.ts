import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToilets, getToiletsNearby, addToilet, getReviewsForToilet, addReview, addReport, hasUserReviewedToilet } from "@/lib/firebase";
import type { Toilet, InsertToilet, InsertReview, InsertReport, Review, MapLocation } from "@/types/toilet";

export const useToilets = (location?: MapLocation) => {
  const queryKey = location ? ["toilets", "nearby", location.lat, location.lng] : ["toilets"];
  
  return useQuery({
    queryKey,
    queryFn: () => {
      if (location) {
        return getToiletsNearby(location.lat, location.lng);
      }
      return getToilets();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAddToilet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addToilet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
    },
  });
};

export const useToiletReviews = (toiletId: string) => {
  return useQuery({
    queryKey: ["reviews", toiletId],
    queryFn: () => getReviewsForToilet(toiletId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useAddReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addReview,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", variables.toiletId] });
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
    },
  });
};

export const useAddReport = () => {
  return useMutation({
    mutationFn: addReport,
  });
};

export const useUserReviewStatus = (toiletId: string, userId?: string) => {
  return useQuery({
    queryKey: ["user-review", toiletId, userId],
    queryFn: () => userId ? hasUserReviewedToilet(toiletId, userId) : Promise.resolve(false),
    enabled: !!userId,
  });
};
