import express, { type Request, Response, NextFunction } from "express";
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

  // Serve the API on port 5001
  const port = 5001;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
