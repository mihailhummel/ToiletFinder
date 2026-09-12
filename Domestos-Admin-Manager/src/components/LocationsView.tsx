import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Download, Globe2, Loader2, MapPinned, Search, Star } from 'lucide-react';
import { ApiError, fetchLocations } from '@/lib/api';
import {
  FOREIGN_REGION_KEY,
  UNKNOWN_CITY_KEY,
  type CityCount,
  type LocationRow,
  type LocationsData,
  type RegionCount,
} from '@/types';
import { fmtDate, fmtNum, fmtRating, locationName, t, typeLabel } from '@/i18n';
import { Card, DomestosChip, NAVY, SectionHeader, TypePill } from './ui';

/**
 * Every location in the platform, filterable by the settlement it sits in.
 *
 * Answers "how many locations do we have in X" — the per-city counts come from the
 * server over the WHOLE table (not just the page on screen), so the numbers are the
 * real ones however the list below is paged.
 *
 * Locations whose city isn't resolved yet land in a single "unknown" bucket rather
 * than silently disappearing, so the city counts always add up to the total.
 */

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

type Sort = 'newest' | 'oldest' | 'reviews' | 'rating';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: t.sortNewest },
  { value: 'oldest', label: t.sortOldest },
  { value: 'reviews', label: t.sortReviews },
  { value: 'rating', label: t.sortRating },
];

