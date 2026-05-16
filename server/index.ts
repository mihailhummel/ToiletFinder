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

// Security headers (CSP and COEP disabled — needed for map tiles and embeds)
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

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

// Rate limiting — 200 req / 15 min per IP for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
