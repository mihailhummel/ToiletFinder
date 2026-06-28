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

export interface Viewer {
  uid: string;
  email: string | null;
  name: string;
  role: 'admin' | 'domestos';
}
