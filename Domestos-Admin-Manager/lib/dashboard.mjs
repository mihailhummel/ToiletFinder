/**
 * Assembles the entire campaign dashboard payload from Supabase in one shot, with
 * a short in-memory cache so repeated views don't hammer the DB (mirrors the main
 * app's getCachedToilets pattern). All reads use the service-key client; user
 * emails are resolved via the Firebase Admin SDK.
 *
 * Returns: { generatedAt, campaign, overview, ranking, domestosLocations, users, recent }
 */
import { supabase } from './supabase.mjs';
import { auth } from './firebase-admin.mjs';
import { rankLocations, setPrior, DEFAULT_M } from './ranking.mjs';

const RANKING_M = Number(process.env.RANKING_M) || DEFAULT_M;
const CAMPAIGN_START = process.env.CAMPAIGN_START || '2026-06-29';
const CAMPAIGN_END = process.env.CAMPAIGN_END || '2026-08-30';
const USERS_LIMIT = 50; // top slice returned for the most-active-users board
const RECENT_LIMIT = 20; // recent activity feed length (per column)
const CACHE_TTL_MS = 60 * 1000;

let cache = null;

export async function buildDashboard() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;
  const data = await compute();
  cache = { ts: Date.now(), data };
  return data;
}

async function compute() {
  const [toilets, reviews, recentReviewRows] = await Promise.all([
    fetchAllToilets(),
    fetchReviewsMinimal(),
    fetchRecentReviews(),
  ]);

  const start = new Date(`${CAMPAIGN_START}T00:00:00.000Z`).getTime();
  const end = new Date(`${CAMPAIGN_END}T23:59:59.999Z`).getTime();
  const inWindow = (iso) => {
    const ts = new Date(iso).getTime();
    return ts >= start && ts <= end;
  };

  // Last review timestamp per toilet (Bayesian tie-breaker) + window aggregates.
  const lastReviewAt = new Map();
  let reviewsWindow = 0;
  const participants = new Set();
  for (const r of reviews) {
    const ts = new Date(r.created_at).getTime();
    if (!lastReviewAt.has(r.toilet_id) || ts > lastReviewAt.get(r.toilet_id)) {
      lastReviewAt.set(r.toilet_id, ts);
    }
    if (ts >= start && ts <= end) {
      reviewsWindow++;
      if (r.user_id) participants.add(r.user_id);
    }
  }

  // Map toilets → leaderboard shape; collect window/all-time location counts.
  const metaById = new Map();
  let newLocationsWindow = 0;
  let newLocationsAllTime = 0;
  const locations = toilets.map((t) => {
    metaById.set(t.id, { title: t.title || null, type: t.type || 'other' });
    const isUserAdded = (t.source || 'user') === 'user';
    if (isUserAdded) {
      newLocationsAllTime++;
      if (inWindow(t.created_at)) {
        newLocationsWindow++;
        if (t.user_id) participants.add(t.user_id);
      }
    }
    return {
      id: t.id,
      title: t.title || null,
      type: t.type || 'other',
      source: t.source || 'user',
      userId: t.user_id || null,
      averageRating: Number(t.average_rating) || 0,
      reviewCount: Number(t.review_count) || 0,
      isDomestos: t.is_domestos === true, // undefined (pre-migration) → false
      createdAt: t.created_at,
      addedByUserName: t.added_by_user_name || null,
      lastReviewAt: lastReviewAt.get(t.id) || 0,
    };
  });

  const domestosLocs = locations.filter((l) => l.isDomestos);

  // Domestos leaderboard (rated only). rankLocations computes the set prior (C).
  const domestos = rankLocations(domestosLocs, RANKING_M);
  // Overall prior kept only as informational context (C across all rated locations).
  const overall = rankLocations(locations, RANKING_M);

  // ─── Active users: per-user added locations + reviews, split by window ──────
  const userMap = new Map();
  const ensureUser = (uid, name) => {
    let u = userMap.get(uid);
    if (!u) {
      u = { userId: uid, name: name || null, locations: [], reviews: [] };
      userMap.set(uid, u);
    } else if (!u.name && name) {
      u.name = name;
    }
    return u;
  };

  for (const l of locations) {
    if (l.source !== 'user' || !l.userId) continue; // skip OSM + anonymized
    ensureUser(l.userId, l.addedByUserName).locations.push({
      id: l.id,
      title: l.title,
      type: l.type,
      isDomestos: l.isDomestos,
      createdAt: l.createdAt,
      inWindow: inWindow(l.createdAt),
    });
  }
  for (const r of reviews) {
    if (!r.user_id) continue;
    const meta = metaById.get(r.toilet_id);
    ensureUser(r.user_id, r.user_name).reviews.push({
      toiletId: r.toilet_id,
      title: meta?.title ?? null,
      type: meta?.type ?? 'other',
      rating: r.rating,
      createdAt: r.created_at,
      inWindow: inWindow(r.created_at),
    });
  }

  const users = [...userMap.values()]
    .map((u) => {
      u.locations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      u.reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const addedWindow = u.locations.filter((l) => l.inWindow).length;
      const reviewsWindowCount = u.reviews.filter((r) => r.inWindow).length;
      return {
        userId: u.userId,
        name: u.name,
        email: null, // filled in below
        addedTotal: u.locations.length,
        addedWindow,
        reviewsTotal: u.reviews.length,
        reviewsWindow: reviewsWindowCount,
        addedDuringCampaign: addedWindow > 0,
        reviewedDuringCampaign: reviewsWindowCount > 0,
        locations: u.locations,
        reviews: u.reviews,
      };
    })
    .sort((a, b) => {
      if (b.addedTotal !== a.addedTotal) return b.addedTotal - a.addedTotal;
      if (b.reviewsTotal !== a.reviewsTotal) return b.reviewsTotal - a.reviewsTotal;
      return 0;
    })
    .slice(0, USERS_LIMIT)
    .map((u, i) => ({
      ...u,
      rank: i + 1,
      badge: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null,
    }));

  // ─── Resolve emails (admin-only) for board users + Domestos adders ─────────
  const emailUids = new Set();
  for (const u of users) emailUids.add(u.userId);
  for (const l of domestosLocs) if (l.userId) emailUids.add(l.userId);
  const emailByUid = await resolveEmails(emailUids);
  for (const u of users) u.email = emailByUid.get(u.userId) || null;

  // Full Domestos roster: EVERY flagged location (rated + not-yet-rated), with the
  // adder's email. Rated ones carry their leaderboard rank/badge/score.
  const rankById = new Map(domestos.ranked.map((r) => [r.id, r]));
  const domestosLocations = domestosLocs
    .map((l) => {
      const r = rankById.get(l.id);
      return {
        id: l.id,
        title: l.title,
        type: l.type,
        averageRating: l.averageRating,
        reviewCount: l.reviewCount,
        createdAt: l.createdAt,
        addedByUserName: l.addedByUserName,
        addedByEmail: l.userId ? emailByUid.get(l.userId) || null : null,
        rated: !!r,
        rank: r ? r.rank : null,
        badge: r ? r.badge : null,
        score: r ? r.score : null,
      };
    })
    .sort((a, b) => {
      if (a.rated && b.rated) return a.rank - b.rank;
      if (a.rated !== b.rated) return a.rated ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const domestosTotalReviews = domestosLocs.reduce((s, l) => s + l.reviewCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    campaign: {
      start: CAMPAIGN_START,
      end: CAMPAIGN_END,
      isActive: Date.now() >= start && Date.now() <= end,
    },
    overview: {
      newLocationsWindow,
      newLocationsAllTime,
      reviewsWindow,
      reviewsAllTime: reviews.length,
      activeParticipants: participants.size,
      domestosCount: domestosLocs.length,
      domestosRatedCount: domestosLocs.filter((l) => l.reviewCount > 0).length,
      domestosTotalReviews,
      domestosAvg: setPrior(domestosLocs), // review-weighted mean across Domestos locations
    },
    ranking: {
      m: RANKING_M,
      C_domestos: domestos.prior,
      C_all: overall.prior,
    },
    domestosLocations,
    users,
    recent: {
      reviews: recentReviewRows.map((r) => {
        const meta = metaById.get(r.toilet_id);
        return {
          id: r.id,
          toiletId: r.toilet_id,
          title: meta?.title ?? null,
          type: meta?.type ?? 'other',
          userName: r.user_name,
          rating: r.rating,
          text: r.text ? String(r.text).slice(0, 160) : null,
          createdAt: r.created_at,
          inWindow: inWindow(r.created_at),
        };
      }),
      locations: locations
        .filter((l) => l.source === 'user')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, RECENT_LIMIT)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          isDomestos: l.isDomestos,
          addedByUserName: l.addedByUserName,
          createdAt: l.createdAt,
          inWindow: inWindow(l.createdAt),
        })),
    },
  };
}

