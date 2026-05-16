/**
 * blog/prerender.mjs — Static Site Generation for toaletna.com/blog
 *
 * Run after `vite build`: node prerender.mjs
 *
 * For each published post this script:
 *   1. Creates dist/blog/{slug}/index.html with full SEO metadata in <head>
 *      and a pre-rendered article preview in #root (for Googlebot)
 *   2. Improves dist/blog/index.html homepage metadata
 *   3. Generates dist/blog/sitemap.xml with all post URLs
 *
 * Reads env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL
 * Railway injects all service vars into the build environment regardless of prefix.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SITE_URL     = (process.env.VITE_SITE_URL || 'https://toaletna.com').replace(/\/$/, '');
const BASE_PATH    = (process.env.VITE_BASE_PATH || '/blog').replace(/\/$/, '');
const DIST_DIR     = path.resolve(__dirname, 'dist');

// Vite's `base: '/blog'` only prefixes asset URLs — the shell always lands at dist/index.html
const SHELL_PATH   = path.join(DIST_DIR, 'index.html');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[prerender] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — skipping prerender.');
  process.exit(0); // Exit 0 so a missing env in dev doesn't break the build
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripMarkupAndAds(text = '') {
  return text
    .replace(/\{insert_ad_\d+\}/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(content = '', maxLen = 400) {
  const plain = stripMarkupAndAds(content);
  return plain.length > maxLen ? plain.slice(0, maxLen) + '…' : plain;
}

function resolveImage(thumbnail, siteUrl, basePath) {
  if (!thumbnail) return `${siteUrl}${basePath}/og-default.jpg`;
  return thumbnail.startsWith('http') ? thumbnail : `${siteUrl}${basePath}${thumbnail}`;
}

// ── Head injection for a single post ─────────────────────────────────────────

function postHeadTags(post) {
  const canonical  = `${SITE_URL}${BASE_PATH}/${post.slug}`;
  const title      = esc(`${post.title} | Toaletna.com Блог`);
  const desc       = esc(post.meta_description || post.subtitle || '');
  const image      = resolveImage(post.thumbnail, SITE_URL, BASE_PATH);
  const dateModified = post.last_edit_date || post.date;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description || post.subtitle || '',
    author: { '@type': 'Person', name: post.author },
    datePublished: post.date,
    dateModified,
    image,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    publisher: { '@type': 'Organization', name: 'Toaletna.com', url: SITE_URL },
  });

  return `<title>${title}</title>
    <meta name="description" content="${desc}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${esc(post.title)}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:type" content="article">
    <meta property="og:locale" content="bg_BG">
    <meta property="og:site_name" content="Toaletna.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(post.title)}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">
    <meta name="robots" content="index, follow">
    <script type="application/ld+json">${jsonLd}<\/script>`;
}

// ── Pre-rendered #root content for a post ────────────────────────────────────

function postRootContent(post) {
  const dateStr = (() => {
    try {
      return new Date(post.date).toLocaleDateString('bg-BG', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return post.date || ''; }
  })();

  return `<article style="max-width:860px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;">
    <h1 style="font-size:2rem;font-weight:800;margin-bottom:.5rem;line-height:1.2">${esc(post.title)}</h1>
    <p style="color:#555;font-size:1.1rem;margin-bottom:1rem">${esc(post.subtitle || '')}</p>
    <p style="color:#888;font-size:.85rem;margin-bottom:2rem">Автор: ${esc(post.author)} &bull; ${dateStr}</p>
    <p style="line-height:1.8;color:#333;font-size:1rem">${esc(excerpt(post.content))}</p>
  </article>`;
}

// ── Improved homepage head ────────────────────────────────────────────────────

function homepageHeadTags() {
  const canonical = `${SITE_URL}${BASE_PATH}`;
  const title     = 'Toaletna.com | Блог за Обществени Тоалетни в България';
  const desc      = 'Статии, съвети и новини за обществените тоалетни в България. Официалният блог на Toaletna.com.';
  const image     = `${SITE_URL}${BASE_PATH}/og-default.jpg`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Toaletna.com Блог',
    url: canonical,
    description: desc,
    publisher: { '@type': 'Organization', name: 'Toaletna.com', url: SITE_URL },
  });

  return `<title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="keywords" content="блог тоалетни, обществени тоалетни България, Toaletna.com блог, публични тоалетни">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Toaletna.com">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${image}">
    <meta property="og:locale" content="bg_BG">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${image}">
    <meta name="robots" content="index, follow">
    <script type="application/ld+json">${jsonLd}<\/script>`;
}

// ── Sitemap generation ────────────────────────────────────────────────────────

function buildSitemap(posts) {
  const now = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url>\n    <loc>${SITE_URL}${BASE_PATH}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ...posts.map(p => {
      const lastmod = (p.last_edit_date || p.date || now).slice(0, 10);
      return `  <url>\n    <loc>${SITE_URL}${BASE_PATH}/${p.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ── Patch a shell HTML with new head tags and optional root content ───────────

function patchShell(shell, headTags, rootContent = null) {
  // Replace everything between <title> and the last </script> in the <head>
  // Strategy: replace the existing <title>...</title> block (including adjacent meta/script tags
  // that were there before) with the new head tags.
  // We identify the section to replace using the SSR_PLACEHOLDER comment if present,
  // otherwise fall back to simple title replacement.
  let html = shell;

  // Replace <title> block — works whether it's a single <title> or multi-line
  html = html.replace(/<title>[\s\S]*?<\/title>/, headTags);

  if (rootContent !== null) {
    // Replace the SSR placeholder comment (preferred) or the empty root div
    if (html.includes('<!-- SSR_PLACEHOLDER -->')) {
      html = html.replace('<!-- SSR_PLACEHOLDER -->', rootContent);
    } else {
      html = html.replace(/<div id="root"><\/div>/, `<div id="root">${rootContent}</div>`);
    }
  }

  return html;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(SHELL_PATH)) {
    console.error(`[prerender] Shell not found at ${SHELL_PATH}. Run vite build first.`);
    process.exit(1);
  }
  const shell = fs.readFileSync(SHELL_PATH, 'utf8');

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

  // Ensure dist/blog/ directory exists
  const blogDir = path.join(DIST_DIR, 'blog');
  fs.mkdirSync(blogDir, { recursive: true });

  // Write improved homepage to dist/blog/index.html
  // (served when proxy forwards /blog/ to the blog service)
  const homepageHtml = patchShell(shell, homepageHeadTags());
  fs.writeFileSync(path.join(blogDir, 'index.html'), homepageHtml, 'utf8');
  console.log('[prerender] Created: dist/blog/index.html');

  // Generate per-post pages
  for (const post of posts) {
    if (!post.slug) { console.warn(`[prerender] Skipping post ${post.id} — no slug`); continue; }
    const dir = path.join(DIST_DIR, 'blog', post.slug);
    fs.mkdirSync(dir, { recursive: true });
    const postHtml = patchShell(shell, postHeadTags(post), postRootContent(post));
    fs.writeFileSync(path.join(dir, 'index.html'), postHtml, 'utf8');
    console.log(`[prerender]   dist/blog/${post.slug}/index.html`);
  }

  // Generate sitemap
  const sitemapPath = path.join(DIST_DIR, 'blog', 'sitemap.xml');
  fs.writeFileSync(sitemapPath, buildSitemap(posts), 'utf8');
  console.log(`[prerender] Generated: dist/blog/sitemap.xml (${posts.length} post URLs)`);

  console.log('[prerender] Done.');
}

main().catch(err => {
  console.error('[prerender] Fatal error:', err);
  process.exit(1);
});
