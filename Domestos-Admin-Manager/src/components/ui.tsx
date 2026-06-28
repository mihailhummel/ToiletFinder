import type { ReactNode } from 'react';
import { MapPin, Star, type LucideIcon } from 'lucide-react';
import type { Badge } from '@/types';
import { fmtNum, fmtRating, t } from '@/i18n';

// Brand tokens (from the campaign modal).
export const NAVY = '#011e62';
export const BLUE = '#2d6bff';
export const RED = '#ff3b4e';
export const BRAND_GRADIENT = `linear-gradient(90deg, ${BLUE}, ${RED})`;

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** Descriptive section header: a title with a short explanatory subtitle. */
export function SectionHeader({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
      <div className="min-w-0">
        <h2 className="text-[17px] font-black tracking-tight" style={{ color: NAVY }}>
          {title}
        </h2>
        {desc && <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">{desc}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

const MEDAL_STYLES: Record<Exclude<Badge, null>, { ring: string; bg: string }> = {
  gold: { ring: 'ring-amber-200', bg: 'bg-gradient-to-br from-amber-300 to-yellow-500' },
  silver: { ring: 'ring-slate-200', bg: 'bg-gradient-to-br from-slate-300 to-slate-400' },
  bronze: { ring: 'ring-orange-200', bg: 'bg-gradient-to-br from-orange-300 to-amber-700' },
};

/** Rank chip: metallic gold/silver/bronze circle for the top 3, neutral otherwise. */
export function Medal({ rank, badge }: { rank: number; badge: Badge }) {
  if (badge) {
    const s = MEDAL_STYLES[badge];
    return (
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white shadow-sm ring-2 ${s.ring} ${s.bg}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-500">
      {rank}
    </span>
  );
}

/** Five-star visual (rounded to nearest whole star). */
export function Stars({ value, className = 'h-3.5 w-3.5' }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${i <= filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
        />
      ))}
    </span>
  );
}

/** Compact "★ 4,5 (20)" rating with review count. */
export function RatingInline({ value, count }: { value: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="text-sm font-semibold text-slate-700">{fmtRating(value)}</span>
      <span className="text-[11px] text-slate-400">({fmtNum(count)})</span>
    </span>
  );
}

export function TypePill({ type, label }: { type: string; label: string }) {
  void type;
  return (
    <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
      {label}
    </span>
  );
}

/** Small Domestos gradient chip. */
export function DomestosChip() {
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-white"
      style={{ background: BRAND_GRADIENT }}
    >
      Domestos
    </span>
  );
}

/** The raw toilet ID, monospace and muted, for cross-referencing in the DB. */
export function ToiletId({ id, className = '' }: { id: string; className?: string }) {
  return (
    <span
      title={id}
      className={`inline-block max-w-full truncate align-bottom font-mono text-[10px] text-slate-400 ${className}`}
    >
      {t.idLabel}: {id}
    </span>
  );
}

/** A hairline separator with a small label, used to split campaign vs pre-campaign items. */
export function GroupDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-1 pt-3 first:pt-1">
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

/** Stacking campaign-participation badges: added-during and/or reviewed-during. */
export function CampaignBadges({ added, reviewed }: { added: boolean; reviewed: boolean }) {
  if (!added && !reviewed) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {added && (
        <ParticipationPill
          icon={MapPin}
          className="bg-blue-50 text-blue-600 ring-blue-100"
          title={t.badgeAddedTitle}
        >
          {t.badgeAdded}
        </ParticipationPill>
      )}
      {reviewed && (
        <ParticipationPill
          icon={Star}
          className="bg-amber-50 text-amber-600 ring-amber-100"
          title={t.badgeReviewedTitle}
        >
          {t.badgeReviewed}
        </ParticipationPill>
      )}
    </span>
  );
}

function ParticipationPill({
  icon: Icon,
  className,
  title,
  children,
}: {
  icon: LucideIcon;
  className: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${className}`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}
