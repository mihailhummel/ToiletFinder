/**
 * blog/prerender.mjs — Static Site Generation for toaletna.com/blog
 *
 * Run after `vite build`: node prerender.mjs
 *
 * For each published post this script:
 *   1. Creates dist/{slug}/index.html with full SEO metadata in <head>
 *      and a pre-rendered article preview in #root (for Googlebot)
 *   2. Improves dist/index.html homepage metadata
 *   3. Generates dist/sitemap.xml with all post URLs
 *
 * Reads env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL
 * Railway injects all service vars into the build environment regardless of prefix.
 */

import { createClient } from '@supabase/supabase-js';
// Shared with server.mjs so build-time and request-time output cannot drift.
import {
  postHeadTags as buildPostHead,
  homepageHeadTags as buildHomeHead,
  postRootContent as buildPostRoot,
  buildSitemap as buildSitemapXml,
  patchShell as patchShellHtml,
} from './seo.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SITE_URL     = (process.env.VITE_SITE_URL || 'https://toaletna.com').replace(/\/$/, '');
const BASE_PATH    = (process.env.VITE_BASE_PATH || '/blog').replace(/\/$/, '');
const SEO          = { siteUrl: SITE_URL, basePath: BASE_PATH };
const DIST_DIR     = path.resolve(__dirname, 'dist');

// Vite's `base: '/blog'` only prefixes asset URLs — the shell always lands at dist/index.html
const SHELL_PATH   = path.join(DIST_DIR, 'index.html');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[prerender] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — skipping prerender.');
  process.exit(0); // Exit 0 so a missing env in dev doesn't break the build
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────




// og:image / twitter:image / JSON-LD image must be a real, crawlable URL — never a
// base64 data: URI (invalid for crawlers & social cards, and it bloats the prerendered
// HTML by megabytes). For a data: URI thumbnail we decode it to a real file in the
// post's own dist dir and link that; http(s) URLs and site-relative paths pass through.
const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
};

function materializeImage(thumbnail, slug, dir) {
  const fallback = `${SITE_URL}${BASE_PATH}/blog-logo.png`;
  if (!thumbnail) return fallback;
  if (thumbnail.startsWith('http')) return thumbnail;
  if (thumbnail.startsWith('/')) return `${SITE_URL}${BASE_PATH}${thumbnail}`;

  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(thumbnail.trim());
  if (!m) return fallback;
  const ext = MIME_EXT[m[1].toLowerCase()] || 'png';
  try {
    const file = `og-thumb.${ext}`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(m[2], 'base64'));
    return `${SITE_URL}${BASE_PATH}/${slug}/${file}`;
  } catch (err) {
    console.warn(`[prerender] could not write OG image for ${slug}: ${err.message}`);
    return fallback;
  }
}

// ── Head injection for a single post ─────────────────────────────────────────


// ── Pre-rendered #root content for a post ────────────────────────────────────


// ── Improved homepage head ────────────────────────────────────────────────────


// ── Sitemap generation ────────────────────────────────────────────────────────


// ── Patch a shell HTML with new head tags and optional root content ───────────


// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(SHELL_PATH)) {
    console.error(`[prerender] Shell not found at ${SHELL_PATH}. Run vite build first.`);
    process.exit(1);
  }
  const shell = fs.readFileSync(SHELL_PATH, 'utf8');

  // Keep a pristine copy of the built shell, with its <!-- SEO_HEAD --> marker
  // still intact. dist/index.html gets that marker replaced with the homepage's
  // tags below, so it can no longer be used as a template — and server.mjs needs
  // one to inject per-post tags into at request time (that is what makes a post
  // published between deploys indexable).
  fs.writeFileSync(path.join(DIST_DIR, '_shell.html'), shell);

  // Fetch all published posts
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id,title,slug,subtitle,thumbnail,content,meta_description,date,last_edit_date,author')
    .eq('is_published', true)
    .order('date', { ascending: false });

  if (error) {
    console.error('[prerender] Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`[prerender] Fetched ${posts.length} published posts.`);

  // IMPORTANT: the main app proxies /blog/* to this service and STRIPS the /blog
  // prefix, so `serve dist` receives paths WITHOUT /blog. The prerendered pages
  // must therefore live at the dist ROOT — dist/index.html (homepage),
  // dist/{slug}/index.html (posts), dist/sitemap.xml — so that the public URLs
  // /blog, /blog/{slug} and /blog/sitemap.xml resolve to them. (Writing them
  // under dist/blog/ makes them unreachable through the proxy.)

  // Homepage → overwrite the SPA shell with SEO-rich head tags.
  const homepageHtml = patchShellHtml(shell, buildHomeHead(SEO));
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), homepageHtml, 'utf8');
  console.log('[prerender] Wrote: dist/index.html (homepage)');

  // Per-post pages → dist/{slug}/index.html
  for (const post of posts) {
    if (!post.slug) { console.warn(`[prerender] Skipping post ${post.id} — no slug`); continue; }
    const dir = path.join(DIST_DIR, post.slug);
    fs.mkdirSync(dir, { recursive: true });
    const image = materializeImage(post.thumbnail, post.slug, dir);
    const postHtml = patchShellHtml(shell, buildPostHead(post, image, SEO), buildPostRoot(post));
    fs.writeFileSync(path.join(dir, 'index.html'), postHtml, 'utf8');
    console.log(`[prerender]   dist/${post.slug}/index.html`);
  }

  // Sitemap → dist/sitemap.xml (served at /blog/sitemap.xml after the proxy strip)
  const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, buildSitemapXml(posts, SEO), 'utf8');
  console.log(`[prerender] Generated: dist/sitemap.xml (${posts.length} post URLs)`);

  console.log('[prerender] Done.');
}

main().catch(err => {
  console.error('[prerender] Fatal error:', err);
  process.exit(1);
});
