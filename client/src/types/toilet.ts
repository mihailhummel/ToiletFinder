export type {
  Toilet,
  Review,
  Report,
  InsertToilet,
  InsertReview,
  InsertReport,
  ToiletType,
  ReportReason
} from "@shared/schema";

export interface MapLocation {
  lat: number;
  lng: number;
}

export interface ToiletWithReviews extends Toilet {
  reviews?: Review[];
}