/** Batch-resolve Firebase emails for a set of uids. Best-effort: failures → no email. */
async function resolveEmails(uidSet) {
  const map = new Map();
  const uids = [...uidSet].filter(Boolean);
  for (let i = 0; i < uids.length; i += 100) {
    const chunk = uids.slice(i, i + 100).map((uid) => ({ uid }));
    try {
      const res = await auth.getUsers(chunk);
      for (const u of res.users) map.set(u.uid, u.email || null);
    } catch (err) {
      console.warn('[domestos-admin] email lookup failed:', err.message);
    }
  }
  return map;
}

// ─── Supabase reads (paginated like server/supabase-storage.ts) ──────────────

async function fetchAllToilets() {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  // select('*') is intentional: it stays resilient if the is_domestos column
  // hasn't been migrated yet (the field is just undefined → treated as false).
  for (;;) {
    const { data, error } = await supabase
      .from('toilets')
      .select('*')
      .eq('is_removed', false)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length) {
      all = all.concat(data);
      from += pageSize;
      if (data.length < pageSize) break;
    } else {
      break;
    }
  }
  return all;
}

async function fetchRecentReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, toilet_id, user_name, rating, text, created_at')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw error;
  return data || [];
}

async function fetchReviewsMinimal() {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, toilet_id, user_id, user_name, rating, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length) {
      all = all.concat(data);
      from += pageSize;
      if (data.length < pageSize) break;
    } else {
      break;
    }
  }
  return all;
}
