/**
 * blog/server.mjs — static server for the prerendered blog (toaletna.com/blog)
 *
 * Replaces `serve dist --single`, whose catch-all rewrite (** -> /index.html)
 * shadowed the prerendered per-post pages at dist/<slug>/index.html for
 * extensionless URLs, so every /blog/<slug> returned the homepage shell.
 *
 * Resolution order for a request (the /blog prefix is already stripped by the
 * main app's proxy, so we receive `/`, `/<slug>`, `/sitemap.xml`, `/assets/...`):
 *   1. A real file on disk (assets, sitemap.xml) — served by express.static.
 *   2. dist/<path>/index.html  (prerendered post / nested page)
 *   3. dist/<path>.html
 *   4. dist/index.html         (SPA fallback for client-only routes: /login, /admin)
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const app = express();

// ── Post data API ─────────────────────────────────────────────────────────────
//
// The SPA used to query Supabase directly from the browser with `select('*')` on
// every page mount — full article bodies plus (before the Storage migration)
// base64 image blobs, uncached, once per visitor AND once per crawler hit. That
// was the single largest source of this project's Supabase egress.
//
// Reads now go through here instead: one shared in-memory cache for everyone, an
// explicit column list that omits `content` from the list view, and HTTP caching
// so repeat visits don't even reach this process.
//
// NOTE: these env vars are read at RUNTIME here, unlike the Vite-inlined ones in
// the client bundle — they must be set as runtime variables on the Railway
// service, not only as build args. Uses the ANON key on purpose, so the same RLS
// policies that protected the direct-from-browser queries still apply.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[blog] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — /api/posts will 503.');
}

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { 'x-app-context': 'toaletna-blog-server' } },
      })
    : null;

// Everything the cards and SEO head tags need — deliberately NOT `content`.
const LIST_COLUMNS =
  'id,title,slug,subtitle,thumbnail,meta_description,date,last_edit_date,author,tags,is_recommended';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_POSTS = 50;

/** { data, ts } per cache key; `list` plus one entry per slug. */
const cache = new Map();

function readCache(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  return null;
}

function writeCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

app.get('/api/posts', async (_req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const cached = readCache('list');
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json(cached);
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select(LIST_COLUMNS)
    .eq('is_published', true)
    .order('date', { ascending: false })
    .limit(MAX_POSTS);

  if (error) {
    console.error('[blog] /api/posts failed:', error.message);
    return res.status(502).json({ error: 'Could not load posts' });
  }

  writeCache('list', data);
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json(data);
});

app.get('/api/posts/:slug', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { slug } = req.params;
  const key = `post:${slug}`;

  const cached = readCache(key);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json(cached);
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select(`${LIST_COLUMNS},content`)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) {
    console.error(`[blog] /api/posts/${slug} failed:`, error.message);
    return res.status(502).json({ error: 'Could not load post' });
  }
  if (!data) return res.status(404).json({ error: 'Not found' });

  writeCache(key, data);
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json(data);
});

// Lets the admin publish without waiting out the TTL. Authorisation is the
// caller's own Supabase session — the same credential the admin write itself
// needs — so this can't be used by anonymous callers to force cache churn.
app.post('/api/posts/flush', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(403).json({ error: 'Invalid session' });

  cache.clear();
  res.json({ flushed: true });
});

// 1. Real static assets (JS/CSS/images/sitemap.xml) with correct Content-Type.
//    index:false so we control HTML resolution; redirect:false avoids surprise 301s.
app.use(express.static(DIST, { redirect: false, index: false, maxAge: '1h' }));

// 2. Clean-URL HTML resolution for everything else.
app.get('*', (req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(req.path);
  } catch {
    return res.sendStatus(400); // malformed percent-encoding
  }

  // Confine to DIST. normalize() collapses any `..`; the startsWith guard below
  // rejects only paths that still resolve outside DIST — ordinary slugs
  // (including non-ASCII ones) stay inside and must return 200.
  const base = path.join(DIST, path.normalize(rel));
  if (base !== DIST && !base.startsWith(DIST + path.sep)) {
    return res.sendStatus(400); // path-traversal attempt
  }

  const candidates = [
    path.join(base, 'index.html'),                  // dist/<slug>/index.html
    base.endsWith('.html') ? base : base + '.html', // dist/<slug>.html
  ];
  for (const f of candidates) {
    if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      return res.sendFile(f);
    }
  }

  // SPA fallback for client-only routes (no prerendered file exists).
  return res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => console.log(`[blog] serving ${DIST} on :${PORT}`));
