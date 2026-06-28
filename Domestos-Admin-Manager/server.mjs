/**
 * Domestos Admin Manager — standalone server for domestos.toaletna.com.
 *
 * Serves the built Vite frontend AND the admin-gated, read-only dashboard API
 * from one origin (so no CORS). Mirrors blog/server.mjs in spirit. To disable the
 * whole tool when the campaign ends, delete this Railway service + its domain.
 */
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireDashboardAccess } from './lib/auth.mjs';
import { buildDashboard } from './lib/dashboard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 4000;

const app = express();
app.disable('x-powered-by');

// Public health check (Railway healthcheckPath = /healthz).
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// Echo the viewer's identity/role so the UI can greet them (also gated).
app.get('/api/me', requireDashboardAccess, (req, res) => res.json(req.viewer));

// The whole dashboard in one gated call.
app.get('/api/dashboard', requireDashboardAccess, async (_req, res) => {
  try {
    const data = await buildDashboard();
    res.set('Cache-Control', 'private, no-store');
    res.json(data);
  } catch (err) {
    console.error('[domestos-admin] dashboard error:', err);
    res.status(500).json({ error: 'Failed to build dashboard' });
  }
});

// Any other /api/* is a real 404 (never fall through to the SPA shell).
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Static assets, then SPA fallback for everything else.
app.use(express.static(DIST, { index: false, redirect: false, maxAge: '1h' }));
app.get('*', (_req, res) => {
  const indexHtml = path.join(DIST, 'index.html');
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res
    .status(503)
    .send('Frontend not built yet. Run "npm run build" (see Domestos-Admin-Manager/README).');
});

app.listen(PORT, () => console.log(`[domestos-admin] serving on :${PORT}`));
