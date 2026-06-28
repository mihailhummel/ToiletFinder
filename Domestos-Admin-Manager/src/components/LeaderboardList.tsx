import { Mail } from 'lucide-react';
import type { Badge } from '@/types';
import { fmtScore, locationName, t, typeLabel } from '@/i18n';
import { Card, Medal, RatingInline, ToiletId, TypePill } from './ui';

export interface BoardRow {
  id: string;
  rank: number;
  badge: Badge;
  title: string | null;
  type: string;
  averageRating: number;
  reviewCount: number;
  score: number;
  isWinner?: boolean;
  toiletId?: string;
  email?: string | null;
}

const TINT: Record<Exclude<Badge, null>, string> = {
  gold: 'bg-amber-50/60',
  silver: 'bg-slate-50',
  bronze: 'bg-orange-50/50',
};

export function LeaderboardList({
  rows,
  showWinner = false,
  emptyMessage,
}: {
  rows: BoardRow[];
  showWinner?: boolean;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <Card className="px-6 py-10 text-center text-[13px] leading-relaxed text-slate-400">
        {emptyMessage}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="hidden items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:flex">
        <span className="w-9 text-center">{t.colRank}</span>
        <span className="flex-1">{t.colLocation}</span>
        <span className="w-28 text-right">{t.colRating}</span>
        <span className="w-16 text-right">{t.colScore}</span>
      </div>

      <ol className="divide-y divide-slate-50">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 ${
              row.badge ? TINT[row.badge] : ''
            }`}
          >
            <Medal rank={row.rank} badge={row.badge} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-semibold text-slate-800">
                  {locationName(row.title, row.type)}
                </span>
                {showWinner && row.isWinner && <WinnerTag />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <TypePill type={row.type} label={typeLabel(row.type)} />
                {row.toiletId && <ToiletId id={row.toiletId} />}
                {row.email && (
                  <span
                    title={row.email}
                    className="inline-flex max-w-full items-center gap-1 truncate text-[10px] text-slate-400"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    {row.email}
                  </span>
                )}
              </div>
            </div>

            <div className="w-28 text-right">
              <RatingInline value={row.averageRating} count={row.reviewCount} />
            </div>

            <div className="w-16 text-right" title={t.scoreTooltip}>
              <div className="text-[15px] font-black text-slate-900">{fmtScore(row.score)}</div>
              <div className="text-[9px] font-medium uppercase tracking-wide text-slate-300">
                {t.colScore}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function WinnerTag() {
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 ring-1 ring-emerald-200">
      {t.winnerBadge}
    </span>
  );
}
