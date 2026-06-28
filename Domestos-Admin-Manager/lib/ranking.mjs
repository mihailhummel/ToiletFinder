/**
 * Bayesian weighted rating — the heart of the campaign leaderboard.
 *
 * We deliberately do NOT rank by raw average stars. A single 5★ review is not as
 * trustworthy as a 4.5★ average earned from 20 different people. So we pull every
 * location's average toward a shared baseline (the "prior", C) by an amount that
 * shrinks as the location collects more reviews. This is the same method IMDb uses
 * for its Top 250.
 *
 *     score = (v / (v + m)) · R  +  (m / (v + m)) · C
 *
 *   R = the location's average rating (1–5)
 *   v = the location's number of reviews
 *   m = confidence constant — roughly "how many reviews before we mostly trust R"
 *   C = the prior: the mean rating across the whole set being ranked
 *
 * Worked example (C = 4.0, m = 5):
 *   4.5★ over 20 reviews → (20/25)·4.5 + (5/25)·4.0 = 4.40
 *   5.0★ over  1 review  → (1/6)·5.0  + (5/6)·4.0  = 4.17   → ranks lower ✅
 */

export const DEFAULT_M = 5;

/** Single Bayesian weighted score. Returns 0 for locations with no reviews. */
export function bayesianScore(R, v, m, C) {
  if (!v || v <= 0) return 0;
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

/**
 * The prior C for a set of locations: the review-count-weighted mean rating,
 * i.e. Σ(R_i·v_i) / Σ(v_i) over locations that have at least one review.
 * Falls back to a neutral 3.0 when the set has no reviews yet (empty campaign),
 * which keeps the formula well-defined without skewing early rankings.
 */
export function setPrior(locations) {
  let totalStars = 0;
  let totalReviews = 0;
  for (const loc of locations) {
    const v = loc.reviewCount || 0;
    if (v > 0) {
      totalStars += (loc.averageRating || 0) * v;
      totalReviews += v;
    }
  }
  return totalReviews > 0 ? totalStars / totalReviews : 3.0;
}

/**
 * Rank a list of locations by Bayesian score (descending). Only locations with at
 * least one review are ranked. Tie-breakers, in order: more reviews → higher raw
 * average → most recent review. Assigns rank (1-based) and a gold/silver/bronze
 * badge to the top three.
 *
 * @param {Array} locations  objects with { averageRating, reviewCount, lastReviewAt? }
 * @param {number} m         confidence constant (defaults to DEFAULT_M)
 * @param {number} [C]       prior; computed via setPrior() when omitted
 * @returns {{ prior:number, ranked:Array }}
 */
export function rankLocations(locations, m = DEFAULT_M, C) {
  const prior = C ?? setPrior(locations);
  const ranked = locations
    .filter((l) => (l.reviewCount || 0) > 0)
    .map((l) => ({ ...l, score: bayesianScore(l.averageRating, l.reviewCount, m, prior) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      return (b.lastReviewAt || 0) - (a.lastReviewAt || 0);
    })
    .map((l, i) => ({
      ...l,
      rank: i + 1,
      badge: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null,
    }));
  return { prior, ranked };
}
