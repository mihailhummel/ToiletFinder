import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Debounced Bulgarian place lookup, shared by the desktop header search bar and
 * the mobile location picker.
 *
 * Hits /api/geocode/search, which proxies Nominatim — see server/geocoding.ts for
 * why it can't be called from the browser directly. The debounce here is the first
 * line of defence for that shared, rate-limited upstream: without it every
 * keystroke would become a request.
 */

export interface PlaceResult {
  id: string;
  /** Short label: the settlement/place name. */
  name: string;
  /** Full comma-separated address, for telling same-named villages apart. */
  label: string;
  lat: number;
  lng: number;
  /** OSM class/type, e.g. "place"/"village" — drives the icon choice. */
  category: string;
  type: string;
  /** [south, west, north, east], when Nominatim supplied one. */
  boundingBox: [number, number, number, number] | null;
}

export const MIN_PLACE_QUERY = 2;
const DEBOUNCE_MS = 450; // Nominatim allows ~1 req/s; don't fire on every keystroke.

export function usePlaceSearch(query: string) {
  const { t } = useLanguage();
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_PLACE_QUERY) {
      setPlaces([]);
      setLoading(false);
      setError(null);
      return;
    }

    // An in-flight request for a stale query must never overwrite newer results.
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results?: PlaceResult[] };
        setPlaces(body.results ?? []);
        setError(null);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setPlaces([]);
        setError(t('search.placesError'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, t]);

  return { places, loading, error };
}

// OSM place types worth an explicit icon; everything else falls back to a generic
// pin rather than showing a raw English OSM tag to the user.
const CITY_TYPES = new Set(['city', 'town', 'municipality']);
const VILLAGE_TYPES = new Set(['village', 'hamlet', 'isolated_dwelling']);

export type PlaceKind = 'city' | 'village' | 'other';

export function placeKind(place: PlaceResult): PlaceKind {
  if (CITY_TYPES.has(place.type)) return 'city';
  if (VILLAGE_TYPES.has(place.type)) return 'village';
  return 'other';
}
