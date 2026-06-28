import { Award, Mail, MapPinned } from 'lucide-react';
import type { DashboardData, DomestosLocation } from '@/types';
import { fmtNum, fmtRating, locationName, t, timeAgo, typeLabel } from '@/i18n';
import { BRAND_GRADIENT, Card, DomestosChip, NAVY, SectionHeader, ToiletId, TypePill } from './ui';
import { LeaderboardList, type BoardRow } from './LeaderboardList';

export function DomestosView({ data }: { data: DashboardData }) {
  const all = data.domestosLocations;
  const rated = all.filter((l) => l.rated);
  const unrated = all.filter((l) => !l.rated);
  const o = data.overview;

  const ratedRows: BoardRow[] = rated.map((l) => ({
    id: l.id,
    rank: l.rank as number,
    badge: l.badge,
    title: l.title,
    type: l.type,
    averageRating: l.averageRating,
    reviewCount: l.reviewCount,
    score: l.score as number,
    toiletId: l.id,
    email: l.addedByEmail,
  }));

  return (
    <section className="space-y-6">
      <SectionHeader
        title={t.domestosTitle}
        desc={t.domestosDesc}
        right={
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            <Award className="h-3.5 w-3.5" />
            {fmtNum(o.domestosCount)}
          </span>
        }
      />

      {all.length === 0 ? (
        <EmptyDomestos />
      ) : (
        <>
          <MiniStats
            items={[
              { label: t.domestosLocations, value: fmtNum(o.domestosCount) },
              { label: t.rated, value: fmtNum(o.domestosRatedCount) },
              { label: t.reviews, value: fmtNum(o.domestosTotalReviews) },
              {
                label: t.domestosAvgLabel,
                value: o.domestosRatedCount > 0 ? `${fmtRating(o.domestosAvg)}★` : '—',
              },
            ]}
          />

          <div className="space-y-3">
            <SubHeader title={t.domestosBoardTitle} desc={t.domestosBoardDesc} />
            <LeaderboardList rows={ratedRows} emptyMessage={t.noDomestosRated} />
          </div>

          {unrated.length > 0 && (
            <div className="space-y-3">
              <SubHeader title={t.awaitingTitle} desc={t.awaitingDesc} count={unrated.length} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unrated.map((l) => (
                  <LocationCard key={l.id} loc={l} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MiniStats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <Card className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
      {items.map((it) => (
        <div key={it.label} className="px-4 py-3">
          <div className="text-xl font-black tracking-tight text-slate-900">{it.value}</div>
          <div className="text-[11px] font-medium text-slate-500">{it.label}</div>
        </div>
      ))}
    </Card>
  );
}

function SubHeader({ title, desc, count }: { title: string; desc: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
        {title}
      </h3>
      {typeof count === 'number' && (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
          {count}
        </span>
      )}
      <span className="truncate text-[11.5px] text-slate-400">· {desc}</span>
    </div>
  );
}

function LocationCard({ loc }: { loc: DomestosLocation }) {
  return (
    <Card className="p-3.5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-800">
            {locationName(loc.title, loc.type)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TypePill type={loc.type} label={typeLabel(loc.type)} />
            <DomestosChip />
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          {t.awaitingReviewBadge}
        </span>
      </div>
      <div className="mt-3 space-y-1 border-t border-slate-50 pt-2.5 text-[11px] text-slate-400">
        <div>
          {t.addedLabel} {timeAgo(loc.createdAt)} · {t.addedBy} {loc.addedByUserName || t.anonymous}
        </div>
        {loc.addedByEmail && (
          <div className="flex items-center gap-1 truncate" title={loc.addedByEmail}>
            <Mail className="h-3 w-3 shrink-0" />
            {loc.addedByEmail}
          </div>
        )}
        <ToiletId id={loc.id} className="max-w-full" />
      </div>
    </Card>
  );
}

function EmptyDomestos() {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <MapPinned className="h-6 w-6" />
      </span>
      <h3 className="text-[15px] font-bold text-slate-800">{t.noDomestosTitle}</h3>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-slate-500">{t.noDomestosDesc}</p>
    </Card>
  );
}
