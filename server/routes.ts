import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertToiletSchema, updateToiletSchema, insertReviewSchema, insertReportSchema, insertToiletReportSchema } from "@shared/schema";
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

// In-memory cache for the full toilet list. This is the real protection against
// excessive DB load: Express's built-in weak ETag returns 304s, but only AFTER the
// route has run the full Supabase query + transform — so the 304 saves bandwidth,
// not database reads. Caching here caps reads to ~1 per TTL regardless of how many
// clients ask. Invalidated on every toilet-mutating route via clearToiletsCache().
// NOTE: per-process — with N Railway replicas you get up to N reads per TTL.
type ToiletList = Awaited<ReturnType<typeof storage.getToilets>>;
let toiletListCache: { data: ToiletList; ts: number } | null = null;
const TOILET_CACHE_TTL_MS = 60 * 1000;

async function getCachedToilets(): Promise<ToiletList> {
  if (toiletListCache && Date.now() - toiletListCache.ts < TOILET_CACHE_TTL_MS) {
    return toiletListCache.data;
  }
  const data = await storage.getToilets();
  toiletListCache = { data, ts: Date.now() };
  return data;
}

function clearToiletsCache() {
  toiletListCache = null;
}

// Verify a Firebase ID token from the Authorization: Bearer <token> header.
// Returns the authenticated user, or null after sending an error response.
async function requireAuth(
  req: Request,
  res: Response
): Promise<{ uid: string; admin: boolean; email?: string; name: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(authHeader.split("Bearer ")[1]);
    // Display name is derived from the verified token only — never from the
    // request body — so a user can't spoof another name (e.g. an admin homoglyph).
    const name =
      (decoded.name as string | undefined)?.trim() ||
      decoded.email?.split("@")[0] ||
      "Потребител";
    return { uid: decoded.uid, admin: decoded.admin === true, email: decoded.email, name };
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
    return null;
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

        if (
          isNaN(centerLat) || isNaN(centerLng) ||
          centerLat < -90 || centerLat > 90 ||
          centerLng < -180 || centerLng > 180
        ) {
          return res.status(400).json({ error: "Invalid coordinates" });
        }

        const radiusKm = radius ? Math.min(parseFloat(radius as string), 100) : 10;

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
        // All toilets endpoint - served from the 60s in-memory cache
        logDatabaseRequest('/api/toilets', 'ALL');
        const toilets = await getCachedToilets();

        // Let the browser/SW reuse the response briefly and revalidate in the
        // background, so panning the map doesn't re-hit the server every time.
        res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
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
      // Require a valid Firebase token and trust the token for identity
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      const toilet = insertToiletSchema.parse({ ...req.body, userId: authUser.uid });

      // Leave the title empty when the user didn't supply one. The client
      // renders a localized fallback from the type (getProperTitle in
      // Map.tsx) based on the active language — so we must NOT bake an
      // English string into the DB here, or it would show in English
      // regardless of the user's chosen language.
      if (!toilet.title || toilet.title.trim() === '') {
        toilet.title = null;
      }
      
      const id = await storage.createToilet(toilet);
      clearToiletsCache();
      const response = { id, ...toilet };
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid toilet data" });
      } else {
        console.error("Error creating toilet:", error);
        res.status(500).json({ error: "Failed to create toilet" });
      }
    }
  });

  app.get("/api/toilets/:id/reviews", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reviews = await storage.getReviewsForToilet(id);
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/toilets/:id/reviews", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      // userName comes from the verified token, never the body (anti-spoofing).
      const review = insertReviewSchema.parse({
        ...req.body,
        toiletId: id,
        userId: authUser.uid,
        userName: authUser.name,
      });

      // One review per user per toilet (DB UNIQUE constraint backs this).
      if (await storage.hasUserReviewedToilet(id, authUser.uid)) {
        return res.status(409).json({ error: "You have already reviewed this toilet" });
      }

      await storage.createReview(review);
      res.json({ message: "Review created successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid review data" });
      } else {
        console.error("Error in POST /api/toilets/:id/reviews:", error);
        res.status(500).json({ error: "Failed to create review" });
      }
    }
  });

  app.get("/api/toilets/:id/user-review", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Identity comes from the verified token, not a client-supplied userId —
      // otherwise anyone could probe whether a given user reviewed a toilet.
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      const hasReviewed = await storage.hasUserReviewedToilet(id, authUser.uid);
      res.json({ hasReviewed });
    } catch (error) {
      console.error("Error checking review status:", error);
      res.status(500).json({ error: "Failed to check review status" });
    }
  });

  app.post("/api/reports", async (req: Request, res: Response) => {
    try {
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      // userName from the verified token, never the body.
      const report = insertReportSchema.parse({ ...req.body, userId: authUser.uid, userName: authUser.name });

      // "doesnt-exist" feeds the auto-removal counter — enforce one per user so a
      // single actor can't drive the threshold and censor a legitimate toilet.
      if (report.reason === 'doesnt-exist') {
        if (await storage.hasUserReportedToilet(report.toiletId, authUser.uid)) {
          return res.status(409).json({ error: "You have already reported this toilet" });
        }

        await storage.createReport(report);
        await storage.reportToiletNotExists({ toiletId: report.toiletId, userId: report.userId });

        // Count of DISTINCT reporters (one row per user, enforced by UNIQUE constraint).
        const reportCount = await storage.getToiletReportCount(report.toiletId);
        if (reportCount >= 5) {
          await storage.removeToiletFromReports(report.toiletId);
          clearToiletsCache(); // toilet was soft-removed — drop the stale list
        }

        res.json({ message: "Report submitted successfully", reportCount });
      } else {
        await storage.createReport(report);
        res.json({ message: "Report submitted successfully" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid report data" });
      } else {
        console.error("Error creating report:", error);
        res.status(500).json({ error: "Failed to submit report" });
      }
    }
  });

  app.post("/api/toilets/:id/report-not-exists", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      const toiletReport = insertToiletReportSchema.parse({ ...req.body, toiletId: id, userId: authUser.uid });

      // One report per user per toilet (DB UNIQUE backs this) — prevents a single
      // actor from reaching the auto-removal threshold on their own.
      if (await storage.hasUserReportedToilet(id, authUser.uid)) {
        return res.status(409).json({ error: "You have already reported this toilet" });
      }

      await storage.reportToiletNotExists(toiletReport);

      // DISTINCT reporters (one row per user).
      const reportCount = await storage.getToiletReportCount(id);
      if (reportCount >= 5) {
        await storage.removeToiletFromReports(id);
        clearToiletsCache(); // toilet was soft-removed — drop the stale list
      }

      res.json({ message: "Toilet reported successfully", reportCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid report data" });
      } else {
        console.error("Error reporting toilet:", error);
        res.status(500).json({ error: "Failed to report toilet" });
      }
    }
  });

  app.put("/api/toilets/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verify Firebase Bearer token
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      // Validate + bound the payload (coords checked against Bulgaria bbox here).
      const updateData = updateToiletSchema.parse(req.body);

      const toilets = await getCachedToilets();
      const toilet = toilets.find(t => t.id === id);
      if (!toilet) {
        return res.status(404).json({ error: "Toilet not found" });
      }

      const isAdmin = authUser.admin === true;
      const isCreator = toilet.userId === authUser.uid;
      if (!isAdmin && !isCreator) {
        return res.status(403).json({ error: "You can only edit toilets you have created" });
      }

      // Only admins may relocate a toilet (e.g. fix an OSM import); a regular
      // creator can edit details but not move the pin.
      if (!isAdmin) delete (updateData as { coordinates?: unknown }).coordinates;

      await storage.updateToilet(id, updateData);
      clearToiletsCache();
      res.json({ message: "Toilet updated successfully", id });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid toilet data" });
      }
      console.error("Error updating toilet:", error);
      res.status(500).json({ error: "Failed to update toilet" });
    }
  });

  app.delete("/api/toilets/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Identity comes from the verified token, never the request body
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      // Get the toilet to check ownership
      const toilets = await getCachedToilets();
      const toilet = toilets.find(t => t.id === id);

      if (!toilet) {
        return res.status(404).json({ error: "Toilet not found" });
      }

      // Check if user is admin OR the creator of the toilet
      const isCreator = toilet.userId === authUser.uid;
      if (!authUser.admin && !isCreator) {
        return res.status(403).json({ error: "You can only delete toilets you have created" });
      }

      await storage.deleteToilet(id);
      clearToiletsCache();

      res.json({ message: "Toilet deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting toilet:", error);
      res.status(500).json({ error: "Failed to delete toilet" });
    }
  });

  // ─── Privacy / GDPR ────────────────────────────────────────────────────────
  const consentSchema = z.object({
    version: z.number().int().min(1).max(10000),
    acceptedTerms: z.boolean(),
    acceptedPrivacy: z.boolean(),
  });

  // Record the signed-in user's terms/privacy consent (insert-once per version).
  app.post("/api/consent", async (req: Request, res: Response) => {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    try {
      const { version, acceptedTerms, acceptedPrivacy } = consentSchema.parse(req.body);
      await storage.recordConsent(authUser.uid, version, acceptedTerms, acceptedPrivacy);
      res.json({ message: "Consent recorded" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid consent data" });
      }
      console.error("Error recording consent:", error);
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  // GDPR account deletion: erase the user's personal data, anonymize the toilets
  // they added, then delete their Firebase Auth account. Identity from the token.
  app.delete("/api/account", async (req: Request, res: Response) => {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    try {
      await storage.deleteUserData(authUser.uid);
      await auth.deleteUser(authUser.uid);
      clearToiletsCache();
      res.json({ message: "Account deleted" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "healthy" });
  });

  // No cache statistics - caching removed

  const httpServer = createServer(app);
  return httpServer;
}
