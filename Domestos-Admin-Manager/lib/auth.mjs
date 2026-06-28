/**
 * Dashboard access gate. The ONLY security boundary — the client UI also checks,
 * but never trust it. Two ways in:
 *   1. A site admin (Firebase custom claim `admin === true`) — i.e. you.
 *   2. An email in DOMESTOS_ALLOWLIST (comma-separated) — Domestos / agency staff,
 *      who get VIEW-ONLY access and hold no admin claim, so they cannot touch the map.
 *
 * Status codes: 401 = not signed in / unverifiable token; 403 = signed in but not permitted.
 */
import { auth } from './firebase-admin.mjs';

const allowlist = (process.env.DOMESTOS_ALLOWLIST || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function requireDashboardAccess(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(header.split('Bearer ')[1]);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const isAdmin = decoded.admin === true;
  const email = (decoded.email || '').toLowerCase();
  const isAllowlisted = !!email && allowlist.includes(email);

  if (!isAdmin && !isAllowlisted) {
    return res.status(403).json({ error: 'Access denied' });
  }

  req.viewer = {
    uid: decoded.uid,
    email: decoded.email || null,
    name: decoded.name || decoded.email || 'Потребител',
    role: isAdmin ? 'admin' : 'domestos',
  };
  next();
}
