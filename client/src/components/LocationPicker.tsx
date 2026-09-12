import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Crosshair, Loader2, Search, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MIN_PLACE_QUERY, usePlaceSearch } from '@/hooks/usePlaceSearch';
import { PlaceIcon } from '@/components/PlaceIcon';
import { haptics } from '@/lib/haptics';
import type { PlaceResult } from '@/hooks/usePlaceSearch';
import type { MapControls } from '@/components/Map';

/**
 * The mobile "where am I looking?" control. Sits in the header exactly where the
 * static "Bulgaria" subtitle used to, and is deliberately kept to the same type
 * size so the header block doesn't grow.
 *
 * Tapping it opens a small dropdown: "use my current location" on top (selected
 * while no place has been picked), then a search field for any Bulgarian town or
 * village. Choosing a place flies the map there and the button takes its name, so
 * the header always says what you're looking at.
 *
 * This is the mobile counterpart of <HeaderSearchBar>, which occupies the header's
 * middle column on desktop where there's room for a full search field.
 */

export function LocationPicker({
  controls,
  className = '',
}: {
  controls: MapControls | null;
  className?: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // null = following the user's own location (the default).
  const [selected, setSelected] = useState<PlaceResult | null>(null);

  const { places, loading, error } = usePlaceSearch(query);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on an outside tap or Escape — it floats over the map.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Focus the field when the sheet opens, so searching is one tap not two.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const chooseCurrentLocation = useCallback(() => {
    haptics.light();
    setSelected(null);
    close();
    // Reuses the map's own locate control: it recentres when a position is known
    // and re-prompts for permission when it isn't.
    controls?.returnToUserLocation();
  }, [controls, close]);

  const choosePlace = useCallback(
    (place: PlaceResult) => {
      haptics.light();
      setSelected(place);
      close();
      controls?.flyToLocation({
        lat: place.lat,
        lng: place.lng,
        boundingBox: place.boundingBox,
      });
    },
    [controls, close]
  );

  const showResults = query.trim().length >= MIN_PLACE_QUERY;
  const nothingFound = showResults && !loading && places.length === 0 && !error;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Reads as the "Bulgaria" label it replaces: same text-xs, tight leading,
          flush under the title. `py-1 -my-1` widens the tap target by 4px top and
          bottom while netting to zero layout height, and .header-inline-btn opts
          out of the global 48px mobile touch minimum (see index.css).
          Hover is gated to real pointers so it can't stick after a tap. */}
      <button
        type="button"
        onClick={() => {
          haptics.light();
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="header-inline-btn -my-1 flex max-w-[11rem] items-center gap-0.5 py-1 text-xs leading-tight text-gray-600 transition-colors active:text-blue-600 [@media(hover:hover)]:hover:text-blue-600"
      >
        <span className="truncate">{selected ? selected.name : t('location.current')}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('location.pickerTitle')}
          /* Clamped to the viewport: the button sits ~56px in from the left edge,
             so a fixed 17rem would spill off a 320px-wide phone. */
          className="absolute left-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-4.5rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          <button
            type="button"
            onClick={chooseCurrentLocation}
            aria-pressed={!selected}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
              selected
                ? 'text-gray-700 hover:bg-gray-50'
                : 'bg-blue-50 font-semibold text-blue-700'
            }`}
          >
            <Crosshair className={`h-4 w-4 shrink-0 ${selected ? 'text-gray-400' : 'text-blue-600'}`} />
            <span className="truncate">{t('location.useCurrent')}</span>
          </button>

          <div className="border-t border-gray-100 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                aria-label={t('search.placeholder')}
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-sm text-gray-800 outline-none transition focus:border-blue-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                ) : query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    aria-label={t('search.clear')}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {showResults && (
            <div className="border-t border-gray-100">
              {error && <p className="px-3 py-2.5 text-xs text-red-600">{error}</p>}
              {nothingFound && (
                <p className="px-3 py-2.5 text-xs text-gray-500">{t('search.noResults')}</p>
              )}
              <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
                {places.map((place) => (
                  <li key={place.id} role="option" aria-selected={selected?.id === place.id}>
                    <button
                      type="button"
                      onClick={() => choosePlace(place)}
                      className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-gray-50"
                    >
                      <PlaceIcon place={place} className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {place.name}
                        </span>
                        <span className="block truncate text-[11px] text-gray-500">
                          {place.label}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
