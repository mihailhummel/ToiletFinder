import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertToiletSchema, insertReviewSchema, insertReportSchema, insertToiletReportSchema } from "@shared/schema";
import { z } from "zod";
import { auth } from "../firebase-admin-config.js";

// Enhanced in-memory cache with spatial chunking
interface CachedToiletChunk {
  data: any[];
  timestamp: number;
  center: { lat: number; lng: number };
  radius: number;
}

const toiletsCache: Map<string, CachedToiletChunk> = new Map();
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes for server cache
const MAX_CACHE_ENTRIES = 50; // Limit cache size

// Generate cache key for spatial queries
function getCacheKey(lat: number, lng: number, radius: number): string {
  const roundedLat = Math.round(lat * 100) / 100; // Round to ~1km precision
  const roundedLng = Math.round(lng * 100) / 100;
  const roundedRadius = Math.round(radius);
  return `${roundedLat},${roundedLng},${roundedRadius}`;
}

// Clean expired cache entries
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, chunk] of toiletsCache.entries()) {
    if (now - chunk.timestamp > CACHE_DURATION_MS) {
      toiletsCache.delete(key);
    }
  }
  
  // If cache is still too large, remove oldest entries
  if (toiletsCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(toiletsCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, toiletsCache.size - MAX_CACHE_ENTRIES);
    toRemove.forEach(([key]) => toiletsCache.delete(key));
  }
}

// Check if a point is within a cached chunk
function isPointInCachedChunk(lat: number, lng: number, chunk: CachedToiletChunk): boolean {
  const distance = calculateDistance(lat, lng, chunk.center.lat, chunk.center.lng);
  return distance <= chunk.radius;
}

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

