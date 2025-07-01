import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { toilets, reviews, reports, type Toilet, type Review, type Report, type InsertToilet, type InsertReview, type InsertReport } from "@shared/schema";
import { eq, and, avg, count, desc } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

export interface IStorage {
  // Toilet operations
  createToilet(toilet: InsertToilet): Promise<string>;
  getToilets(): Promise<Toilet[]>;
  getToiletsNearby(lat: number, lng: number, radiusKm?: number): Promise<Toilet[]>;
  
  // Review operations
  createReview(review: InsertReview): Promise<void>;
  getReviewsForToilet(toiletId: string): Promise<Review[]>;
  hasUserReviewedToilet(toiletId: string, userId: string): Promise<boolean>;
  
  // Report operations
  createReport(report: InsertReport): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createToilet(toilet: InsertToilet): Promise<string> {
    const [newToilet] = await db.insert(toilets).values({
      type: toilet.type,
      lat: toilet.coordinates.lat,
      lng: toilet.coordinates.lng,
      notes: toilet.notes,
      userId: toilet.userId,
    }).returning({ id: toilets.id });
    
    return newToilet.id;
  }

  async getToilets(): Promise<Toilet[]> {
    const result = await db.select().from(toilets).orderBy(desc(toilets.createdAt));
    
    return result.map(toilet => ({
      id: toilet.id,
      type: toilet.type,
      coordinates: { lat: toilet.lat, lng: toilet.lng },
      lat: toilet.lat,
      lng: toilet.lng,
      notes: toilet.notes,
      userId: toilet.userId,
      createdAt: toilet.createdAt,
      averageRating: toilet.averageRating || 0,
      reviewCount: toilet.reviewCount,
    }));
  }

  async getToiletsNearby(lat: number, lng: number, radiusKm: number = 10): Promise<Toilet[]> {
    // Simple distance calculation - in production you'd use PostGIS for better performance
    const toiletsList = await this.getToilets();
    
    return toiletsList.filter(toilet => {
      const distance = this.calculateDistance(lat, lng, toilet.coordinates.lat, toilet.coordinates.lng);
      return distance <= radiusKm;
    });
  }

  async createReview(review: InsertReview): Promise<void> {
    await db.insert(reviews).values(review);
    
    // Update toilet average rating and review count
    const [stats] = await db
      .select({
        avgRating: avg(reviews.rating),
        reviewCount: count(reviews.id)
      })
      .from(reviews)
      .where(eq(reviews.toiletId, review.toiletId));

    await db
      .update(toilets)
      .set({
        averageRating: Number(stats.avgRating) || 0,
        reviewCount: Number(stats.reviewCount) || 0,
      })
      .where(eq(toilets.id, review.toiletId));
  }

  async getReviewsForToilet(toiletId: string): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.toiletId, toiletId))
      .orderBy(desc(reviews.createdAt));
  }

  async hasUserReviewedToilet(toiletId: string, userId: string): Promise<boolean> {
    const [review] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.toiletId, toiletId), eq(reviews.userId, userId)))
      .limit(1);
    
    return !!review;
  }

  async createReport(report: InsertReport): Promise<void> {
    await db.insert(reports).values(report);
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const storage = new DatabaseStorage();