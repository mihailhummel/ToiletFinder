import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertToiletSchema, insertReviewSchema, insertReportSchema, insertToiletReportSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Toilet routes
  app.get("/api/toilets", async (req: Request, res: Response) => {
    try {
      const { lat, lng, radius } = req.query;
      
      if (lat && lng) {
        const toilets = await storage.getToiletsNearby(
          parseFloat(lat as string),
          parseFloat(lng as string),
          radius ? parseFloat(radius as string) : 10
        );
        res.json(toilets);
      } else {
        const toilets = await storage.getToilets();
        res.json(toilets);
      }
    } catch (error) {
      console.error("Error fetching toilets:", error);
      res.status(500).json({ error: "Failed to fetch toilets" });
    }
  });

  app.post("/api/toilets", async (req: Request, res: Response) => {
    try {
      const toiletData = insertToiletSchema.parse(req.body);
      const toiletId = await storage.createToilet(toiletData);
      res.json({ id: toiletId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid toilet data", details: error.errors });
      } else {
        console.error("Error creating toilet:", error);
        res.status(500).json({ error: "Failed to create toilet" });
      }
    }
  });

  // Review routes
  app.get("/api/toilets/:toiletId/reviews", async (req: Request, res: Response) => {
    try {
      const { toiletId } = req.params;
      const reviews = await storage.getReviewsForToilet(toiletId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/toilets/:toiletId/reviews", async (req: Request, res: Response) => {
    try {
      const { toiletId } = req.params;
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        toiletId,
      });
      
      // Check if user already reviewed this toilet
      const hasReviewed = await storage.hasUserReviewedToilet(toiletId, reviewData.userId);
      if (hasReviewed) {
        return res.status(409).json({ error: "User has already reviewed this toilet" });
      }
      
      await storage.createReview(reviewData);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Review validation error:", error.errors);
        res.status(400).json({ error: "Invalid review data", details: error.errors });
      } else {
        console.error("Error creating review:", error);
        res.status(500).json({ error: "Failed to create review" });
      }
    }
  });

  app.get("/api/toilets/:toiletId/user-review-status", async (req: Request, res: Response) => {
    try {
      const { toiletId } = req.params;
      const { userId } = req.query;
      
      if (!userId) {
        return res.json({ hasReviewed: false });
      }
      
      const hasReviewed = await storage.hasUserReviewedToilet(toiletId, userId as string);
      res.json({ hasReviewed });
    } catch (error) {
      console.error("Error checking review status:", error);
      res.status(500).json({ error: "Failed to check review status" });
    }
  });

  // Report routes
  app.post("/api/reports", async (req: Request, res: Response) => {
    try {
      const reportData = insertReportSchema.parse(req.body);
      await storage.createReport(reportData);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid report data", details: error.errors });
      } else {
        console.error("Error creating report:", error);
        res.status(500).json({ error: "Failed to create report" });
      }
    }
  });

  // Toilet reporting routes  
  app.post("/api/toilets/:toiletId/report-not-exists", async (req: Request, res: Response) => {
    try {
      const { toiletId } = req.params;
      const { userId, userName } = req.body;
      
      if (!userId || !userName) {
        return res.status(400).json({ error: "userId and userName are required" });
      }

      await storage.reportToiletNotExists({
        toiletId,
        userId,
        userName
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error reporting toilet:", error);
      res.status(500).json({ error: "Failed to report toilet" });
    }
  });

  app.get("/api/toilets/:toiletId/report-status", async (req: Request, res: Response) => {
    try {
      const { toiletId } = req.params;
      const { userId } = req.query;
      
      const reportCount = await storage.getToiletReportCount(toiletId);
      let hasUserReported = false;
      
      if (userId) {
        hasUserReported = await storage.hasUserReportedToilet(toiletId, userId as string);
      }
      
      res.json({ 
        reportCount, 
        hasUserReported,
        isRemoved: reportCount >= 10
      });
    } catch (error) {
      console.error("Error getting report status:", error);
      res.status(500).json({ error: "Failed to get report status" });
    }
  });

  // Admin-only delete toilet endpoint
  app.delete("/api/toilets/:toiletId", async (req: Request, res: Response) => {
    try {
      const { toiletId } = req.params;
      
      // For now, we'll add admin check in the frontend
      // In production, you'd verify the user's JWT token here
      
      await storage.deleteToilet(toiletId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting toilet:", error);
      res.status(500).json({ error: "Failed to delete toilet" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
