/**
 * Nominatim (OpenStreetMap) geocoding, proxied through this server.
 *
 * Two jobs:
 *   1. Forward search — the header search bar and the mobile location picker look
 *      up towns/villages/places by name and fly the map there
 *      (GET /api/geocode/search, open to all visitors).
 *   2. Reverse geocoding — when a location is created (or an admin moves it) we
 *      resolve WHICH settlement it landed in and store it on the row, so the
 *      Domestos admin can count locations per city.
 *
 * The HTTP surface lives in routes.ts (GET /api/geocode/search, rate-limited); this
 * module is a dependency-free client so scripts/backfill-toilet-cities.ts can import
 * it without booting Express or Firebase.
 *
 * Why proxy instead of calling Nominatim from the browser:
 *   - Nominatim's usage policy requires an identifying User-Agent, and browsers
 *     refuse to set that header.
 *   - It allows at most 1 request/second. Serialising here is the only place we
 *     can actually enforce that across all callers.
 *   - The response cache below means repeat searches never leave this process.
 *
 * Set NOMINATIM_URL to a self-hosted / commercial instance to lift the rate limit;
 * everything else keeps working unchanged.
 */

const NOMINATIM_URL = (process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
// Nominatim's policy requires an identifying User-Agent with a way to reach the
// operator; a site URL satisfies that. Set NOMINATIM_USER_AGENT to add a contact
// email if you'd rather they mail you than open an issue — don't hardcode a
// personal address here, it goes out on every request.
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT?.trim() || "toaletna.com/1.0 (+https://toaletna.com)";
const UPSTREAM_TIMEOUT_MS = 6000;
// Only bumped for a self-hosted instance; the public one is a hard 1 req/s.
const MIN_INTERVAL_MS = Number(process.env.NOMINATIM_MIN_INTERVAL_MS) || 1100;

// The app is Bulgaria-only, so every lookup is country-scoped and asks for
// Bulgarian names — a city must be spelled the same way on every row or the
// per-city counts split in two.
const COUNTRY_CODES = "bg";
const LANG = "bg";

export interface PlaceResult {
  /** Nominatim place_id, used as a React key only. */
  id: string;
  /** Short label: the settlement/place name. */
  name: string;
  /** Full comma-separated address, for disambiguating same-named villages. */
  label: string;
  lat: number;
  lng: number;
  /** OSM class/type, e.g. "place"/"village" — drives the icon + zoom choice. */
  category: string;
  type: string;
  /** [south, west, north, east], when Nominatim supplies one. */
  boundingBox: [number, number, number, number] | null;
}

export interface ResolvedCity {
  city: string | null;
  region: string | null;
}

/** Thrown when too many lookups are already queued — the caller should back off. */
export class GeocoderBusyError extends Error {
  constructor() {
    super("Geocoder queue is saturated");
    this.name = "GeocoderBusyError";
  }
}

// ─── Rate limiting: one in-flight upstream call at a time, ≥MIN_INTERVAL_MS apart ──
// A promise chain rather than a timer, so callers queue in arrival order and a
// burst (the backfill script, a fast typist) can never exceed the policy.
//
// The depth cap matters now that the search box is open to every visitor, not just
// admins: at ~1 call/second an unbounded queue would let a flood of misses build a
// backlog minutes deep, and each waiter would hold a request open the whole time.
// Rejecting immediately past the cap keeps latency bounded — the response cache
// means the common searches never reach the queue at all.
const MAX_QUEUE_DEPTH = 24;
let queueDepth = 0;
let upstreamChain: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  if (queueDepth >= MAX_QUEUE_DEPTH) return Promise.reject(new GeocoderBusyError());
  queueDepth++;

  const run = upstreamChain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return task();
  });
  // Keep the chain alive even when a link rejects, or every later call inherits it.
  upstreamChain = run.catch(() => undefined);
  return run.finally(() => {
    queueDepth--;
  });
}

