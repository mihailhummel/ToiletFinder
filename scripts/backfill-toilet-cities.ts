/**
 * One-off backfill: resolve which town/village every EXISTING location sits in.
 *
 * New locations get their city stamped at creation time (server/routes.ts), so this
 * only has to catch up rows that predate the feature — chiefly the OSM import.
 *
 *   npm run backfill:cities                 # run until everything is resolved
 *   npm run backfill:cities -- --limit 200  # do a slice, then stop (resumable)
 *   npm run backfill:cities -- --dry-run    # look up, print, write nothing
 *
 * Resumable by design: it only touches rows where `city_resolved_at IS NULL`, and
 * stamps that column even when OSM has no settlement at the point — so re-running
 * never re-asks about a row that was already answered, and killing the script
 * mid-run costs nothing.
 *
 * SPEED: public Nominatim allows 1 request/second, which server/geocoding.ts
 * enforces — so expect roughly one row per second (~1h per 3,500 rows). Point
 * NOMINATIM_URL at a self-hosted instance and lower NOMINATIM_MIN_INTERVAL_MS to
 * go faster; nothing else needs to change.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_KEY in the environment (.env is read).
 * Run before add_city_columns.sql has been applied and it will fail loudly on the
 * missing column — that's the intended order.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { reverseGeocodeOrThrow } from '../server/geocoding';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set (see .env).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const maxRows = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
if (!(maxRows > 0)) {
  // A bare `--limit` (or a typo) would otherwise silently process nothing.
  console.error('❌ --limit needs a positive number, e.g. --limit 200.');
  process.exit(1);
}
const PAGE_SIZE = 200;
// Abort after this many failures back-to-back (see the circuit breaker in main()).
const MAX_CONSECUTIVE_FAILURES = 25;

interface Row {
  id: string;
  title: string | null;
  coordinates: { lat?: number; lng?: number } | null;
}

// PostgREST puts the useful part in `details`/`hint`/`code` and often leaves
// `message` empty — the "column does not exist" case being exactly the one a
// first-time runner will hit. Surface all of it.
function describe(error: { message?: string; details?: string; hint?: string; code?: string }): string {
  return [error.message, error.details, error.hint, error.code && `(${error.code})`]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Fail fast with an actionable message when add_city_columns.sql hasn't been run. */
async function assertColumnsExist(): Promise<void> {
  const { error } = await supabase.from('toilets').select('city, region, city_resolved_at').limit(1);
  if (!error) return;
  const detail = describe(error);
  if (/column|does not exist|schema cache/i.test(detail)) {
    throw new Error(
      `the city columns are missing — run supabase/migrations/add_city_columns.sql first.\n   Supabase said: ${detail}`
    );
  }
  throw new Error(`Supabase read failed: ${detail}`);
}

async function fetchUnresolvedPage(): Promise<Row[]> {
  // No offset: resolved rows drop out of this filter as we go, so page 0 always
  // holds the next batch of work. That's what makes the script restart-safe.
  const { data, error } = await supabase
    .from('toilets')
    .select('id, title, coordinates')
    .is('city_resolved_at', null)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) throw new Error(`Supabase read failed: ${describe(error)}`);
  return (data || []) as Row[];
}

async function main() {
  await assertColumnsExist();

  const { count, error: countError } = await supabase
    .from('toilets')
    .select('id', { count: 'exact', head: true })
    .is('city_resolved_at', null)
    .eq('is_removed', false);

  if (countError) throw new Error(`Supabase count failed: ${describe(countError)}`);

  const todo = Math.min(count ?? 0, maxRows);
  console.log(`📍 ${count ?? 0} location(s) without a resolved city; processing ${todo}.`);
  if (todo === 0) return;
  if (dryRun) console.log('🔍 Dry run — nothing will be written.\n');

  let processed = 0;
  let resolved = 0;
  let empty = 0;
  let failed = 0;
  // A failed row keeps city_resolved_at NULL, so it comes straight back in the next
  // page. If the upstream dies mid-run that turns into a hot loop re-fetching and
  // re-failing the same rows forever — this counter is the circuit breaker. Reset
  // by any success, so ordinary intermittent failures don't trip it.
  let consecutiveFailures = 0;
  const startedAt = Date.now();

  let stopped = false;
  while (processed < maxRows && !stopped) {
    const rows = await fetchUnresolvedPage();
    if (rows.length === 0) break;

    for (const row of rows) {
      if (processed >= maxRows) break;

      const lat = row.coordinates?.lat;
      const lng = row.coordinates?.lng;

      // Rows with broken coordinates can never be resolved. Stamp them so they
      // stop coming back in every page and blocking progress.
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        console.warn(`⚠️  ${row.id}: invalid coordinates — marking as resolved-empty.`);
        if (!dryRun) await stamp(row.id, null, null);
        processed++;
        empty++;
        consecutiveFailures = 0;
        continue;
      }

      try {
        // Throwing variant on purpose: a failed lookup must be retried later, not
        // written down as "no settlement here".
        const { city, region } = await reverseGeocodeOrThrow(lat, lng);
        if (!dryRun) await stamp(row.id, city, region);

        processed++;
        consecutiveFailures = 0;
        if (city) {
          resolved++;
          console.log(`✅ ${pad(processed, todo)} ${row.id} → ${city}${region ? ` (${region})` : ''}`);
        } else {
          empty++;
          console.log(`➖ ${pad(processed, todo)} ${row.id} → no settlement at ${lat},${lng}`);
        }
      } catch (err) {
        // Leave city_resolved_at NULL so a later run retries this row.
        failed++;
        processed++;
        consecutiveFailures++;
        console.warn(`❌ ${row.id}: ${err instanceof Error ? err.message : err}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `
❌ ${consecutiveFailures} lookups failed in a row — stopping so we don't spin.`
          );
          console.error(
            '   Check the network / NOMINATIM_URL, then re-run: finished rows are already saved.'
          );
          stopped = true;
          break;
        }
      }

      if (processed % 25 === 0) logProgress(processed, todo, startedAt);
    }

    if (stopped) break;
    // A dry run never clears the filter, so one page is all it can ever show.
    if (dryRun) break;
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `\n🏁 Done in ${mins} min — ${resolved} resolved, ${empty} with no settlement, ${failed} failed.`
  );
  if (failed > 0) console.log('   Re-run the script to retry the failed rows.');
}

async function stamp(id: string, city: string | null, region: string | null) {
  const { error } = await supabase
    .from('toilets')
    .update({ city, region, city_resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`write failed: ${describe(error)}`);
}

function pad(n: number, total: number) {
  return `[${String(n).padStart(String(total).length, ' ')}/${total}]`;
}

function logProgress(done: number, total: number, startedAt: number) {
  const elapsed = (Date.now() - startedAt) / 1000;
  const remaining = Math.round((elapsed / done) * (total - done) / 60);
  console.log(`   … ${done}/${total} (~${remaining} min left)`);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
