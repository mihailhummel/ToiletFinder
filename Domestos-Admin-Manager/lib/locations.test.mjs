/**
 * Tiny assertion suite for the locations index + city grouping.
 * Run: `npm run test:locations`. No framework — just node:assert, like ranking.test.mjs.
 */
import assert from 'node:assert/strict';
import { BG_REGIONS, FOREIGN_KEY, buildLocationsResult, UNKNOWN_KEY } from './locations.mjs';

const rows = [
  row({ id: 'a', city: 'София', region: 'София-град', title: 'Мол', created_at: '2026-03-01' }),
  row({ id: 'b', city: 'София', region: 'София-град', is_domestos: true, created_at: '2026-03-05' }),
  row({ id: 'c', city: 'София', region: 'София-град', source: 'osm', created_at: '2026-02-01' }),
  row({ id: 'd', city: 'Пловдив', region: 'Пловдив', created_at: '2026-04-01' }),
  // Same village name, different oblast — must NOT be merged into one bucket.
  row({ id: 'e', city: 'Победа', region: 'Пловдив', created_at: '2026-01-01' }),
  row({ id: 'f', city: 'Победа', region: 'Добрич', created_at: '2026-01-02' }),
  // Not yet reverse-geocoded.
  row({ id: 'g', city: null, region: null, created_at: '2026-05-01', city_resolved_at: null }),
  // Bulgaria's bounding box overlaps its neighbours, so the OSM import brought in
  // genuine foreign toilets. They must NOT land in a Bulgarian oblast.
  row({ id: 'h', city: 'Пирот', region: 'Централна Србија', created_at: '2026-02-10' }),
  row({ id: 'i', city: 'Люлебургас', region: 'Лозенград', created_at: '2026-02-11' }),
];

function row(overrides) {
  return {
    id: 'x',
    title: null,
    type: 'public',
    source: 'user',
    is_domestos: false,
    city: null,
    region: null,
    added_by_user_name: null,
    average_rating: 0,
    review_count: 0,
    created_at: '2026-01-01',
    city_resolved_at: '2026-09-01',
    coordinates: { lat: 42.7, lng: 23.3 },
    ...overrides,
  };
}

// ─── City grouping ────────────────────────────────────────────────────────────
const all = buildLocationsResult(rows);
assert.equal(all.total, 9);
assert.equal(all.filtered, 9);
assert.equal(all.unresolvedCount, 1, 'the city-less row must be counted as unresolved');

const byKey = new Map(all.cities.map((c) => [c.key, c]));
assert.equal(byKey.get('София|София-град').total, 3);
assert.equal(byKey.get('София|София-град').userAdded, 2);
assert.equal(byKey.get('София|София-град').osm, 1);
assert.equal(byKey.get('София|София-град').domestos, 1);

// Same-named villages stay separate.
assert.equal(byKey.get('Победа|Пловдив').total, 1);
assert.equal(byKey.get('Победа|Добрич').total, 1);

// Every location lands in exactly one bucket — the counts must add up.
assert.equal(
  all.cities.reduce((sum, c) => sum + c.total, 0),
  all.total,
  'city counts must sum to the total'
);

// ─── Region grouping ──────────────────────────────────────────────────────────
assert.equal(BG_REGIONS.length, 28, 'Bulgaria has 28 oblasti');
assert.equal(all.regions.length, 28, 'the grid always shows all 28, zeroes included');
assert.equal(new Set(all.regions.map((r) => r.key)).size, 28, 'no duplicate oblasti');

const byRegion = new Map(all.regions.map((r) => [r.key, r]));
assert.equal(byRegion.get('София-град').total, 3);
assert.equal(byRegion.get('София-град').domestos, 1);
assert.equal(byRegion.get('Пловдив').total, 2, 'Пловдив city + the village in that oblast');
assert.equal(byRegion.get('Добрич').total, 1);
// An oblast with nothing in it is still present, at zero — that IS the answer.
assert.equal(byRegion.get('Кърджали').total, 0);
assert.equal(all.regions[0].key, 'София-град', 'busiest oblast first');

// Foreign provinces never leak into a Bulgarian oblast.
assert.ok(!byRegion.has('Централна Србија'));
assert.ok(!byRegion.has('Лозенград'));
assert.equal(all.foreignCount, 2, 'the Serbian and Turkish rows are counted separately');

// The 28 + foreign + no-region must account for every location, exactly.
assert.equal(
  all.regions.reduce((sum, r) => sum + r.total, 0) + all.foreignCount + all.noRegionCount,
  all.total,
  'region counts + foreign + no-region must sum to the total'
);

