/**
 * The "all locations, filterable by city" view behind GET /api/locations.
 *
 * Cities come from the `city` / `region` columns, reverse-geocoded when a location
 * is created (see the main app's server/geocoding.ts). Rows added before that
 * feature — or where OSM had no settlement at the point — have a NULL city and are
 * grouped under a single "unknown" bucket rather than being hidden, so the totals
 * here always add up to the real number of locations.
 *
 * Filtering happens in memory over the shared 60s toilet cache: the whole table is
 * a few thousand rows, so this is far cheaper than a query per filter change and it
 * lets the city list carry exact counts without a second round trip.
 */
import { getAllToilets } from './toilets.mjs';

/** Grouping key. Same-named villages in different oblasti must not merge. */
const cityKey = (city, region) => (city ? `${city}|${region || ''}` : UNKNOWN_KEY);
export const UNKNOWN_KEY = '__unknown__';

/**
 * Bulgaria's 28 oblasti, spelled exactly as Nominatim returns them in the `state`
 * field with accept-language=bg. A closed list on purpose: the region grid shows
 * all 28 always, including any sitting at zero, so "nothing in Kardzhali yet" is
 * as visible as "485 in Sofia".
 *
 * Anything else appearing in `region` is a foreign province, not a spelling to be
 * absorbed. The OSM import selected toilets by Bulgaria's BOUNDING BOX, and that
 * rectangle overlaps Serbia, Greece, Turkey and Romania — so those rows are real
 * toilets in other countries. They go to FOREIGN_KEY, where they stay counted and
 * findable instead of quietly padding a Bulgarian oblast.
 */
export const BG_REGIONS = [
  'Благоевград', 'Бургас', 'Варна', 'Велико Търново', 'Видин', 'Враца', 'Габрово',
  'Добрич', 'Кърджали', 'Кюстендил', 'Ловеч', 'Монтана', 'Пазарджик', 'Перник',
  'Плевен', 'Пловдив', 'Разград', 'Русе', 'Силистра', 'Сливен', 'Смолян',
  'София-град', 'Софийска', 'Стара Загора', 'Търговище', 'Хасково', 'Шумен', 'Ямбол',
];
const BG_REGION_SET = new Set(BG_REGIONS);

/** Bucket for locations whose region is outside Bulgaria (see BG_REGIONS). */
export const FOREIGN_KEY = '__foreign__';

