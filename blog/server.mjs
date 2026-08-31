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
import {
  buildSitemap,
  homepageHeadTags,
  notFoundHeadTags,
  patchShell,
  postHeadTags,
  postRootContent,
  resolveImage,
} from './seo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

// Public URL shape, used to build canonicals and the sitemap. Must match how the
// main app proxies us (toaletna.com/blog).
const SITE_URL = (process.env.VITE_SITE_URL || 'https://toaletna.com').replace(/\/$/, '');
const BASE_PATH = process.env.VITE_BASE_PATH || '/blog';
const SEO = { siteUrl: SITE_URL, basePath: BASE_PATH };

// Client-only SPA routes. They are real pages, not posts, and must not be
// treated as missing articles — nor indexed.
const CLIENT_ROUTES = new Set(['/login', '/admin']);

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


// ── Shared post lookups (used by both the JSON API and the SEO rendering) ─────
//
// Both return cached data where possible. They THROW on a backend failure and
// return null only for "no such published post", so callers can tell a genuine
// 404 apart from Supabase being down — the difference between correctly
// de-indexing a dead URL and accidentally 404-ing the whole blog.

async function getPostList() {
  if (!supabase) throw new Error('Supabase not configured');
  const cached = readCache('list');
  if (cached) return cached;

  const { data, error } = await supabase
    .from('blog_posts')
    .select(LIST_COLUMNS)
    .eq('is_published', true)
    .order('date', { ascending: false })
    .limit(MAX_POSTS);

  if (error) throw new Error(error.message);
  writeCache('list', data);
  return data;
}

async function getPost(slug) {
  if (!supabase) throw new Error('Supabase not configured');
  const key = `post:${slug}`;
  const cached = readCache(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('blog_posts')
    .select(`${LIST_COLUMNS},content`)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) writeCache(key, data);
  return data ?? null;
}

// The built shell still carrying <!-- SEO_HEAD -->. prerender.mjs writes it;
// if prerender was skipped, vite's own index.html still has the marker.
let shellCache = null;
function getShell() {
  if (shellCache) return shellCache;
  for (const f of [path.join(DIST, '_shell.html'), path.join(DIST, 'index.html')]) {
    if (fs.existsSync(f)) {
      shellCache = fs.readFileSync(f, 'utf8');
      return shellCache;
    }
  }
  return '<!doctype html><html><head><!-- SEO_HEAD --></head><body><div id="root"></div></body></html>';
}

// ── sitemap.xml, generated per request from live data ─────────────────────────
//
// Must be registered BEFORE express.static, which would otherwise serve the
// build-time dist/sitemap.xml. That stale file was half the reason new posts
// went undiscovered: a post published between deploys simply was not listed.
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const posts = await getPostList();
    res.type('application/xml');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.send(buildSitemap(posts, SEO));
  } catch (err) {
    console.error('[blog] dynamic sitemap failed:', err.message);
    const built = path.join(DIST, 'sitemap.xml');
    if (fs.existsSync(built)) return res.type('application/xml').sendFile(built);
    return res.sendStatus(503);
  }
});

// The pristine shell is an internal template, not a page. Never serve it: it
// would be a title-less near-duplicate of every article.
app.get('/_shell.html', (_req, res) => res.sendStatus(404));

// 1. Real static assets (JS/CSS/images/sitemap.xml) with correct Content-Type.
//    index:false so we control HTML resolution; redirect:false avoids surprise 301s.
app.use(express.static(DIST, { redirect: false, index: false, maxAge: '1h' }));

// 2. HTML resolution. Post pages are rendered HERE, per request, rather than
//    served from build-time files — that is what lets a post published between
//    deploys be indexed. A URL with no matching published post gets a 404 plus
//    noindex, instead of the homepage shell it used to get (whose canonical
//    pointed at /blog and so told Google to ignore the post entirely).
app.get('*', async (req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(req.path);
  } catch {
    return res.sendStatus(400); // malformed percent-encoding
  }

  const shell = getShell();
  const clean = rel.replace(/\/+$/, '') || '/';

  // Homepage — the prerendered file already carries the right head tags.
  if (clean === '/') {
    const home = path.join(DIST, 'index.html');
    if (fs.existsSync(home)) return res.sendFile(home);
    return res.type('html').send(patchShell(shell, homepageHeadTags(SEO)));
  }

  // Real SPA routes that are not articles. Served, but kept out of the index.
  if (CLIENT_ROUTES.has(clean)) {
    return res.type('html').send(patchShell(shell, notFoundHeadTags(SEO)));
  }

  // A post slug is a single path segment. Anything else (nested paths, control
  // characters, traversal attempts) is not an article and must not reach the
  // filesystem fallback below.
  const slug = clean.slice(1);
  const isSlug = slug.length > 0 && slug.length < 200 && !slug.includes('/');
  if (isSlug) {
    try {
      const post = await getPost(slug);
      if (post) {
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        const image = resolveImage(post.thumbnail, SEO);
        return res
          .type('html')
          .send(patchShell(shell, postHeadTags(post, image, SEO), postRootContent(post)));
      }
    } catch (err) {
      // Supabase unreachable. Do NOT 404 — that would de-index the whole blog
      // over a transient outage. Fall back to whatever the build produced.
      console.error(`[blog] render ${slug} failed:`, err.message);
      // basename() strips any separator, so the slug cannot escape DIST
      // regardless of what it contains.
      const built = path.join(DIST, path.basename(slug), 'index.html');
      if (built.startsWith(DIST + path.sep) && fs.existsSync(built)) return res.sendFile(built);
      return res.sendFile(path.join(DIST, 'index.html'));
    }
  }

  // No such published post.
  return res.status(404).type('html').send(patchShell(shell, notFoundHeadTags(SEO)));
});

app.listen(PORT, () => console.log(`[blog] serving ${DIST} on :${PORT}`));
