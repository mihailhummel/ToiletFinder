import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { MIN_PLACE_QUERY, usePlaceSearch } from '@/hooks/usePlaceSearch';
import { PlaceIcon } from '@/components/PlaceIcon';
import type { PlaceResult } from '@/hooks/usePlaceSearch';
import type { Toilet } from '@/types/toilet';
import type { MapControls } from '@/components/Map';

/**
 * Desktop header search: Bulgarian towns, villages and other named places.
 *
 * For admins it ALSO searches the toilet cache by ID or title (`includeToilets`),
 * which is how a specific pin gets found from a support report. Regular users must
 * not get that: a toilet ID is an internal handle, and letting anyone enumerate
 * pins by ID is not something the map needs.
 */

const MAX_TOILET_MATCHES = 4;

type Suggestion =
  | { kind: 'toilet'; key: string; toilet: Toilet }
  | { kind: 'place'; key: string; place: PlaceResult };

export function HeaderSearchBar({
  controls,
  includeToilets = false,
}: {
  controls: MapControls | null;
  includeToilets?: boolean;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const { places, loading, error } = usePlaceSearch(query);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toilet matches come straight from the cache the map already holds — no
  // network round trip, so they appear the instant a character is typed.
  const toiletMatches = useMemo<Toilet[]>(() => {
    if (!includeToilets) return [];
    const q = query.trim().toLowerCase();
    if (q.length < MIN_PLACE_QUERY) return [];
    const all = queryClient.getQueryData<Toilet[]>(['all-toilets']) || [];
    const matches: Toilet[] = [];
    for (const toilet of all) {
      const id = toilet.id.toLowerCase();
      const title = (toilet.title || '').toLowerCase();
      if (id === q || id.includes(q) || (title.length > 0 && title.includes(q))) {
        matches.push(toilet);
        if (matches.length >= MAX_TOILET_MATCHES) break;
      }
    }
    return matches;
  }, [includeToilets, query, queryClient]);

  const suggestions = useMemo<Suggestion[]>(
    () => [
      ...toiletMatches.map((toilet) => ({ kind: 'toilet' as const, key: `t:${toilet.id}`, toilet })),
      ...places.map((place) => ({ kind: 'place' as const, key: `p:${place.id}`, place })),
    ],
    [toiletMatches, places]
  );

  // Keep the highlighted row in range as results come and go.
  useEffect(() => setHighlight(0), [suggestions.length]);

  // Close on an outside click — the dropdown floats over the map.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const select = useCallback(
    (suggestion: Suggestion) => {
      if (!controls) return;

      if (suggestion.kind === 'toilet') {
        controls.flyToToilet(suggestion.toilet.id);
      } else {
        const p = suggestion.place;
        controls.flyToLocation({ lat: p.lat, lng: p.lng, boundingBox: p.boundingBox });
      }

      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    },
    [controls]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!suggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(suggestions[highlight] ?? suggestions[0]);
    }
  };

  const showDropdown = open && query.trim().length >= MIN_PLACE_QUERY;
  const nothingFound = showDropdown && !loading && suggestions.length === 0 && !error;

  return (
    <div ref={containerRef} className="relative mx-4 hidden flex-1 max-w-md lg:block">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (suggestions.length) select(suggestions[highlight] ?? suggestions[0]);
        }}
      >
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={includeToilets ? t('admin.searchPlaceholder') : t('search.placeholder')}
            aria-label={includeToilets ? t('admin.searchPlaceholder') : t('search.placeholder')}
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            className="h-9 border-gray-300 pl-10 pr-9 text-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label={t('search.clear')}
                className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {error && <div className="px-3 py-2.5 text-xs text-red-600">{error}</div>}
          {nothingFound && (
            <div className="px-3 py-2.5 text-xs text-gray-500">{t('search.noResults')}</div>
          )}

          <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
            {toiletMatches.length > 0 && <GroupLabel>{t('search.groupToilets')}</GroupLabel>}
            {suggestions.map((s, i) => {
              if (s.kind === 'toilet') {
                return (
                  <Row
                    key={s.key}
                    active={i === highlight}
                    onSelect={() => select(s)}
                    onHover={() => setHighlight(i)}
                    icon={<MapPin className="h-4 w-4 text-blue-500" />}
                    title={s.toilet.title || t('search.untitledToilet')}
                    subtitle={s.toilet.id}
                    subtitleClassName="font-mono"
                  />
                );
              }
              return (
                <div key={s.key}>
                  {/* First place row carries the group heading. */}
                  {i === toiletMatches.length && toiletMatches.length > 0 && (
                    <GroupLabel>{t('search.groupPlaces')}</GroupLabel>
                  )}
                  <Row
                    active={i === highlight}
                    onSelect={() => select(s)}
                    onHover={() => setHighlight(i)}
                    icon={<PlaceIcon place={s.place} className="h-4 w-4 text-slate-500" />}
                    title={s.place.name}
                    subtitle={s.place.label}
                  />
                </div>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <li
      aria-hidden
      className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
    >
      {children}
    </li>
  );
}

function Row({
  active,
  onSelect,
  onHover,
  icon,
  title,
  subtitle,
  subtitleClassName = '',
}: {
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  subtitleClassName?: string;
}) {
  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      // mousedown, not click: the input's blur would otherwise close the
      // dropdown before the click landed.
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 ${active ? 'bg-blue-50' : ''}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
        <span className={`block truncate text-[11px] text-gray-500 ${subtitleClassName}`}>
          {subtitle}
        </span>
      </span>
    </li>
  );
}