/** Region grouping key: the oblast itself, or a data-quality bucket. */
function regionKey(region) {
  if (!region) return UNKNOWN_KEY;
  return BG_REGION_SET.has(region) ? region : FOREIGN_KEY;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

function toLocation(row) {
  return {
    id: row.id,
    title: row.title || null,
    type: row.type || 'other',
    source: row.source || 'user',
    isDomestos: row.is_domestos === true,
    city: row.city || null,
    region: row.region || null,
    cityKey: cityKey(row.city, row.region),
    regionKey: regionKey(row.region),
    // Whether the reverse-geocode has RUN, which is a different question from
    // whether it found a settlement: rural points and motorways legitimately
    // resolve to no city at all.
    cityResolved: !!row.city_resolved_at,
    addedByUserName: row.added_by_user_name || null,
    averageRating: Number(row.average_rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    createdAt: row.created_at,
    lat: typeof row.coordinates?.lat === 'number' ? row.coordinates.lat : null,
    lng: typeof row.coordinates?.lng === 'number' ? row.coordinates.lng : null,
  };
}

/**
 * @param {object} params
 * @param {string} [params.city]     cityKey to filter by ("София|София-град", or UNKNOWN_KEY)
 * @param {string} [params.region]   oblast name, or FOREIGN_KEY / UNKNOWN_KEY
 * @param {string} [params.q]        free text over title / id / city
 * @param {string} [params.type]     toilet type
 * @param {string} [params.source]   'user' | 'osm'
 * @param {boolean} [params.domestos] only Domestos-flagged locations
 * @param {string} [params.sort]     'newest' | 'oldest' | 'rating' | 'reviews'
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 */
export async function queryLocations(params = {}) {
  return buildLocationsResult(await getAllToilets(), params);
}

/**
 * The pure half of queryLocations: raw Supabase rows in, response payload out.
 * Split out so lib/locations.test.mjs can exercise the filtering and the city
 * counts without a database.
 */
export function buildLocationsResult(rows, params = {}) {
  const all = rows.map(toLocation);

  // Each index is built from everything its OWN filter doesn't apply to, so
  // selecting a value never collapses the control you selected it from:
  //   regions — base filters only, so all 28 tiles keep their real counts;
  //   cities  — base + region, so picking an oblast narrows the dropdown to it;
  //   items   — everything.
  const base = all.filter((l) => matchesBase(l, params));
  const regions = buildRegionIndex(base);
  const cities = buildCityIndex(base.filter((l) => matchesRegion(l, params.region)));

  const limit = clamp(Number(params.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = Math.max(0, Number(params.offset) || 0);

  const filtered = base.filter(
    (l) => matchesRegion(l, params.region) && matchesCity(l, params.city)
  );
  sortLocations(filtered, params.sort);

  return {
    generatedAt: new Date().toISOString(),
    total: all.length,
    filtered: filtered.length,
    offset,
    limit,
    items: filtered.slice(offset, offset + limit),
    regions,
    cities,
    // Never geocoded yet — the only bucket the backfill script can still fix.
    // Deliberately NOT "has no city": a point can be geocoded and legitimately
    // sit in no settlement, and telling someone to re-run a finished script
    // because of those would be wrong.
    unresolvedCount: all.filter((l) => !l.cityResolved).length,
    // Locations sitting outside Bulgaria (bounding-box artefacts of the OSM import).
    foreignCount: all.filter((l) => l.regionKey === FOREIGN_KEY).length,
    // Geocoded but in no administrative region at all — the remainder that makes
    // regions + foreign + this add up to the total.
    noRegionCount: all.filter((l) => l.regionKey === UNKNOWN_KEY).length,
  };
}

/**
 * All 28 oblasti with their counts, always — including any at zero, which is the
 * point of showing the full set rather than a top-N slice. Sorted busiest-first so
 * the grid still answers "where do we have most".
 */
function buildRegionIndex(rows) {
  const byKey = new Map(
    BG_REGIONS.map((name) => [
      name,
      { key: name, name, total: 0, userAdded: 0, osm: 0, domestos: 0, reviews: 0 },
    ])
  );

  for (const l of rows) {
    const entry = byKey.get(l.regionKey);
    if (!entry) continue; // foreign / unresolved — reported as their own counts
    entry.total++;
    if (l.source === 'user') entry.userAdded++;
    else entry.osm++;
    if (l.isDomestos) entry.domestos++;
    entry.reviews += l.reviewCount;
  }

  return [...byKey.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'bg')
  );
}

/** Every distinct city in the given rows, with its counts. */
function buildCityIndex(rows) {
  const byKey = new Map();
  for (const l of rows) {
    let entry = byKey.get(l.cityKey);
    if (!entry) {
      entry = {
        key: l.cityKey,
        city: l.city,
        region: l.region,
        total: 0,
        userAdded: 0,
        osm: 0,
        domestos: 0,
      };
      byKey.set(l.cityKey, entry);
    }
    entry.total++;
    if (l.source === 'user') entry.userAdded++;
    else entry.osm++;
    if (l.isDomestos) entry.domestos++;
  }

  return [...byKey.values()].sort((a, b) => {
    // Unknown always last — it's a data-quality bucket, not a place.
    if (a.key === UNKNOWN_KEY) return 1;
    if (b.key === UNKNOWN_KEY) return -1;
    if (b.total !== a.total) return b.total - a.total;
    return (a.city || '').localeCompare(b.city || '', 'bg');
  });
}

/** Filters that apply to every index: type, source, Domestos flag, free text. */
function matchesBase(l, params) {
  if (params.type && l.type !== params.type) return false;
  if (params.source && l.source !== params.source) return false;
  if (params.domestos && !l.isDomestos) return false;

  // Region is searchable too, so typing an oblast ("Пловдив") pulls up every
  // village in it — the dropdown is there when an exact settlement is wanted.
  const q = (params.q || '').trim().toLowerCase();
  if (q) {
    const haystack =
      `${l.title || ''} ${l.id} ${l.city || ''} ${l.region || ''} ${l.addedByUserName || ''}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function matchesCity(l, city) {
  if (!city) return true;
  return l.cityKey === city;
}

function matchesRegion(l, region) {
  if (!region) return true;
  return l.regionKey === region;
}

function sortLocations(list, sort) {
  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'rating':
      return list.sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount);
    case 'reviews':
      return list.sort((a, b) => b.reviewCount - a.reviewCount);
    case 'newest':
    default:
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}
