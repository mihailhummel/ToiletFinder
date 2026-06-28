/**
 * Tiny assertion suite for the ranking math. Run: `npm run test:ranking`.
 * No test framework — just node:assert, so it runs anywhere with zero setup.
 */
import assert from 'node:assert/strict';
import { bayesianScore, setPrior, rankLocations, DEFAULT_M } from './ranking.mjs';

const C = 4.0;
const m = DEFAULT_M;

// The brief's example: 4.5★/20 must outrank 5.0★/1.
const high = bayesianScore(4.5, 20, m, C);
const lucky = bayesianScore(5.0, 1, m, C);
assert.ok(high > lucky, `4.5/20 (${high}) should beat 5.0/1 (${lucky})`);
assert.ok(Math.abs(high - 4.4) < 1e-9, `expected 4.40, got ${high}`);
assert.ok(Math.abs(lucky - ((1 / 6) * 5 + (5 / 6) * 4)) < 1e-9, `expected 4.166…, got ${lucky}`);

// No reviews → score 0.
assert.equal(bayesianScore(5, 0, m, C), 0);

// Prior is the review-weighted mean; empty set → neutral 3.0.
assert.ok(Math.abs(setPrior([{ averageRating: 5, reviewCount: 1 }, { averageRating: 3, reviewCount: 3 }]) - 3.5) < 1e-9);
assert.equal(setPrior([{ averageRating: 5, reviewCount: 0 }]), 3.0);

// rankLocations: ordering, badges, and exclusion of unrated locations.
//   trusted: (25·4.6 + 5·4.0)/30   = 4.500
//   solid:   (12·4.3 + 5·4.0)/17   ≈ 4.212
//   lucky:   (1·5.0  + 5·4.0)/6    ≈ 4.167   → a single lucky 5★ ranks last
const { ranked } = rankLocations(
  [
    { id: 'lucky', averageRating: 5.0, reviewCount: 1 },
    { id: 'trusted', averageRating: 4.6, reviewCount: 25 },
    { id: 'solid', averageRating: 4.3, reviewCount: 12 },
    { id: 'unrated', averageRating: 0, reviewCount: 0 },
  ],
  m,
  C,
);
assert.equal(ranked.length, 3, 'unrated location must be excluded');
assert.deepEqual(ranked.map((r) => r.id), ['trusted', 'solid', 'lucky']);
assert.deepEqual(ranked.map((r) => r.badge), ['gold', 'silver', 'bronze']);
assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3]);

console.log('✓ ranking.test.mjs — all assertions passed');