async function nominatim<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${NOMINATIM_URL}${path}?${new URLSearchParams(params).toString()}`;
  return schedule(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  });
}

// ─── Response cache ───────────────────────────────────────────────────────────
// Place names and settlement boundaries don't move, so results stay good for a
// long time. Bounded LRU, and the single most important defence now that the search
// box is public: visitors overwhelmingly search the same few hundred Bulgarian
// settlements, so after warm-up almost nothing reaches the upstream queue.
const MAX_CACHE_ENTRIES = 5000;
const cache = new Map<string, unknown>();

function cacheGet<T>(key: string): T | undefined {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key) as T;
  cache.delete(key); // re-insert => most recently used
  cache.set(key, value);
  return value;
}

function cacheSet(key: string, value: unknown): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

// ─── Forward search (header search bar / location picker) ─────────────────────────

interface NominatimSearchRow {
  place_id: number | string;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  class?: string;
  category?: string;
  type?: string;
  boundingbox?: string[];
}

/** Look up towns, villages and other named places by name. Bulgaria only. */
export async function searchPlaces(query: string, limit = 8): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const key = `search:${LANG}:${limit}:${q.toLowerCase()}`;
  const hit = cacheGet<PlaceResult[]>(key);
  if (hit) return hit;

  const rows = await nominatim<NominatimSearchRow[]>("/search", {
    q,
    format: "jsonv2",
    countrycodes: COUNTRY_CODES,
    "accept-language": LANG,
    addressdetails: "1",
    limit: String(limit),
  });

  const results = (Array.isArray(rows) ? rows : []).map(toPlaceResult);
  // Settlements first — the stated need is "search up different towns and
  // villages", so a village named X must outrank a shop named X.
  results.sort((a, b) => settlementRank(a) - settlementRank(b));
  cacheSet(key, results);
  return results;
}

const SETTLEMENT_TYPES = new Set(["city", "town", "village", "hamlet", "municipality", "isolated_dwelling"]);

function settlementRank(p: PlaceResult): number {
  if (p.category === "place" && SETTLEMENT_TYPES.has(p.type)) return 0;
  if (p.category === "boundary" || p.category === "place") return 1;
  return 2;
}

function toPlaceResult(row: NominatimSearchRow): PlaceResult {
  const bb = row.boundingbox?.map(Number);
  const boundingBox =
    bb && bb.length === 4 && bb.every((n) => Number.isFinite(n))
      ? ([bb[0], bb[2], bb[1], bb[3]] as [number, number, number, number])
      : null;

  return {
    id: String(row.place_id),
    // jsonv2 gives a short `name`; fall back to the first chunk of display_name.
    name: row.name?.trim() || row.display_name.split(",")[0].trim(),
    label: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
    category: row.class || row.category || "",
    type: row.type || "",
    boundingBox,
  };
}

// ─── Reverse geocoding (which settlement is this pin in?) ─────────────────────

interface NominatimReverseResponse {
  address?: Record<string, string>;
  error?: string;
}

/**
 * Resolve the settlement + oblast a coordinate falls in. THROWS if the lookup
 * itself fails.
 *
 * Use this wherever "OSM has no settlement here" must stay distinguishable from
 * "we couldn't ask" — above all the backfill script, which records the answer
 * permanently. Conflating the two there would let one network outage mark
 * thousands of rows as settlement-less, and they'd never be retried.
 */
export async function reverseGeocodeOrThrow(lat: number, lng: number): Promise<ResolvedCity> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`invalid coordinates: ${lat},${lng}`);
  }

  // ~110 m grid. Locations added in the same building/street share a cache entry,
  // and it is far finer than any settlement boundary.
  const key = `rev:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cacheGet<ResolvedCity>(key);
  if (hit) return hit;

  const data = await nominatim<NominatimReverseResponse>("/reverse", {
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    "accept-language": LANG,
    addressdetails: "1",
    // 10 = city/town/village level. Finer zooms return the neighbourhood, which
    // would scatter Sofia's locations across "Лозенец", "Люлин", …
    zoom: "10",
  });

  const resolved = pickSettlement(data.address);
  cacheSet(key, resolved);
  return resolved;
}

/**
 * Same lookup, but never throws — a failure yields nulls.
 *
 * This is the write-path variant: the toilet row is already committed by the time
 * it runs, so a geocoding hiccup must not surface as an error. The caller treats
 * an all-null result as "not resolved yet" and leaves the row for the backfill.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedCity> {
  try {
    return await reverseGeocodeOrThrow(lat, lng);
  } catch (err) {
    console.warn("⚠️ Reverse geocode failed:", err instanceof Error ? err.message : err);
    return { city: null, region: null };
  }
}

/**
 * Pull the settlement + oblast out of a Nominatim address object.
 * Ordered most- to least-specific; `suburb` is deliberately absent so a pin in
 * Sofia reads "София", not "Лозенец".
 */
function pickSettlement(address?: Record<string, string>): ResolvedCity {
  if (!address) return { city: null, region: null };
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = address[k]?.trim();
      if (v) return v;
    }
    return null;
  };
  return {
    city: first("city", "town", "village", "hamlet", "isolated_dwelling", "municipality"),
    region: first("state", "province", "county"),
  };
}
