/**
 * Shared, cached read of the full toilets table.
 *
 * Both the campaign dashboard and the Locations tab need every row; without this
 * they'd each pull ~4 pages of 1,000 rows on their own schedule. One cache, one
 * TTL, both callers served.
 *
 * select('*') is intentional — it stays resilient when a column hasn't been
 * migrated yet (is_domestos, city, region are simply `undefined` on old rows).
 *
 * The Supabase client is imported lazily: it throws at module load without
 * SUPABASE_URL/SUPABASE_SERVICE_KEY, which would make the pure helpers that sit
 * on top of this (and their tests) impossible to import without a live env.
 */

const CACHE_TTL_MS = 60 * 1000;
const PAGE_SIZE = 1000;

let cache = null;
let inflight = null;

/** Every non-removed toilet row, raw (snake_case, straight from Supabase). */
export async function getAllToilets() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.rows;
  // Collapse concurrent misses — a dashboard load and a locations load landing
  // together must not both run the full pagination.
  if (!inflight) {
    inflight = fetchAllToilets()
      .then((rows) => {
        cache = { ts: Date.now(), rows };
        return rows;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function fetchAllToilets() {
  const { supabase } = await import('./supabase.mjs');
  let all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('toilets')
      .select('*')
      .eq('is_removed', false)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}
