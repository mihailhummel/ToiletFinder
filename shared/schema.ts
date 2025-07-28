import { z } from "zod";
import { pgTable, text, timestamp, real, integer, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

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

// Database Tables - Updated to match actual database structure
export const toilets = pgTable("toilets", {
  id: text("id").primaryKey(), // Using text to match actual DB
  type: text("type").$type<z.infer<typeof toiletTypeSchema>>().notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  notes: text("notes"),
  userId: text("user_id").notNull(),
  source: text("source", { enum: ['osm', 'user'] }).notNull().default('osm'),
  addedByUserName: text("added_by_user_name"),
  osmId: text("osm_id"),
  tags: jsonb("tags"),
  reportCount: integer("report_count").default(0).notNull(),
  isRemoved: boolean("is_removed").default(false).notNull(),
  removedAt: timestamp("removed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  averageRating: real("average_rating").default(0),
  reviewCount: integer("review_count").default(0).notNull(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  toiletId: text("toilet_id").references(() => toilets.id).notNull(), // Using text to match actual DB
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  rating: integer("rating").notNull(),
  text: text("text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  toiletId: text("toilet_id").references(() => toilets.id).notNull(), // Using text to match actual DB
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  reason: text("reason").$type<z.infer<typeof reportReasonSchema>>().notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const toiletReports = pgTable("toilet_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  toiletId: text("toilet_id").references(() => toilets.id).notNull(), // Using text to match actual DB
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod Schemas
export const toiletSchema = createSelectSchema(toilets, {
  type: toiletTypeSchema,
  lat: z.number(),
  lng: z.number(),
  averageRating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().min(0),
}).transform(data => ({
  ...data,
  coordinates: { lat: data.lat, lng: data.lng }
}));

export const reviewSchema = createSelectSchema(reviews, {
  rating: z.number().min(1).max(5),
});

export const reportSchema = createSelectSchema(reports, {
  reason: reportReasonSchema,
});

export const toiletReportSchema = createSelectSchema(toiletReports);

export const insertToiletSchema = z.object({
  type: toiletTypeSchema,
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  notes: z.string().optional(),
  userId: z.string(),
  source: z.enum(['osm', 'user']).default('user'),
  addedByUserName: z.string().optional(),
});

export const insertReviewSchema = z.object({
  toiletId: z.string(),
  userId: z.string(),
  userName: z.string(),
  rating: z.number().min(1).max(5),
  text: z.string().optional(),
});

export const insertReportSchema = z.object({
  toiletId: z.string(),
  userId: z.string(),
  userName: z.string(),
  reason: reportReasonSchema,
  comment: z.string().optional(),
});

export const insertToiletReportSchema = z.object({
  toiletId: z.string(),
  userId: z.string(),
  userName: z.string(),
});

// Type exports
export type Toilet = z.infer<typeof toiletSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ToiletReport = z.infer<typeof toiletReportSchema>;
export type InsertToilet = z.infer<typeof insertToiletSchema>;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type InsertToiletReport = z.infer<typeof insertToiletReportSchema>;
export type ToiletType = z.infer<typeof toiletTypeSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
