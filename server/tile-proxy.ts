import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";

/**
 * CARTO basemap tile proxy.
 *
 * CARTO now watermarks raster tiles ("API KEY REQUIRED") unless the request
 * carries our key. The key must NOT be shipped to the browser: anything the
 * client fetches is visible in devtools, and a VITE_-prefixed env var is inlined
 * into the JS bundle at build time, so both of those leak it permanently.
 *
 * Instead the browser asks THIS origin for /tiles/{z}/{x}/{y}.png and the server
 * appends ?key=... on the way out. CARTO_BASEMAP_KEY is read from the server
 * environment only — it never appears in the bundle, in HTML, or in any response.
 *
 * Without the env var set the proxy still works, it just serves watermarked
 * tiles, so a missing key degrades the map instead of breaking it.
 */

const UPSTREAM_HOST = "https://basemaps.cartocdn.com";
// Style is the one Map.tsx used directly before this proxy existed. Overridable
// so switching basemaps (e.g. to voyager) is an env change, not a deploy.
const STYLE = process.env.CARTO_BASEMAP_STYLE?.trim() || "light_all";
const KEY = process.env.CARTO_BASEMAP_KEY?.trim() || "";

const MAX_Z = 20;
const UPSTREAM_TIMEOUT_MS = 8000;

// Tiles are immutable for practical purposes, so tell the browser and the SW to
// keep them for a month. This is what actually keeps proxy traffic low.
const TILE_CACHE_CONTROL = "public, max-age=2592000, immutable";

// Small in-memory LRU. Sofia is a single dense area, so a few thousand tiles
// cover nearly every request the app ever makes — this collapses repeat traffic
// to CARTO and keeps us far under the 5M/month free tier.
const MAX_CACHE_BYTES = 24 * 1024 * 1024;
type TileEntry = { body: Buffer; contentType: string };
const tileCache = new Map<string, TileEntry>();
let cacheBytes = 0;

function cacheGet(key: string): TileEntry | undefined {
  const hit = tileCache.get(key);
  if (!hit) return undefined;
  // Re-insert to mark most-recently-used.
  tileCache.delete(key);
  tileCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, entry: TileEntry): void {
  if (entry.body.length > MAX_CACHE_BYTES) return;
  const existing = tileCache.get(key);
  if (existing) {
    cacheBytes -= existing.body.length;
    tileCache.delete(key);
  }
  tileCache.set(key, entry);
  cacheBytes += entry.body.length;
  while (cacheBytes > MAX_CACHE_BYTES) {
    const oldest = tileCache.keys().next();
    if (oldest.done) break;
    const victim = tileCache.get(oldest.value)!;
    cacheBytes -= victim.body.length;
    tileCache.delete(oldest.value);
  }
}

// Collapse concurrent misses for the same tile into one upstream fetch. Panning
// clients all ask for the same tiles at the same moment on a cold cache.
const inflight = new Map<string, Promise<TileEntry>>();

async function fetchTile(tilePath: string): Promise<TileEntry> {
  const url = `${UPSTREAM_HOST}/${STYLE}/${tilePath}${KEY ? `?key=${encodeURIComponent(KEY)}` : ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/png,image/*;q=0.8", "User-Agent": "toaletna.com tile proxy" },
    });
    if (!upstream.ok) {
      // Never include `url` here — it carries the key.
      throw new Error(`CARTO responded ${upstream.status} for ${tilePath}`);
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    return { body, contentType: upstream.headers.get("content-type") || "image/png" };
  } finally {
    clearTimeout(timer);
  }
}

// Soft hotlink guard: browsers send Referer/Origin for <img> loads, so a request
// that claims to come from someone else's site is not ours. Requests with no
// Referer at all (service worker, privacy settings, direct hits) are allowed —
// blocking those would break legitimate users.
const ALLOWED_HOSTS = new Set([
  "toaletna.com",
  "www.toaletna.com",
  "localhost",
  "127.0.0.1",
]);

function isAllowedReferrer(req: Request): boolean {
  const raw = req.get("origin") || req.get("referer");
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname;
    return ALLOWED_HOSTS.has(host) || host.endsWith(".railway.app");
  } catch {
    return true;
  }
}

export function registerTileProxy(app: Express): void {
  // Generous limit — one map screen is ~20 tiles, so this allows heavy panning
  // while still stopping anyone from using us as a free tile CDN.
  const tileLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 4000,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many tile requests",
  });

  // Deliberately NOT under /api — the 150 req/15min API limiter would cut the
  // map off after a few screens.
  app.get(
    /^\/tiles\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(@2x)?\.png$/,
    tileLimiter,
    async (req: Request, res: Response) => {
      if (!isAllowedReferrer(req)) {
        res.status(403).end();
        return;
      }

      const params = req.params as unknown as Record<string, string>;
      const z = Number(params[0]);
      const x = Number(params[1]);
      const y = Number(params[2]);
      const retina = params[3] === "@2x" ? "@2x" : "";

      const max = 2 ** z;
      if (z > MAX_Z || x >= max || y >= max) {
        res.status(404).end();
        return;
      }

      const tilePath = `${z}/${x}/${y}${retina}.png`;
      const cacheKey = `${STYLE}/${tilePath}`;

      const cached = cacheGet(cacheKey);
      if (cached) {
        res.setHeader("Content-Type", cached.contentType);
        res.setHeader("Cache-Control", TILE_CACHE_CONTROL);
        res.setHeader("X-Tile-Cache", "HIT");
        res.end(cached.body);
        return;
      }

      try {
        let pending = inflight.get(cacheKey);
        if (!pending) {
          pending = fetchTile(tilePath).finally(() => inflight.delete(cacheKey));
          inflight.set(cacheKey, pending);
        }
        const tile = await pending;
        cacheSet(cacheKey, tile);

        res.setHeader("Content-Type", tile.contentType);
        res.setHeader("Cache-Control", TILE_CACHE_CONTROL);
        res.setHeader("X-Tile-Cache", "MISS");
        res.end(tile.body);
      } catch (err) {
        console.error("Tile proxy error:", err instanceof Error ? err.message : err);
        // Don't let a transient upstream failure get cached as a dead tile.
        res.setHeader("Cache-Control", "no-store");
        res.status(502).end();
      }
    }
  );
}
