import { z } from "zod";

export const toiletTypeSchema = z.enum([
  "public",
  "restaurant", 
  "cafe",
  "gas-station",
  "mall",
  "other"
]);

export const reportReasonSchema = z.enum([
  "doesnt-exist",
  "inaccessible", 
  "closed",
  "other"
]);

export const toiletSchema = z.object({
  id: z.string(),
  type: toiletTypeSchema,
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  notes: z.string().optional(),
  userId: z.string(),
  createdAt: z.date(),
  averageRating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().min(0).default(0)
});

export const reviewSchema = z.object({
  id: z.string(),
  toiletId: z.string(),
  userId: z.string(),
  userName: z.string(),
  rating: z.number().min(1).max(5),
  text: z.string().optional(),
  createdAt: z.date()
});

export const reportSchema = z.object({
  id: z.string(),
  toiletId: z.string(),
  userId: z.string().optional(),
  reason: reportReasonSchema,
  comment: z.string().optional(),
  createdAt: z.date()
});

export const insertToiletSchema = toiletSchema.omit({ 
  id: true, 
  createdAt: true, 
  averageRating: true, 
  reviewCount: true 
});

export const insertReviewSchema = reviewSchema.omit({ 
  id: true, 
  createdAt: true 
});

export const insertReportSchema = reportSchema.omit({ 
  id: true, 
  createdAt: true 
});

export type Toilet = z.infer<typeof toiletSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Report = z.infer<typeof reportSchema>;
export type InsertToilet = z.infer<typeof insertToiletSchema>;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type ToiletType = z.infer<typeof toiletTypeSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