function logDatabaseRequest(endpoint: string, details: string = '') {
  dbRequestCount++;
  const elapsed = Date.now() - lastResetTime;
  const rate = (dbRequestCount / (elapsed / 1000 / 60)).toFixed(1); // requests per minute
  
  console.log(`🔥 DB REQUEST #${dbRequestCount} (${rate}/min): ${endpoint} ${details}`);
  
  if (dbRequestCount > 10) {
    console.warn(`⚠️  HIGH DB USAGE: ${dbRequestCount} requests in ${Math.round(elapsed/1000)}s`);
  }
  
  // Reset counter every hour
  if (elapsed > 60 * 60 * 1000) {
    console.log(`📊 Hourly DB stats: ${dbRequestCount} requests, resetting counter`);
    dbRequestCount = 0;
    lastResetTime = Date.now();
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Clean cache periodically
  setInterval(cleanExpiredCache, 5 * 60 * 1000); // Every 5 minutes

  // Optimized toilet routes with spatial caching
  app.get("/api/toilets", async (req: Request, res: Response) => {
    try {
      const { lat, lng, radius } = req.query;
      
      if (lat && lng) {
        // Handle spatial query with caching
        const centerLat = parseFloat(lat as string);
        const centerLng = parseFloat(lng as string);
        const radiusKm = radius ? parseFloat(radius as string) : 10;
        
        // Check if we have a cached chunk that covers this area
        const cacheKey = getCacheKey(centerLat, centerLng, radiusKm);
        const now = Date.now();
        
        for (const [key, chunk] of toiletsCache.entries()) {
          if (now - chunk.timestamp < CACHE_DURATION_MS &&
              isPointInCachedChunk(centerLat, centerLng, chunk) &&
              chunk.radius >= radiusKm) {
            
            // Filter cached data to the requested area
            const filteredToilets = chunk.data.filter(toilet => {
              const distance = calculateDistance(
                centerLat, centerLng,
                toilet.coordinates.lat, toilet.coordinates.lng
              );
              return distance <= radiusKm;
            });
            
            console.log(`Serving ${filteredToilets.length} toilets from cache for ${cacheKey}`);
            return res.json(filteredToilets);
          }
        }
        
        // Cache miss - fetch from database
        console.log(`Cache miss for ${cacheKey}, fetching from database`);
        
        try {
          logDatabaseRequest('/api/toilets', `spatial(${centerLat.toFixed(3)}, ${centerLng.toFixed(3)}, ${radiusKm}km)`);
          const toilets = await storage.getToiletsNearby(centerLat, centerLng, Math.max(radiusKm, 15));
          
          // Cache the result with a slightly larger radius for future queries
          const cacheRadius = Math.max(radiusKm * 1.2, 20); // 20% larger or minimum 20km
          toiletsCache.set(cacheKey, {
            data: toilets,
            timestamp: now,
            center: { lat: centerLat, lng: centerLng },
            radius: cacheRadius
          });
          
          // Filter to exact requested radius
          const filteredToilets = toilets.filter(toilet => {
            const distance = calculateDistance(
              centerLat, centerLng,
              toilet.coordinates.lat, toilet.coordinates.lng
            );
            return distance <= radiusKm;
          });
          
          console.log(`Fetched ${toilets.length} toilets, serving ${filteredToilets.length} in ${radiusKm}km radius`);
          res.json(filteredToilets);
          
        } catch (dbError) {
          console.error("Database error:", dbError);
          
          // Try to serve from any available cache as fallback
          for (const chunk of toiletsCache.values()) {
            if (isPointInCachedChunk(centerLat, centerLng, chunk)) {
              console.log("Serving stale cache data due to database error");
              const filteredToilets = chunk.data.filter(toilet => {
                const distance = calculateDistance(
                  centerLat, centerLng,
                  toilet.coordinates.lat, toilet.coordinates.lng
                );
                return distance <= radiusKm;
              });
              return res.json(filteredToilets);
            }
          }
          
          throw dbError; // Re-throw if no cache available
        }
        
      } else {
        // Legacy all-toilets endpoint - heavily cached and discouraged
        console.warn("Legacy all-toilets endpoint called - this should be avoided");
        
        const globalCacheKey = "all-toilets";
        const cached = toiletsCache.get(globalCacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
          console.log("Serving all toilets from cache");
          return res.json(cached.data);
        }
        
        // Fetch all toilets (expensive operation)
        logDatabaseRequest('/api/toilets', 'ALL TOILETS - EXPENSIVE!');
        const toilets = await storage.getToilets();
        toiletsCache.set(globalCacheKey, {
          data: toilets,
          timestamp: Date.now(),
          center: { lat: 42.6977, lng: 23.3219 }, // Sofia center
          radius: 1000 // Large radius for all Bulgaria
        });
        
        console.log(`Fetched all ${toilets.length} toilets from database`);
        res.json(toilets);
      }
      
    } catch (error) {
      const err = error as any;
      
      if (err && err.code === 8 && err.message && err.message.includes('exceeded')) {
        // Firestore quota exceeded
        console.error("Firestore quota exceeded, serving from cache if available");
        
        // Try to serve from any available cache
        if (toiletsCache.size > 0) {
          const oldestValidCache = Array.from(toiletsCache.values())
            .sort((a, b) => b.timestamp - a.timestamp)[0];
          
          if (oldestValidCache) {
            console.log("Serving stale cache data due to quota exceeded");
            return res.json(oldestValidCache.data);
          }
        }
        
        res.status(503).json({ 
          error: 'Service temporarily unavailable due to high demand. Please try again in a few minutes.',
          cached: false
        });
        return;
      }
      
      console.error("Error fetching toilets:", error);
      res.status(500).json({ error: "Failed to fetch toilets" });
    }
  });

  // New viewport-based endpoint with area bounds
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
      
      // Generate cache key for this area
      const areaKey = `${bounds.minLat.toFixed(3)},${bounds.maxLat.toFixed(3)},${bounds.minLng.toFixed(3)},${bounds.maxLng.toFixed(3)}`;
      const now = Date.now();
      
      // Check area cache first
      for (const [key, chunk] of toiletsCache.entries()) {
        if (now - chunk.timestamp < CACHE_DURATION_MS) {
          // Check if cached chunk covers the requested area
          const chunkBounds = {
            minLat: chunk.center.lat - chunk.radius / 111, // Rough conversion km to degrees
            maxLat: chunk.center.lat + chunk.radius / 111,
            minLng: chunk.center.lng - chunk.radius / (111 * Math.cos(chunk.center.lat * Math.PI / 180)),
            maxLng: chunk.center.lng + chunk.radius / (111 * Math.cos(chunk.center.lat * Math.PI / 180))
          };
          
          if (chunkBounds.minLat <= bounds.minLat && 
              chunkBounds.maxLat >= bounds.maxLat &&
              chunkBounds.minLng <= bounds.minLng && 
              chunkBounds.maxLng >= bounds.maxLng) {
            
            // Filter to exact area bounds
            const filteredToilets = chunk.data.filter(toilet => 
              toilet.coordinates.lat >= bounds.minLat &&
              toilet.coordinates.lat <= bounds.maxLat &&
              toilet.coordinates.lng >= bounds.minLng &&
              toilet.coordinates.lng <= bounds.maxLng &&
              !toilet.isRemoved
            );
            
            console.log(`Serving ${filteredToilets.length} toilets from area cache`);
            return res.json(filteredToilets);
          }
        }
      }
      
      // Cache miss - calculate center and radius for database query
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      const radiusKm = Math.max(
        calculateDistance(bounds.minLat, bounds.minLng, bounds.maxLat, bounds.maxLng) / 2,
        5 // Minimum 5km radius
      );
      
      console.log(`Fetching toilets for area: center(${centerLat.toFixed(3)}, ${centerLng.toFixed(3)}), radius: ${radiusKm.toFixed(1)}km`);
      
      try {
        logDatabaseRequest('/api/toilets-in-area', `bounds(${centerLat.toFixed(3)}, ${centerLng.toFixed(3)}, ${radiusKm.toFixed(1)}km)`);
        const toilets = await storage.getToiletsNearby(centerLat, centerLng, Math.min(radiusKm * 1.5, 50));
        
        // Cache with expanded radius for future queries
        const cacheKey = getCacheKey(centerLat, centerLng, radiusKm * 1.5);
        toiletsCache.set(cacheKey, {
          data: toilets,
          timestamp: now,
          center: { lat: centerLat, lng: centerLng },
          radius: radiusKm * 1.5
        });
        
        // Filter to exact area bounds
        const filteredToilets = toilets.filter(toilet => 
          toilet.coordinates.lat >= bounds.minLat &&
          toilet.coordinates.lat <= bounds.maxLat &&
          toilet.coordinates.lng >= bounds.minLng &&
          toilet.coordinates.lng <= bounds.maxLng &&
          !toilet.isRemoved
        );
        
        console.log(`Fetched ${toilets.length} toilets, serving ${filteredToilets.length} in area`);
        res.json(filteredToilets);
        
      } catch (dbError) {
        console.error("Database error in area query:", dbError);
        
        // Fallback to any overlapping cache
        for (const chunk of toiletsCache.values()) {
          const filteredToilets = chunk.data.filter(toilet => 
            toilet.coordinates.lat >= bounds.minLat &&
            toilet.coordinates.lat <= bounds.maxLat &&
            toilet.coordinates.lng >= bounds.minLng &&
            toilet.coordinates.lng <= bounds.maxLng &&
            !toilet.isRemoved
          );
          
          if (filteredToilets.length > 0) {
            console.log("Serving stale cache data for area due to database error");
            return res.json(filteredToilets);
          }
        }
        
        throw dbError;
      }
      
    } catch (error) {
      console.error("Error fetching toilets in area:", error);
      const err = error as any;
      
      if (err && err.code === 8 && err.message && err.message.includes('exceeded')) {
        res.status(503).json({ 
          error: 'Service temporarily unavailable due to high demand. Please try again in a few minutes.',
          cached: false
        });
        return;
      }
      
      res.status(500).json({ error: "Failed to fetch toilets in area" });
    }
  });

  app.post("/api/toilets", async (req: Request, res: Response) => {
    try {
      console.log("🚽 POST /api/toilets - Request body:", JSON.stringify(req.body, null, 2));
      
      const toilet = insertToiletSchema.parse(req.body);
      console.log("✅ Schema validation passed:", toilet);
      
      const id = await storage.createToilet(toilet);
      console.log("✅ Toilet created with ID:", id);
      
      // Invalidate relevant cache entries
      const toiletLat = toilet.coordinates.lat;
      const toiletLng = toilet.coordinates.lng;
      
      for (const [key, chunk] of toiletsCache.entries()) {
        if (isPointInCachedChunk(toiletLat, toiletLng, chunk)) {
          toiletsCache.delete(key);
          console.log(`Invalidated cache entry ${key} due to new toilet`);
        }
      }
      
      const response = { id, ...toilet };
      console.log("📤 Sending response:", response);
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
      console.log("📝 POST /api/toilets/:id/reviews - Toilet ID:", id);
      console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
      
      const review = insertReviewSchema.parse({ ...req.body, toiletId: id });
      console.log("✅ Review schema validation passed:", review);
      
      await storage.createReview(review);
      console.log("✅ Review created successfully");
      
      // Invalidate cache entries that might contain this toilet's rating
      const cacheKeysToInvalidate: string[] = [];
      for (const [key, chunk] of toiletsCache.entries()) {
        if (chunk.data.some(toilet => toilet.id === id)) {
          cacheKeysToInvalidate.push(key);
        }
      }
      
      cacheKeysToInvalidate.forEach(key => {
        toiletsCache.delete(key);
        console.log(`Invalidated cache entry ${key} due to new review`);
      });
      
      const response = { message: "Review created successfully" };
      console.log("📤 Sending review response:", response);
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
      const toiletReport = insertToiletReportSchema.parse({ ...req.body, toiletId: id });
      
      await storage.reportToiletNotExists(toiletReport);
      
      // Check if toilet should be removed
      const reportCount = await storage.getToiletReportCount(id);
      if (reportCount >= 10) {
        await storage.removeToiletFromReports(id);
        
        // Invalidate all cache entries since a toilet was removed
        toiletsCache.clear();
        console.log("Cleared all cache due to toilet removal");
      }
      
      res.json({ message: "Toilet reported successfully", reportCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid report data", details: error.errors });
      } else {
        console.error("Error reporting toilet:", error);
        res.status(500).json({ error: "Failed to report toilet" });
      }
    }
  });

  app.delete("/api/toilets/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { adminEmail, userId } = req.body;
      
      console.log("🗑️ Delete toilet request:", { id, adminEmail, userId });
      
      // Check if user is admin by verifying with Firebase
      if (!adminEmail || !userId) {
        console.log("❌ Missing adminEmail or userId");
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // Verify Firebase token and check custom claims
      try {
        console.log("🔍 Verifying Firebase user:", userId);
        console.log("🔍 Firebase auth object:", typeof auth, auth ? "exists" : "null");
        
        // Get the user from Firebase Admin SDK
        const userRecord = await auth.getUser(userId);
        console.log("✅ Firebase user found:", { 
          email: userRecord.email, 
          customClaims: userRecord.customClaims,
          uid: userRecord.uid
        });
        
        // Check if user has admin custom claim
        if (!userRecord.customClaims?.admin) {
          console.log("❌ User does not have admin custom claim");
          console.log("❌ Custom claims:", userRecord.customClaims);
          return res.status(403).json({ error: "Admin access required" });
        }
        
        // Verify the email matches the user record
        if (userRecord.email !== adminEmail) {
          console.log("❌ Email mismatch:", { 
            provided: adminEmail, 
            actual: userRecord.email 
          });
          return res.status(403).json({ error: "Email mismatch" });
        }
        
        console.log("✅ Admin verification successful");
        
      } catch (firebaseError) {
        console.error("❌ Firebase verification error:", firebaseError);
        console.error("❌ Error details:", {
          code: firebaseError.code,
          message: firebaseError.message,
          stack: firebaseError.stack
        });
        return res.status(403).json({ error: "Invalid user credentials" });
      }
      
      console.log("🗑️ Deleting toilet from database:", id);
      await storage.deleteToilet(id);
      
      // Invalidate all cache entries since a toilet was deleted
      toiletsCache.clear();
      console.log("✅ Cleared all cache due to toilet deletion");
      
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
      cache: {
        entries: toiletsCache.size,
        oldestEntry: toiletsCache.size > 0 ? 
          Math.min(...Array.from(toiletsCache.values()).map(c => c.timestamp)) : null
      },
      database: {
        totalRequests: dbRequestCount,
        ratePerMinute: Math.round(ratePerMinute * 10) / 10,
        elapsedMinutes: Math.round(elapsed / 1000 / 60),
        status: dbRequestCount > 50 ? 'HIGH_USAGE' : dbRequestCount > 20 ? 'MODERATE' : 'LOW'
      }
    });
  });

  // Cache statistics endpoint (for debugging)
  app.get("/api/cache-stats", (req: Request, res: Response) => {
    const now = Date.now();
    const cacheEntries = Array.from(toiletsCache.entries()).map(([key, chunk]) => ({
      key,
      center: chunk.center,
      radius: chunk.radius,
      toiletCount: chunk.data.length,
      ageMinutes: Math.round((now - chunk.timestamp) / 60000),
      valid: (now - chunk.timestamp) < CACHE_DURATION_MS
    }));
    
    res.json({
      totalEntries: toiletsCache.size,
      maxEntries: MAX_CACHE_ENTRIES,
      cacheDurationMinutes: CACHE_DURATION_MS / 60000,
      entries: cacheEntries
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
