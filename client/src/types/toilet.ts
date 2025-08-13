export type {
  Toilet,
  Review,
  Report,
  InsertToilet,
  InsertReview,
  InsertReport,
  ToiletType,
  Accessibility,
  AccessType,
  ReportReason
} from "@shared/schema";

export interface MapLocation {
  lat: number;
  lng: number;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin?: boolean;
}

export interface ToiletWithReviews extends Toilet {
  reviews?: Review[];
}
