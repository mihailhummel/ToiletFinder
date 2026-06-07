import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Behind Railway's proxy: trust the first hop so express-rate-limit keys on the
// real client IP (X-Forwarded-For) instead of the proxy address. Must be set
// before the rate limiters are registered.
app.set("trust proxy", 1);

// Security headers via helmet, including a real Content-Security-Policy.
// (The Netlify-style client/public/_headers file is NOT honored by Express, so
// the CSP must live here.) COEP/COOP are relaxed for the Google sign-in popup
// and cross-origin map tiles.
//
// NOTE: script-src still allows 'unsafe-inline' because index.html currently has
// inline scripts (GA bootstrap + window config). Branch B (B3) moves those into
// the bundle / consent-gated loader; once done, REMOVE 'unsafe-inline' here.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "'unsafe-inline'", // TODO(B3): remove once inline scripts are gone
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
          "https://apis.google.com",
          "https://accounts.google.com",
        ],
        // Leaflet map popups use inline onclick= handlers (window.getDirections,
        // window.setRating, etc.). helmet's default is script-src-attr 'none',
        // which blocks ALL of them and breaks every popup button. Allow them.
        // TODO(B3): migrate popups to event delegation, then drop this.
        "script-src-attr": ["'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https://*.basemaps.cartocdn.com",
          "https://*.googleusercontent.com",
          "https://www.google-analytics.com",
        ],
        "connect-src": [
          "'self'",
          "https://*.supabase.co",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://www.googletagmanager.com",
          "https://*.googleusercontent.com", // SW fetches Google profile avatars
        ],
        "frame-src": [
          "https://accounts.google.com",
          "https://apis.google.com",
          "https://*.firebaseapp.com",
        ],
        "worker-src": ["'self'"],
        "manifest-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "upgrade-insecure-requests": [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// CORS — allow only the production origin (and localhost in dev)
const allowedOrigins = [
  "https://toaletna.com",
  "https://www.toaletna.com",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:5001", "http://localhost:5173", "http://localhost:3001"]
    : []),
];
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin as string | undefined;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Rate limiting — 150 req / 15 min per IP for all API routes.
// Tightened from 200 now that server-side caching + dropping the redundant
// preload sharply cut a legitimate client's request count.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
// Tighter limit for write operations — 20 req / 15 min per IP
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests, please try again later." },
});
app.use("/api/", apiLimiter);
app.use("/api/reports", writeLimiter);
app.use("/api/toilets", (req: Request, res: Response, next: NextFunction) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      // Concise access log — method, path, status, duration. The response body is
      // intentionally NOT logged (it spammed the terminal with full toilet arrays).
      log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Log the full error server-side; never echo internal messages on 5xx.
    console.error("Unhandled error:", err);
    const message = status < 500 ? err.message || "Request error" : "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // Proxy /blog/* to the blog service
  // Set BLOG_SERVICE_URL in Railway env vars to the blog service's internal URL
  const blogServiceUrl = process.env.BLOG_SERVICE_URL;
  if (blogServiceUrl) {
    app.use(
      "/blog",
      createProxyMiddleware({
        target: blogServiceUrl,
        changeOrigin: true,
        on: {
          error: (err, req, res: any) => {
            log(`Blog proxy error: ${err.message}`);
            res.status(502).json({ error: "Blog service unavailable" });
          },
        },
      })
    );
    log(`Blog proxy active → ${blogServiceUrl}`);
  } else {
    log("BLOG_SERVICE_URL not set — /blog proxy disabled");
  }

  // Serve static files - prefer dist if available, otherwise client
  const clientDistPath = path.resolve(__dirname, "..", "client", "dist");
  const clientPath = fs.existsSync(clientDistPath) ? clientDistPath : path.resolve(__dirname, "..", "client");
  
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    express.static(clientPath)(req, res, next);
  });
  
  // Serve index.html for all non-API routes that don't match static files
  app.get("*", (req, res) => {
    if (!req.path.startsWith('/api/')) {
      const indexPath = fs.existsSync(clientDistPath) 
        ? path.resolve(clientDistPath, "index.html")
        : path.resolve(__dirname, "..", "client", "index.html");
      res.sendFile(indexPath);
    }
  });

  // Use Railway's PORT environment variable or fallback to 5001 for development
  const port = parseInt(process.env.PORT || "5001", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
