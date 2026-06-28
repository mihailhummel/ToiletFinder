import { LogOut, RefreshCw } from 'lucide-react';
import { signOutUser } from '@/firebase';
import { fmtDate, fmtDateTime, t } from '@/i18n';
import type { DashboardData, Viewer } from '@/types';
import { BRAND_GRADIENT, NAVY } from './ui';

interface Props {
  viewer: Viewer;
  campaign: DashboardData['campaign'];
  generatedAt: string;
  onRefresh: () => void;
  refreshing: boolean;
}

export function Header({ viewer, campaign, generatedAt, onRefresh, refreshing }: Props) {
  const now = Date.now();
  const ended = now > new Date(`${campaign.end}T23:59:59`).getTime();
  const status = campaign.isActive ? t.statusActive : ended ? t.statusEnded : t.statusUpcoming;
  const statusClass = campaign.isActive
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : ended
      ? 'bg-slate-100 text-slate-500 ring-slate-200'
      : 'bg-amber-50 text-amber-700 ring-amber-200';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="h-[3px] w-full" style={{ background: BRAND_GRADIENT }} />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src="/domestos-pin.png" alt="Domestos" className="h-9 w-9 object-contain" />
          <div className="leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.appSubtitle}
            </div>
            <div className="text-[15px] font-black tracking-tight" style={{ color: NAVY }}>
              {t.appTitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${statusClass}`}>
            {status}
          </span>
          <span className="hidden text-[11px] text-slate-400 md:inline">
            {t.campaignPeriod}: {fmtDate(campaign.start)} – {fmtDate(campaign.end)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title={`${t.updated}: ${fmtDateTime(generatedAt)}`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? t.refreshing : t.refresh}</span>
          </button>

          <div className="hidden items-center gap-2 text-right md:flex">
            <div className="leading-tight">
              <div className="max-w-[12rem] truncate text-[12px] font-semibold text-slate-700">
                {viewer.name}
              </div>
              <RoleChip role={viewer.role} />
            </div>
          </div>

          <button
            onClick={() => void signOutUser()}
            title={t.signOut}
            className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-red-500"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function RoleChip({ role }: { role: Viewer['role'] }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`inline-block rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
        isAdmin ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'
      }`}
    >
      {isAdmin ? t.roleAdmin : t.roleDomestos}
    </span>
  );
}
