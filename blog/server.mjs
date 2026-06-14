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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const app = express();

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
