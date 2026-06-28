import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import type { DashboardData, RecentLocation, RecentReview } from '@/types';
import { locationName, t, timeAgo, typeLabel } from '@/i18n';
import { Card, DomestosChip, GroupDivider, NAVY, SectionHeader, Stars, ToiletId, TypePill } from './ui';

export function ActivityView({ data }: { data: DashboardData }) {
  const { reviews, locations } = data.recent;
  const revDuring = reviews.filter((r) => r.inWindow);
  const revBefore = reviews.filter((r) => !r.inWindow);
  const locDuring = locations.filter((l) => l.inWindow);
  const locBefore = locations.filter((l) => !l.inWindow);

  return (
    <section className="space-y-5">
      <SectionHeader title={t.activityTitle} desc={t.activityDesc} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t.recentReviews}>
          {reviews.length === 0 ? (
            <Empty>{t.noRecentReviews}</Empty>
          ) : (
            <div className="pb-2">
              {revDuring.length > 0 && <GroupDivider label={t.groupDuring} />}
              {revDuring.map((r) => (
                <ReviewLine key={r.id} review={r} />
              ))}
              {revBefore.length > 0 && <GroupDivider label={t.groupBefore} />}
              {revBefore.map((r) => (
                <ReviewLine key={r.id} review={r} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t.recentLocations}>
          {locations.length === 0 ? (
            <Empty>{t.noRecentLocations}</Empty>
          ) : (
            <div className="pb-2">
              {locDuring.length > 0 && <GroupDivider label={t.groupDuring} />}
              {locDuring.map((l) => (
                <LocationLine key={l.id} loc={l} />
              ))}
              {locBefore.length > 0 && <GroupDivider label={t.groupBefore} />}
              {locBefore.map((l) => (
                <LocationLine key={l.id} loc={l} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

function ReviewLine({ review: r }: { review: RecentReview }) {
  return (
    <div className="flex gap-3 px-4 py-2">
      <span className="pt-0.5">
        <Stars value={r.rating} className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-slate-800">
          {locationName(r.title, r.type)}
        </div>
        {r.text && (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500">{r.text}</p>
        )}
        <div className="mt-0.5 text-[11px] text-slate-400">
          {r.userName} · {timeAgo(r.createdAt)}
        </div>
        <ToiletId id={r.toiletId} className="max-w-full" />
      </div>
    </div>
  );
}

function LocationLine({ loc: l }: { loc: RecentLocation }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <MapPin className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-slate-800">
            {locationName(l.title, l.type)}
          </span>
          {l.isDomestos && <DomestosChip />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
          <TypePill type={l.type} label={typeLabel(l.type)} />
          <span>
            · {t.addedBy} {l.addedByUserName || t.anonymous} · {timeAgo(l.createdAt)}
          </span>
        </div>
        <ToiletId id={l.id} className="max-w-full" />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <h3
        className="border-b border-slate-100 px-4 py-3 text-[13px] font-bold uppercase tracking-wide"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] text-slate-400">{children}</p>;
}
