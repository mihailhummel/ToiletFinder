import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import serviceAccount from "./findwc-2be85-firebase-adminsdk-fbsvc-a1b97ea513.json";
import { toilets, reviews, reports, toiletReports, type Toilet, type Review, type Report, type ToiletReport, type InsertToilet, type InsertReview, type InsertReport, type InsertToiletReport } from "@shared/schema";

// Initialize firebase-admin only once
let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount as any),
  });
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

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
    const toiletData = {
      ...toilet,
      createdAt: Timestamp.now(),
      averageRating: 0,
      reviewCount: 0,
      reportCount: 0,
      isRemoved: false,
      removedAt: null,
    };
    const docRef = await db.collection("toilets").add(toiletData);
    await docRef.update({ id: docRef.id });
    return docRef.id;
  }

  async getToilets(): Promise<Toilet[]> {
    const snapshot = await db.collection("toilets").orderBy("createdAt", "desc").get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
    })) as Toilet[];
  }

  async getToiletsNearby(lat: number, lng: number, radiusKm: number = 10): Promise<Toilet[]> {
    const toiletsList = await this.getToilets();
    return toiletsList.filter(toilet => {
      const distance = this.calculateDistance(lat, lng, toilet.coordinates.lat, toilet.coordinates.lng);
      return distance <= radiusKm;
    });
  }

  async createReview(review: InsertReview): Promise<void> {
    const batch = db.batch();
    const reviewRef = db.collection("reviews").doc();
    batch.set(reviewRef, { ...review, createdAt: Timestamp.now() });
    
    // Update toilet stats
    const toiletRef = db.collection("toilets").doc(review.toiletId);
    const reviewsSnap = await db.collection("reviews").where("toiletId", "==", review.toiletId).get();
    const currentReviews = reviewsSnap.docs.map(doc => doc.data() as Review);
    const newReviewCount = currentReviews.length + 1;
    const totalRating = currentReviews.reduce((sum, r) => sum + r.rating, 0) + review.rating;
    const newAverageRating = totalRating / newReviewCount;
    batch.update(toiletRef, {
      reviewCount: newReviewCount,
      averageRating: Math.round(newAverageRating * 10) / 10,
    });
    await batch.commit();
  }

  async getReviewsForToilet(toiletId: string): Promise<Review[]> {
    const snapshot = await db.collection("reviews")
      .where("toiletId", "==", toiletId)
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
    })) as Review[];
  }

  async hasUserReviewedToilet(toiletId: string, userId: string): Promise<boolean> {
    const snapshot = await db.collection("reviews")
      .where("toiletId", "==", toiletId)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    return !snapshot.empty;
  }

  async createReport(report: InsertReport): Promise<void> {
    await db.collection("reports").add({ ...report, createdAt: Timestamp.now() });
  }

  async reportToiletNotExists(toiletReport: InsertToiletReport): Promise<void> {
    // Check if user has already reported this toilet
    const existingReport = await db.collection("toiletReports")
      .where("toiletId", "==", toiletReport.toiletId)
      .where("userId", "==", toiletReport.userId)
      .limit(1)
      .get();
    if (!existingReport.empty) return;

    // Add the report
    await db.collection("toiletReports").add({
      ...toiletReport,
      createdAt: Timestamp.now(),
    });

    // Update report count
    const reportCount = await this.getToiletReportCount(toiletReport.toiletId);
    const toiletRef = db.collection("toilets").doc(toiletReport.toiletId);
    if (reportCount >= 10) {
      await this.removeToiletFromReports(toiletReport.toiletId);
    } else {
      await toiletRef.update({ reportCount });
    }
  }

  async getToiletReportCount(toiletId: string): Promise<number> {
    const snapshot = await db.collection("toiletReports")
      .where("toiletId", "==", toiletId)
      .get();
    return snapshot.size;
  }

  async hasUserReportedToilet(toiletId: string, userId: string): Promise<boolean> {
    const snapshot = await db.collection("toiletReports")
      .where("toiletId", "==", toiletId)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    return !snapshot.empty;
  }

  async removeToiletFromReports(toiletId: string): Promise<void> {
    const toiletRef = db.collection("toilets").doc(toiletId);
    await toiletRef.update({
        isRemoved: true, 
      removedAt: Timestamp.now(),
    });
  }

  async deleteToilet(toiletId: string): Promise<void> {
    // Delete all related data
    const batch = db.batch();
    const toiletRef = db.collection("toilets").doc(toiletId);
    // Remove the 'id' field before deleting the document
    await toiletRef.update({ id: FieldValue.delete() });
    const toiletReportsSnap = await db.collection("toiletReports").where("toiletId", "==", toiletId).get();
    toiletReportsSnap.forEach(doc => batch.delete(doc.ref));
    const reviewsSnap = await db.collection("reviews").where("toiletId", "==", toiletId).get();
    reviewsSnap.forEach(doc => batch.delete(doc.ref));
    const reportsSnap = await db.collection("reports").where("toiletId", "==", toiletId).get();
    reportsSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(toiletRef);
    await batch.commit();
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
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