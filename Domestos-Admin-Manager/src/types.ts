// Shapes returned by the dashboard API (lib/dashboard.mjs). Kept in sync by hand.

export type Badge = 'gold' | 'silver' | 'bronze' | null;

export interface RecentReview {
  id: string;
  toiletId: string;
  title: string | null;
  type: string;
  userName: string;
  rating: number;
  text: string | null;
  createdAt: string;
  inWindow: boolean;
}

export interface RecentLocation {
  id: string;
  title: string | null;
  type: string;
  isDomestos: boolean;
  city: string | null;
  addedByUserName: string | null;
  createdAt: string;
  inWindow: boolean;
}

// Every Domestos-flagged location (rated AND not-yet-rated). Rated ones carry
// their leaderboard rank/badge/score; unrated ones have those as null.
export interface DomestosLocation {
  id: string;
  title: string | null;
  type: string;
  city: string | null;
  region: string | null;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  addedByUserName: string | null;
  addedByEmail: string | null;
  rated: boolean;
  rank: number | null;
  badge: Badge;
  score: number | null;
}

export interface UserLocationItem {
  id: string;
  title: string | null;
  type: string;
  isDomestos: boolean;
  createdAt: string;
  inWindow: boolean;
}

export interface UserReviewItem {
  toiletId: string;
  title: string | null;
  type: string;
  rating: number;
  createdAt: string;
  inWindow: boolean;
}

// A row in the "most active users" leaderboard, with the full breakdown shown
// when the row is expanded.
export interface UserRow {
  userId: string;
  name: string | null;
  email: string | null;
  rank: number;
  badge: Badge;
  addedTotal: number;
  addedWindow: number;
  reviewsTotal: number;
  reviewsWindow: number;
  addedDuringCampaign: boolean;
  reviewedDuringCampaign: boolean;
  locations: UserLocationItem[];
  reviews: UserReviewItem[];
}

export interface DashboardData {
  generatedAt: string;
  campaign: { start: string; end: string; isActive: boolean };
  overview: {
    newLocationsWindow: number;
    newLocationsAllTime: number;
    reviewsWindow: number;
    reviewsAllTime: number;
    activeParticipants: number;
    domestosCount: number;
    domestosRatedCount: number;
    domestosTotalReviews: number;
    domestosAvg: number;
  };
  ranking: { m: number; C_domestos: number; C_all: number };
  domestosLocations: DomestosLocation[];
  users: UserRow[];
  recent: { reviews: RecentReview[]; locations: RecentLocation[] };
}

// ─── Locations tab (lib/locations.mjs, GET /api/locations) ───────────────────

/** Sentinel cityKey for locations whose settlement isn't resolved yet. */
export const UNKNOWN_CITY_KEY = '__unknown__';

/**
 * Sentinel region key for locations that geocoded to a province OUTSIDE Bulgaria.
 * They exist because the OSM import selected by Bulgaria's bounding box, which
 * overlaps Serbia, Greece, Turkey and Romania — see lib/locations.mjs.
 */
export const FOREIGN_REGION_KEY = '__foreign__';

/** One of Bulgaria's 28 oblasti, with its share of the locations. */
export interface RegionCount {
  key: string;
  name: string;
  total: number;
  userAdded: number;
  osm: number;
  domestos: number;
  reviews: number;
}

export interface LocationRow {
  id: string;
  title: string | null;
  type: string;
  source: string;
  isDomestos: boolean;
  city: string | null;
  region: string | null;
  /** `city|region`, or UNKNOWN_CITY_KEY. The value the city filter sends back. */
  cityKey: string;
  addedByUserName: string | null;
  /** Resolved server-side (Firebase Admin), only for the page actually returned. */
  addedByEmail: string | null;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  lat: number | null;
  lng: number | null;
}

export interface CityCount {
  key: string;
  city: string | null;
  region: string | null;
  total: number;
  userAdded: number;
  osm: number;
  domestos: number;
}

export interface LocationsData {
  generatedAt: string;
  /** Every location, before any filter — the denominator for the counts. */
  total: number;
  /** How many matched the current filters. */
  filtered: number;
  offset: number;
  limit: number;
  items: LocationRow[];
  /** All 28 oblasti, always — including any at zero. Busiest first. */
  regions: RegionCount[];
  cities: CityCount[];
  /** Locations never geocoded — the only ones the backfill script can still fix. */
  unresolvedCount: number;
  /** Locations that geocoded outside Bulgaria (see FOREIGN_REGION_KEY). */
  foreignCount: number;
  /** Geocoded but in no administrative region; balances the region totals. */
  noRegionCount: number;
}

export interface LocationsQuery {
  city?: string;
  region?: string;
  q?: string;
  type?: string;
  source?: string;
  domestos?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface Viewer {
  uid: string;
  email: string | null;
  name: string;
  role: 'admin' | 'domestos';
}
