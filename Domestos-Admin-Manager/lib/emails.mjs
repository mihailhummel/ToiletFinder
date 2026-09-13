/**
 * Batch-resolve Firebase emails for a set of uids.
 *
 * Shared by dashboard.mjs (Domestos leaderboard, active users) and locations.mjs
 * (the "who added this" column on the Locations tab) so both surfaces show the
 * adder's email without duplicating the batching logic.
 *
 * Firebase Admin is imported lazily inside the function: it throws at module load
 * without credentials configured (see firebase-admin.mjs), which would otherwise
 * make locations.mjs — and its DB-free, zero-setup test suite — impossible to
 * import without Firebase configured, exactly like toilets.mjs does for Supabase.
 */

const BATCH_SIZE = 100; // Firebase Admin's getUsers() limit per call.

/** Best-effort: a failed batch just leaves those uids unresolved (no email). */
export async function resolveEmails(uidSet) {
  const map = new Map();
  const uids = [...uidSet].filter(Boolean);
  if (uids.length === 0) return map;

  const { auth } = await import('./firebase-admin.mjs');
  for (let i = 0; i < uids.length; i += BATCH_SIZE) {
    const chunk = uids.slice(i, i + BATCH_SIZE).map((uid) => ({ uid }));
    try {
      const res = await auth.getUsers(chunk);
      for (const u of res.users) map.set(u.uid, u.email || null);
    } catch (err) {
      console.warn('[domestos-admin] email lookup failed:', err.message);
    }
  }
  return map;
}
