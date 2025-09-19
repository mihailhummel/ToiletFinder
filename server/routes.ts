import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertToiletSchema, insertReviewSchema, insertReportSchema, insertToiletReportSchema } from "@shared/schema";
import { z } from "zod";
import { auth } from "../firebase-admin-config.js";

// Calculate distance between two points in kilometers
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Database request monitoring
let dbRequestCount = 0;
let lastResetTime = Date.now();

// Function to generate default title based on toilet type
function getDefaultTitle(type: string): string {
  switch (type) {
    case 'public':
      return 'Public Toilet';
    case 'restaurant':
      return 'Restaurant Toilet';
    case 'cafe':
      return 'Cafe Toilet';
    case 'gas-station':
      return 'Gas Station Toilet';
    case 'mall':
      return 'Mall Toilet';
    case 'other':
      return 'Toilet';
    default:
      return 'Toilet';
  }
}

function logDatabaseRequest(endpoint: string, details: string = '') {
  dbRequestCount++;
  const elapsed = Date.now() - lastResetTime;
  
  // Only log high usage warnings
  if (dbRequestCount > 20) {
    const rate = (dbRequestCount / (elapsed / 1000 / 60)).toFixed(1); // requests per minute
    console.warn(`⚠️  HIGH DB USAGE: ${dbRequestCount} requests (${rate}/min) in ${Math.round(elapsed/1000)}s`);
  }
  
  // Reset counter every hour
  if (elapsed > 60 * 60 * 1000) {
    dbRequestCount = 0;
    lastResetTime = Date.now();
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Clean cache periodically
  // No caching - direct database access

  // Simple toilet routes - NO CACHING
  app.get("/api/toilets", async (req: Request, res: Response) => {
    try {
      const { lat, lng, radius } = req.query;
      
      if (lat && lng) {
        // Handle spatial query - NO CACHING
        const centerLat = parseFloat(lat as string);
        const centerLng = parseFloat(lng as string);
        const radiusKm = radius ? parseFloat(radius as string) : 10;
        
        try {
          logDatabaseRequest('/api/toilets', `spatial`);
          const toilets = await storage.getToiletsNearby(centerLat, centerLng, Math.max(radiusKm, 15));
          
          // Filter to exact requested radius
          const filteredToilets = toilets.filter(toilet => {
            const distance = calculateDistance(
              centerLat, centerLng,
              toilet.coordinates.lat, toilet.coordinates.lng
            );
            return distance <= radiusKm;
          });
          res.json(filteredToilets);
          
        } catch (dbError) {
          console.error("Database error:", dbError);
          throw dbError;
        }
        
      } else {
        // All toilets endpoint - NO CACHING
        logDatabaseRequest('/api/toilets', 'ALL');
        const toilets = await storage.getToilets();
        
        // Silent for performance
        
        res.json(toilets);
      }
      
    } catch (error) {
      const err = error as any;
      
      if (err && err.code === 8 && err.message && err.message.includes('exceeded')) {
        // Firestore quota exceeded
        console.error("Firestore quota exceeded");
        
        res.status(503).json({ 
          error: 'Service temporarily unavailable due to high demand. Please try again in a few minutes.'
        });
        return;
      }
      
      console.error("Error fetching toilets:", error);
      res.status(500).json({ error: "Failed to fetch toilets" });
    }
  });

  // Simple area-based endpoint - NO CACHING
  app.get("/api/toilets-in-area", async (req: Request, res: Response) => {
    try {
      const { minLat, maxLat, minLng, maxLng } = req.query;
      
      if (!minLat || !maxLat || !minLng || !maxLng) {
        return res.status(400).json({ error: "Missing required parameters: minLat, maxLat, minLng, maxLng" });
      }
      
      const bounds = {
        minLat: parseFloat(minLat as string),
        maxLat: parseFloat(maxLat as string),
        minLng: parseFloat(minLng as string),
        maxLng: parseFloat(maxLng as string)
      };
      
      // Calculate center and radius for database query
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      const radiusKm = Math.max(
        calculateDistance(bounds.minLat, bounds.minLng, bounds.maxLat, bounds.maxLng) / 2,
        5 // Minimum 5km radius
      );
      
      try {
        logDatabaseRequest('/api/toilets-in-area', 'bounds');
        const toilets = await storage.getToiletsNearby(centerLat, centerLng, Math.min(radiusKm * 1.5, 50));
        
        // Filter to exact area bounds
        const filteredToilets = toilets.filter(toilet => 
          toilet.coordinates.lat >= bounds.minLat &&
          toilet.coordinates.lat <= bounds.maxLat &&
          toilet.coordinates.lng >= bounds.minLng &&
          toilet.coordinates.lng <= bounds.maxLng &&
          !toilet.isRemoved
        );
        res.json(filteredToilets);
        
      } catch (dbError) {
        console.error("Database error in area query:", dbError);
        throw dbError;
      }
      
    } catch (error) {
      console.error("Error fetching toilets in area:", error);
      const err = error as any;
      
      if (err && err.code === 8 && err.message && err.message.includes('exceeded')) {
        res.status(503).json({ 
          error: 'Service temporarily unavailable due to high demand. Please try again in a few minutes.'
        });
        return;
      }
      
      res.status(500).json({ error: "Failed to fetch toilets in area" });
    }
  });

  // Chunk-based toilet endpoint for optimized caching
  app.get("/api/toilets/chunk/:chunkKey", async (req: Request, res: Response) => {
    try {
      const { chunkKey } = req.params;
      
      // Parse chunk boundaries from key (format: "chunk-42.65-23.30")
      const keyParts = chunkKey.split('-');
      if (keyParts.length !== 3 || keyParts[0] !== 'chunk') {
        return res.status(400).json({ error: "Invalid chunk key format" });
      }
      
      const chunkLat = parseFloat(keyParts[1]);
      const chunkLng = parseFloat(keyParts[2]);
      const CHUNK_SIZE = 0.05; // Must match client-side value
      
      if (isNaN(chunkLat) || isNaN(chunkLng)) {
        return res.status(400).json({ error: "Invalid chunk coordinates" });
      }
      
      const bounds = {
        minLat: chunkLat,
        maxLat: chunkLat + CHUNK_SIZE,
        minLng: chunkLng,
        maxLng: chunkLng + CHUNK_SIZE
      };
      
      // Calculate center and radius for database query
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      const radiusKm = Math.max(
        calculateDistance(bounds.minLat, bounds.minLng, bounds.maxLat, bounds.maxLng) / 2,
        3 // Minimum 3km radius for chunks
      );
      
      try {
        logDatabaseRequest(`/api/toilets/chunk/${chunkKey}`, 'chunk');
        const toilets = await storage.getToiletsNearby(centerLat, centerLng, radiusKm * 1.2); // Add 20% buffer
        
        // Filter to exact chunk bounds
        const chunkToilets = toilets.filter(toilet => 
          toilet.coordinates.lat >= bounds.minLat &&
          toilet.coordinates.lat < bounds.maxLat &&
          toilet.coordinates.lng >= bounds.minLng &&
          toilet.coordinates.lng < bounds.maxLng &&
          !toilet.isRemoved
        );
        
        // Set cache headers for 30 minutes
        res.set('Cache-Control', 'public, max-age=1800'); // 30 minutes
        res.json(chunkToilets);
        
      } catch (dbError) {
        console.error(`Database error in chunk query ${chunkKey}:`, dbError);
        throw dbError;
      }
      
    } catch (error) {
      console.error(`Error fetching toilets for chunk ${req.params.chunkKey}:`, error);
      const err = error as any;
      
      if (err && err.code === 8 && err.message && err.message.includes('exceeded')) {
        res.status(503).json({ 
          error: 'Service temporarily unavailable due to high demand. Please try again in a few minutes.'
        });
        return;
      }
      
      res.status(500).json({ error: "Failed to fetch toilets for chunk" });
    }
  });

  app.post("/api/toilets", async (req: Request, res: Response) => {
    try {
      const toilet = insertToiletSchema.parse(req.body);
      
      // Set default title if title is null, undefined, or empty
      if (!toilet.title || toilet.title.trim() === '') {
        toilet.title = getDefaultTitle(toilet.type);
      }
      
      const id = await storage.createToilet(toilet);
      const response = { id, ...toilet };
      res.json(response);
    } catch (error) {
      console.error("❌ Error in POST /api/toilets:", error);
      
      if (error instanceof z.ZodError) {
        console.error("❌ Zod validation error:", error.errors);
        res.status(400).json({ error: "Invalid toilet data", details: error.errors });
      } else {
        console.error("❌ Unexpected error:", error);
        res.status(500).json({ error: "Failed to create toilet", message: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  app.get("/api/toilets/:id/reviews", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reviews = await storage.getReviewsForToilet(id);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/toilets/:id/reviews", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      // Silent for performance
      
      const review = insertReviewSchema.parse({ ...req.body, toiletId: id });
      // Silent for performance
      
      await storage.createReview(review);
      // Silent for performance
      
      const response = { message: "Review created successfully" };
      // Silent for performance
      res.json(response);
    } catch (error) {
      console.error("❌ Error in POST /api/toilets/:id/reviews:", error);
      
      if (error instanceof z.ZodError) {
        console.error("❌ Zod validation error:", error.errors);
        res.status(400).json({ error: "Invalid review data", details: error.errors });
      } else {
        console.error("❌ Unexpected error:", error);
        res.status(500).json({ error: "Failed to create review", message: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  app.get("/api/toilets/:id/user-review", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      
      if (!userId) {
        return res.json({ hasReviewed: false });
      }
      
      const hasReviewed = await storage.hasUserReviewedToilet(id, userId as string);
      res.json({ hasReviewed });
    } catch (error) {
      console.error("Error checking review status:", error);
      res.status(500).json({ error: "Failed to check review status" });
    }
  });

  app.post("/api/reports", async (req: Request, res: Response) => {
    try {
      const report = insertReportSchema.parse(req.body);
      await storage.createReport(report);
      res.json({ message: "Report submitted successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid report data", details: error.errors });
      } else {
        console.error("Error creating report:", error);
        res.status(500).json({ error: "Failed to submit report" });
      }
    }
  });

  app.post("/api/toilets/:id/report-not-exists", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      // Silent for performance
      
      const toiletReport = insertToiletReportSchema.parse({ ...req.body, toiletId: id });
      // Silent for performance
      
      await storage.reportToiletNotExists(toiletReport);
      
      // Check if toilet should be removed
      const reportCount = await storage.getToiletReportCount(id);
      // Silent for performance
      
      if (reportCount >= 5) {
        // Silent for performance
        await storage.removeToiletFromReports(id);
      }
      
      res.json({ message: "Toilet reported successfully", reportCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Validation error:', error.errors);
        res.status(400).json({ error: "Invalid report data", details: error.errors });
      } else {
        console.error("Error reporting toilet:", error);
        res.status(500).json({ error: "Failed to report toilet" });
      }
    }
  });

  app.put("/api/toilets/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log(`📝 PUT /api/toilets/${id} called with data:`, updateData);
      
      // Basic validation
      if (!updateData.type) {
        return res.status(400).json({ error: "Missing toilet type" });
      }
      
      if (updateData.title === undefined) {
        return res.status(400).json({ error: "Missing toilet title" });
      }
      
      // Check if toilet exists
      const toilets = await storage.getToilets();
      const toilet = toilets.find(t => t.id === id);
      
      if (!toilet) {
        return res.status(404).json({ error: "Toilet not found" });
      }
      
      console.log(`📝 Updating toilet ${id}...`);
      await storage.updateToilet(id, updateData);
      
      console.log(`✅ Toilet ${id} updated successfully`);
      res.json({ message: "Toilet updated successfully", id });
    } catch (error) {
      console.error("❌ Error updating toilet:", error);
      res.status(500).json({ error: "Failed to update toilet", details: error.message });
    }
  });

  app.delete("/api/toilets/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { adminEmail, userId } = req.body;
      
      if (!userId) {
        return res.status(403).json({ error: "User authentication required" });
      }
      
      // Get the toilet to check ownership
      const toilets = await storage.getToilets();
      const toilet = toilets.find(t => t.id === id);
      
      if (!toilet) {
        return res.status(404).json({ error: "Toilet not found" });
      }
      
      // Verify Firebase token
      let userRecord;
      try {
        userRecord = await auth.getUser(userId);
      } catch (firebaseError: any) {
        console.error("❌ Firebase verification error:", firebaseError);
        return res.status(403).json({ error: "Invalid user credentials" });
      }
      
      // Check if user is admin OR the creator of the toilet
      const isAdmin = userRecord.customClaims?.admin === true;
      const isCreator = toilet.userId === userId;
      
      if (!isAdmin && !isCreator) {
        return res.status(403).json({ error: "You can only delete toilets you have created" });
      }
      
      // If user claims to be admin, verify email matches
      if (adminEmail && userRecord.email !== adminEmail) {
        return res.status(403).json({ error: "Email mismatch" });
      }
      
      await storage.deleteToilet(id);
      
      res.json({ message: "Toilet deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting toilet:", error);
      res.status(500).json({ error: "Failed to delete toilet" });
    }
  });

  // Health check endpoint with DB monitoring
  app.get("/api/health", (req: Request, res: Response) => {
    const elapsed = Date.now() - lastResetTime;
    const ratePerMinute = dbRequestCount / (elapsed / 1000 / 60);
    
    res.json({ 
      status: "healthy", 
      database: {
        totalRequests: dbRequestCount,
        ratePerMinute: Math.round(ratePerMinute * 10) / 10,
        elapsedMinutes: Math.round(elapsed / 1000 / 60),
        status: dbRequestCount > 50 ? 'HIGH_USAGE' : dbRequestCount > 20 ? 'MODERATE' : 'LOW'
      }
    });
  });

  // No cache statistics - caching removed

  const httpServer = createServer(app);
  return httpServer;
}