// unresolvedCount tracks a DIFFERENT axis: has the geocode run at all. A row that
// ran and found no settlement is resolved, and must not nag for a re-run.
const geocoded = [
  row({ id: 'n1', city: null, region: 'Ловеч', city_resolved_at: '2026-09-01' }),
  row({ id: 'n2', city: null, region: null, city_resolved_at: null }),
];
const gc = buildLocationsResult(geocoded);
assert.equal(gc.unresolvedCount, 1, 'only the never-geocoded row counts as unresolved');
assert.equal(
  new Map(gc.regions.map((r) => [r.key, r])).get('Ловеч').total,
  1,
  'a row with a region but no settlement still belongs to its oblast'
);

// Filtering by an oblast.
const plovdiv = buildLocationsResult(rows, { region: 'Пловдив' });
assert.equal(plovdiv.filtered, 2);
assert.deepEqual(plovdiv.items.map((l) => l.id).sort(), ['d', 'e']);
// The tile grid keeps every oblast so you can switch straight to another one.
assert.equal(plovdiv.regions.length, 28);
assert.equal(new Map(plovdiv.regions.map((r) => [r.key, r])).get('София-град').total, 3);
// …but the city dropdown narrows to the chosen oblast.
// Set comparison: which cities, not what order (that's the index's own concern).
assert.deepEqual(
  new Set(plovdiv.cities.map((c) => c.city)),
  new Set(['Пловдив', 'Победа'])
);

// Filtering to the foreign bucket, which is how they get reviewed.
const foreign = buildLocationsResult(rows, { region: FOREIGN_KEY });
assert.equal(foreign.filtered, 2);
assert.deepEqual(foreign.items.map((l) => l.id).sort(), ['h', 'i']);

// Unresolved rows are reachable the same way.
assert.equal(buildLocationsResult(rows, { region: UNKNOWN_KEY }).filtered, 1);

// Unresolved rows get their own bucket, sorted last.
assert.equal(all.cities[all.cities.length - 1].key, UNKNOWN_KEY);
assert.equal(byKey.get(UNKNOWN_KEY).total, 1);

// Busiest city first.
assert.equal(all.cities[0].key, 'София|София-град');

// ─── Filtering ────────────────────────────────────────────────────────────────
const sofia = buildLocationsResult(rows, { city: 'София|София-град' });
assert.equal(sofia.filtered, 3);
assert.deepEqual(sofia.items.map((l) => l.id).sort(), ['a', 'b', 'c']);
// The city list must still show every city, or the dropdown would collapse to one.
assert.equal(sofia.cities.length, all.cities.length);
// …and `total` stays the whole-table denominator.
assert.equal(sofia.total, 9);

const domestos = buildLocationsResult(rows, { domestos: true });
assert.equal(domestos.filtered, 1);
assert.equal(domestos.items[0].id, 'b');

const userAdded = buildLocationsResult(rows, { source: 'user' });
assert.equal(userAdded.filtered, 8, 'one row is from OSM');
// Non-city filters must also narrow the city counts.
assert.equal(new Map(userAdded.cities.map((c) => [c.key, c])).get('София|София-град').total, 2);

const searched = buildLocationsResult(rows, { q: 'мол' });
assert.equal(searched.filtered, 1, 'free text search is case-insensitive over the title');
assert.equal(searched.items[0].id, 'a');

assert.equal(
  buildLocationsResult(rows, { q: 'Пловдив' }).filtered,
  2,
  'search covers the city AND the oblast (Пловдив city + the village in Пловдив oblast)'
);

// ─── Sorting + paging ─────────────────────────────────────────────────────────
assert.equal(buildLocationsResult(rows, { sort: 'newest' }).items[0].id, 'g');
assert.equal(buildLocationsResult(rows, { sort: 'oldest' }).items[0].id, 'e');

// Most-reviewed first, whatever the dates say.
const reviewed = [
  row({ id: 'r1', city: 'Русе', region: 'Русе', review_count: 3, created_at: '2026-01-01' }),
  row({ id: 'r2', city: 'Русе', region: 'Русе', review_count: 41, created_at: '2026-01-02' }),
  row({ id: 'r3', city: 'Русе', region: 'Русе', review_count: 12, created_at: '2026-01-03' }),
];
assert.deepEqual(
  buildLocationsResult(reviewed, { sort: 'reviews' }).items.map((l) => l.id),
  ['r2', 'r3', 'r1'],
  'sort=reviews orders by review count, descending'
);
// Sorting must not change WHICH rows match, only their order.
assert.equal(buildLocationsResult(reviewed, { sort: 'reviews' }).filtered, 3);

// Rating sorts by score, using review count only to break ties.
const rated = [
  row({ id: 'q1', average_rating: 4.2, review_count: 90 }),
  row({ id: 'q2', average_rating: 4.9, review_count: 2 }),
];
assert.deepEqual(
  buildLocationsResult(rated, { sort: 'rating' }).items.map((l) => l.id),
  ['q2', 'q1']
);

const paged = buildLocationsResult(rows, { limit: 2, offset: 2 });
assert.equal(paged.items.length, 2);
assert.equal(paged.filtered, 9, 'filtered is the match count, not the page size');

console.log('✅ locations tests passed');
