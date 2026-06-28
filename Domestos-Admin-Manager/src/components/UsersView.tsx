import { useMemo, useState } from 'react';
import { ChevronDown, Download, MapPin, Star, type LucideIcon } from 'lucide-react';
import type { Badge, DashboardData, UserLocationItem, UserReviewItem, UserRow } from '@/types';
import { fmtNum, locationName, t, timeAgo, typeLabel } from '@/i18n';
import {
  Card,
  CampaignBadges,
  DomestosChip,
  GroupDivider,
  Medal,
  SectionHeader,
  Stars,
  ToiletId,
} from './ui';

type Mode = 'all' | 'campaign';

export function UsersView({ data }: { data: DashboardData }) {
  const [mode, setMode] = useState<Mode>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const campaignMode = mode === 'campaign';

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // In campaign mode, keep only people who contributed during the campaign and
  // re-rank them by their campaign activity (added → reviews).
  const users = useMemo(() => {
    if (!campaignMode) return data.users;
    return data.users
      .filter((u) => u.addedDuringCampaign || u.reviewedDuringCampaign)
      .slice()
      .sort((a, b) => b.addedWindow - a.addedWindow || b.reviewsWindow - a.reviewsWindow)
      .map((u, i) => ({
        ...u,
        rank: i + 1,
        badge: (i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null) as Badge,
      }));
  }, [data.users, campaignMode]);

  function exportCsv() {
    const rows = users.map((u) => [
      u.name || '',
      u.email || '',
    ]);
    const csv = [
      ['Име', 'Имейл адрес'],
      ...rows,
    ]
      .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'domestos-campaign-participants.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title={t.usersTitle}
        desc={t.usersDesc}
        right={
          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} onChange={setMode} />
            {campaignMode && users.length > 0 && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                {t.exportCsv}
              </button>
            )}
          </div>
        }
      />

      {users.length === 0 ? (
        <Card className="px-6 py-10 text-center text-[13px] text-slate-400">
          {campaignMode ? t.noUsersCampaign : t.noUsers}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:flex">
            <span className="w-9 text-center">{t.colRank}</span>
            <span className="flex-1">{t.colUser}</span>
            <span className="w-16 text-right">{t.colAdded}</span>
            <span className="w-16 text-right">{t.colReviews}</span>
            <span className="w-5" />
          </div>
          <ol className="divide-y divide-slate-100">
            {users.map((u) => (
              <UserRowItem
                key={u.userId}
                user={u}
                campaignMode={campaignMode}
                open={open.has(u.userId)}
                onToggle={() => toggle(u.userId)}
              />
            ))}
          </ol>
        </Card>
      )}
    </section>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5 text-[12px] font-bold text-slate-500">
      {(['all', 'campaign'] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === m ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-700'
          }`}
        >
          {m === 'all' ? t.filterAll : t.filterCampaign}
        </button>
      ))}
    </div>
  );
}

function UserRowItem({
  user,
  campaignMode,
  open,
  onToggle,
}: {
  user: UserRow;
  campaignMode: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50/70 ${
          open ? 'bg-slate-50/70' : ''
        }`}
      >
        <Medal rank={user.rank} badge={user.badge} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-slate-800">{user.name || t.anonymous}</span>
            <CampaignBadges added={user.addedDuringCampaign} reviewed={user.reviewedDuringCampaign} />
          </div>
          {user.email && <div className="mt-0.5 truncate text-[11px] text-slate-400">{user.email}</div>}
        </div>

        <CountChip
          className="w-16 justify-end"
          icon={MapPin}
          total={campaignMode ? user.addedWindow : user.addedTotal}
          window={campaignMode ? 0 : user.addedWindow}
        />
        <CountChip
          className="w-16 justify-end"
          icon={Star}
          total={campaignMode ? user.reviewsWindow : user.reviewsTotal}
          window={campaignMode ? 0 : user.reviewsWindow}
        />

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && <UserDetails user={user} campaignMode={campaignMode} />}
    </li>
  );
}

function CountChip({
  icon: Icon,
  total,
  window,
  className = '',
}: {
  icon: LucideIcon;
  total: number;
  window: number;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-1 ${className}`}>
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-[13px] font-bold text-slate-800">{fmtNum(total)}</span>
      {window > 0 && <span className="text-[10px] font-semibold text-blue-500">+{fmtNum(window)}</span>}
    </span>
  );
}

function UserDetails({ user, campaignMode }: { user: UserRow; campaignMode: boolean }) {
  const locDuring = user.locations.filter((l) => l.inWindow);
  const locBefore = campaignMode ? [] : user.locations.filter((l) => !l.inWindow);
  const revDuring = user.reviews.filter((r) => r.inWindow);
  const revBefore = campaignMode ? [] : user.reviews.filter((r) => !r.inWindow);

  return (
    <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
      <DetailColumn title={t.userLocationsCol} empty={locDuring.length + locBefore.length === 0 ? t.noUserLocations : null}>
        {locDuring.length > 0 && (
          <>
            <GroupDivider label={t.groupDuring} />
            {locDuring.map((l) => (
              <LocationLine key={l.id} loc={l} />
            ))}
          </>
        )}
        {locBefore.length > 0 && (
          <>
            <GroupDivider label={t.groupBefore} />
            {locBefore.map((l) => (
              <LocationLine key={l.id} loc={l} />
            ))}
          </>
        )}
      </DetailColumn>

      <DetailColumn title={t.userReviewsCol} empty={revDuring.length + revBefore.length === 0 ? t.noUserReviews : null}>
        {revDuring.length > 0 && (
          <>
            <GroupDivider label={t.groupDuring} />
            {revDuring.map((r) => (
              <ReviewLine key={`${r.toiletId}-${r.createdAt}`} rev={r} />
            ))}
          </>
        )}
        {revBefore.length > 0 && (
          <>
            <GroupDivider label={t.groupBefore} />
            {revBefore.map((r) => (
              <ReviewLine key={`${r.toiletId}-${r.createdAt}`} rev={r} />
            ))}
          </>
        )}
      </DetailColumn>
    </div>
  );
}

function DetailColumn({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white">
      <h4 className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h4>
      {empty ? <p className="px-4 py-3 text-[12px] text-slate-400">{empty}</p> : <div className="pb-2">{children}</div>}
    </div>
  );
}

function LocationLine({ loc }: { loc: UserLocationItem }) {
  return (
    <div className="px-4 py-1.5">
      <div className="flex items-center gap-2">
        <span className="truncate text-[12.5px] font-medium text-slate-700">
          {locationName(loc.title, loc.type)}
        </span>
        {loc.isDomestos && <DomestosChip />}
      </div>
      <div className="text-[10px] text-slate-400">
        {typeLabel(loc.type)} · {timeAgo(loc.createdAt)}
      </div>
      <ToiletId id={loc.id} className="max-w-full" />
    </div>
  );
}

function ReviewLine({ rev }: { rev: UserReviewItem }) {
  return (
    <div className="px-4 py-1.5">
      <div className="flex items-center gap-2">
        <Stars value={rev.rating} className="h-3 w-3" />
        <span className="truncate text-[12.5px] font-medium text-slate-700">
          {locationName(rev.title, rev.type)}
        </span>
      </div>
      <div className="text-[10px] text-slate-400">{timeAgo(rev.createdAt)}</div>
      <ToiletId id={rev.toiletId} className="max-w-full" />
    </div>
  );
}