export function LocationsView({ reloadToken = 0 }: { reloadToken?: number }) {
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyDomestos, setOnlyDomestos] = useState(false);
  const [onlyUserAdded, setOnlyUserAdded] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [data, setData] = useState<LocationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Keep the last good payload on screen while a new one loads, so changing a
  // filter doesn't blank the table and jump the page around.
  const lastGood = useRef<LocationsData | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change restarts paging — otherwise "show more" would carry a page
  // offset from a different result set.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [region, city, sort, debouncedSearch, onlyDomestos, onlyUserAdded]);

  // A city belongs to exactly one oblast, so a city picked under the previous
  // region would filter everything away. Clear it whenever the region changes.
  useEffect(() => {
    setCity('');
  }, [region]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchLocations(
      {
        region: region || undefined,
        city: city || undefined,
        sort,
        q: debouncedSearch || undefined,
        domestos: onlyDomestos || undefined,
        source: onlyUserAdded ? 'user' : undefined,
        limit,
      },
      controller.signal
    )
      .then((result) => {
        const normalised = normalise(result);
        lastGood.current = normalised;
        setData(normalised);
        setError('');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError || err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [region, city, sort, debouncedSearch, onlyDomestos, onlyUserAdded, limit, reloadToken]);

  const view = data ?? lastGood.current;

  const exportCsv = useCallback(() => {
    if (!view) return;
    const rows = view.cities.map((c) => [
      cityLabel(c),
      c.region || '',
      String(c.total),
      String(c.userAdded),
      String(c.osm),
      String(c.domestos),
    ]);
    const regionRows = (view.regions ?? []).map((r) => [
      `ОБЛАСТ: ${r.name}`,
      r.name,
      String(r.total),
      String(r.userAdded),
      String(r.osm),
      String(r.domestos),
    ]);
    const csv = [
      ['Населено място', 'Област', 'Общо', 'От потребители', 'От OSM', 'Domestos'],
      ...regionRows,
      ...rows,
    ]
      .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    // BOM so Excel opens the Cyrillic correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toaletna-locations-by-city.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [view]);

  const toggleRegion = useCallback(
    (key: string) => setRegion((prev) => (prev === key ? '' : key)),
    []
  );

  if (!view) {
    return (
      <Card className="flex items-center justify-center px-6 py-16">
        {error ? (
          <span className="text-[13px] text-red-600">{error}</span>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        )}
      </Card>
    );
  }

  const namedCities = view.cities.filter((c) => c.key !== UNKNOWN_CITY_KEY).length;
  const hasMore = view.items.length < view.filtered;

  return (
    <section className="space-y-5">
      <SectionHeader
        title={t.locationsTitle}
        desc={t.locationsDesc}
        right={
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            {t.locationsExportCsv}
          </button>
        }
      />

      <Card className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0">
        <Stat label={t.locationsTotal} value={fmtNum(view.total)} />
        <Stat label={t.locationsCities} value={fmtNum(namedCities)} />
        <Stat label={t.locationsShowing} value={fmtNum(view.filtered)} />
      </Card>

      {view.unresolvedCount > 0 && (
        <Card className="flex items-start gap-2.5 border-amber-200/70 bg-amber-50/60 px-4 py-3">
          <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-[12px] leading-relaxed text-amber-800">
            <span className="font-bold">
              {fmtNum(view.unresolvedCount)} {t.locationsUnknownCity.toLowerCase()}
            </span>{' '}
            — {t.locationsUnknownHint}
          </p>
        </Card>
      )}

      {view.foreignCount > 0 && (
        <Card className="flex flex-wrap items-start gap-2.5 border-amber-200/70 bg-amber-50/60 px-4 py-3">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="min-w-[16rem] flex-1 text-[12px] leading-relaxed text-amber-800">
            <span className="font-bold">
              {fmtNum(view.foreignCount)} {t.locationsForeignTitle.toLowerCase()}
            </span>{' '}
            — {t.locationsForeignHint}
          </p>
          <button
            onClick={() => toggleRegion(FOREIGN_REGION_KEY)}
            aria-pressed={region === FOREIGN_REGION_KEY}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition ${
              region === FOREIGN_REGION_KEY
                ? 'bg-amber-600 text-white'
                : 'border border-amber-300 bg-white text-amber-700 hover:bg-amber-100'
            }`}
          >
            {t.locationsShowForeign}
          </button>
        </Card>
      )}

      <div className="space-y-2.5">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
            {t.locationsRegions}
          </h3>
          <span className="truncate text-[11.5px] text-slate-400">· {t.locationsRegionsDesc}</span>
        </div>
        {view.regions.length === 0 ? (
          // Only reachable when the API predates the region grid — see normalise().
          <Card className="px-4 py-3 text-[12px] text-slate-500">{t.locationsRegionsStale}</Card>
        ) : (
          /* Four per row on desktop, stepping down on narrower screens. */
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {view.regions.map((r) => (
              <RegionTile
                key={r.key}
                region={r}
                active={region === r.key}
                onClick={() => toggleRegion(r.key)}
              />
            ))}
          </div>
        )}
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.locationsSearchPlaceholder}
            aria-label={t.locationsSearchPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-[13px] text-slate-800 outline-none transition focus:border-slate-400"
          />
        </div>

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label={t.locationsFilterCity}
          className="max-w-[240px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 outline-none transition focus:border-slate-400"
        >
          <option value="">
            {t.locationsAllCities} ({fmtNum(view.total)})
          </option>
          {view.cities.map((c) => (
            <option key={c.key} value={c.key}>
              {cityLabel(c)} ({c.total})
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label={t.locationsSortBy}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 outline-none transition focus:border-slate-400"
        >
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {t.locationsSortBy}: {o.label}
            </option>
          ))}
        </select>

        <Toggle active={onlyDomestos} onClick={() => setOnlyDomestos((v) => !v)}>
          {t.locationsOnlyDomestos}
        </Toggle>
        <Toggle active={onlyUserAdded} onClick={() => setOnlyUserAdded((v) => !v)}>
          {t.locationsOnlyUserAdded}
        </Toggle>

        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
      </Card>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {view.items.length === 0 ? (
        <Card className="px-6 py-10 text-center text-[13px] text-slate-400">{t.locationsEmpty}</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:flex">
            <span className="flex-1">{t.colLocation}</span>
            <span className="w-40">{t.locationsColCity}</span>
            <span className="w-24 text-right">{t.locationsColReviews}</span>
            <span className="w-24 text-right">{t.locationsColAdded}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {view.items.map((loc) => (
              <LocationRowItem key={loc.id} loc={loc} />
            ))}
          </ul>
        </Card>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {t.locationsLoadMore} ({fmtNum(view.filtered - view.items.length)})
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Fill in anything the response didn't carry.
 *
 * The server runs `lib/locations.mjs` in-process, so a Node process started before
 * a deploy keeps serving the OLD payload shape while browsers already have the NEW
 * bundle. Without this, `regions.map(...)` on an undefined field throws during
 * render and takes the whole dashboard down — a blank page for a version skew that
 * a restart fixes. Degrade instead: hide the region grid, keep the rest working.
 */
function normalise(d: LocationsData): LocationsData {
  return {
    ...d,
    items: d.items ?? [],
    cities: d.cities ?? [],
    regions: d.regions ?? [],
    total: d.total ?? 0,
    filtered: d.filtered ?? 0,
    unresolvedCount: d.unresolvedCount ?? 0,
    foreignCount: d.foreignCount ?? 0,
    noRegionCount: d.noRegionCount ?? 0,
  };
}

/** "София" / "Победа, обл. Пловдив" / the unknown bucket's label. */
function cityLabel(c: CityCount): string {
  if (c.key === UNKNOWN_CITY_KEY || !c.city) return t.locationsUnknownCity;
  return c.region ? `${c.city}, обл. ${c.region}` : c.city;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xl font-black tracking-tight text-slate-900">{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

/** One oblast. Rendered for all 28, so a zero count is a real, visible answer. */
function RegionTile({
  region,
  active,
  onClick,
}: {
  region: RegionCount;
  active: boolean;
  onClick: () => void;
}) {
  const empty = region.total === 0;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
          : empty
            ? 'border-dashed border-slate-200 bg-slate-50/60 text-slate-400'
            : 'border-slate-200/70 bg-white text-slate-800 shadow-sm hover:border-slate-300'
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Building2
          className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white/70' : 'text-slate-400'}`}
        />
        <span className="truncate text-[13px] font-bold">{region.name}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-black leading-none">{fmtNum(region.total)}</span>
        {region.domestos > 0 && (
          <span className={`text-[9.5px] font-semibold ${active ? 'text-white/60' : 'text-slate-400'}`}>
            {region.domestos} Domestos
          </span>
        )}
      </span>
    </button>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function LocationRowItem({ loc }: { loc: LocationRow }) {
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-slate-800">
            {locationName(loc.title, loc.type)}
          </span>
          {loc.isDomestos && <DomestosChip />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <TypePill type={loc.type} label={typeLabel(loc.type)} />
          <span className="text-[10.5px] text-slate-400">
            {loc.source === 'osm' ? t.locationsSourceOsm : t.locationsSourceUser}
            {loc.addedByUserName ? ` · ${loc.addedByUserName}` : ''}
          </span>
        </div>
      </div>

      <div className="w-40 shrink-0 text-[12px]">
        {loc.city ? (
          <>
            <span className="block truncate font-medium text-slate-700">{loc.city}</span>
            {loc.region && <span className="block truncate text-[10.5px] text-slate-400">обл. {loc.region}</span>}
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>

      <div className="w-24 shrink-0 text-[12px] sm:text-right">
        {loc.reviewCount > 0 ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-700">{fmtRating(loc.averageRating)}</span>
            <span className="text-slate-300">·</span>
            <span className="font-bold text-slate-600">{fmtNum(loc.reviewCount)}</span>
          </span>
        ) : (
          <span className="text-[10.5px] text-slate-300">{t.locationsNoRating}</span>
        )}
      </div>

      <div className="w-24 shrink-0 text-[11.5px] text-slate-400 sm:text-right">
        {fmtDate(loc.createdAt)}
      </div>
    </li>
  );
}
