import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { toilets, reviews, reports, toiletReports, type Toilet, type Review, type Report, type ToiletReport, type InsertToilet, type InsertReview, type InsertReport, type InsertToiletReport } from "@shared/schema";
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
  
  // Toilet reporting operations
  reportToiletNotExists(toiletReport: InsertToiletReport): Promise<void>;
  getToiletReportCount(toiletId: string): Promise<number>;
  hasUserReportedToilet(toiletId: string, userId: string): Promise<boolean>;
  removeToiletFromReports(toiletId: string): Promise<void>;
  
  // Admin operations
  deleteToilet(toiletId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createToilet(toilet: InsertToilet): Promise<string> {
    const [newToilet] = await db.insert(toilets).values({
      type: toilet.type,
      lat: toilet.coordinates.lat,
      lng: toilet.coordinates.lng,
      notes: toilet.notes,
      userId: toilet.userId,
      source: toilet.source || 'user',
      addedByUserName: toilet.addedByUserName,
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
      source: toilet.source,
      addedByUserName: toilet.addedByUserName,
      osmId: toilet.osmId,
      tags: toilet.tags as any,
      reportCount: toilet.reportCount,
      isRemoved: toilet.isRemoved,
      removedAt: toilet.removedAt,
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

  async reportToiletNotExists(toiletReport: InsertToiletReport): Promise<void> {
    // Check if user has already reported this toilet
    const existingReport = await db
      .select()
      .from(toiletReports)
      .where(and(
        eq(toiletReports.toiletId, toiletReport.toiletId),
        eq(toiletReports.userId, toiletReport.userId)
      ))
      .limit(1);

    if (existingReport.length > 0) {
      return; // User has already reported this toilet
    }

    // Add the report
    await db.insert(toiletReports).values({
      toiletId: toiletReport.toiletId,
      userId: toiletReport.userId,
      userName: toiletReport.userName,
    });

    // Update report count
    const reportCount = await this.getToiletReportCount(toiletReport.toiletId);
    
    // If 10 or more reports, mark toilet as removed
    if (reportCount >= 10) {
      await this.removeToiletFromReports(toiletReport.toiletId);
    } else {
      // Update the report count
      await db.update(toilets)
        .set({ reportCount: reportCount })
        .where(eq(toilets.id, toiletReport.toiletId));
    }
  }

  async getToiletReportCount(toiletId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(toiletReports)
      .where(eq(toiletReports.toiletId, toiletId));
    
    return result[0]?.count || 0;
  }

  async hasUserReportedToilet(toiletId: string, userId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(toiletReports)
      .where(and(
        eq(toiletReports.toiletId, toiletId),
        eq(toiletReports.userId, userId)
      ))
      .limit(1);
    
    return result.length > 0;
  }

  async removeToiletFromReports(toiletId: string): Promise<void> {
    await db.update(toilets)
      .set({ 
        isRemoved: true, 
        removedAt: new Date() 
      })
      .where(eq(toilets.id, toiletId));
  }

  async deleteToilet(toiletId: string): Promise<void> {
    // Hard delete the toilet and all related data
    await db.delete(toiletReports).where(eq(toiletReports.toiletId, toiletId));
    await db.delete(reviews).where(eq(reviews.toiletId, toiletId));
    await db.delete(reports).where(eq(reports.toiletId, toiletId));
    await db.delete(toilets).where(eq(toilets.id, toiletId));
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