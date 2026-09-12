import { Building2, Home, MapPin } from 'lucide-react';
import { placeKind, type PlaceResult } from '@/hooks/usePlaceSearch';

/** Icon for a geocoded place: city, village, or anything else. */
export function PlaceIcon({ place, className = '' }: { place: PlaceResult; className?: string }) {
  switch (placeKind(place)) {
    case 'city':
      return <Building2 className={className} />;
    case 'village':
      return <Home className={className} />;
    default:
      return <MapPin className={className} />;
  }
}
