import { Award, MapPin, Star, Users, type LucideIcon } from 'lucide-react';
import { fmtNum, fmtRating, t } from '@/i18n';
import type { DashboardData } from '@/types';
import { Card } from './ui';

export function StatCards({ data }: { data: DashboardData }) {
  const o = data.overview;
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Stat
        icon={MapPin}
        iconClass="bg-blue-50 text-blue-600"
        label={t.newLocations}
        value={fmtNum(o.newLocationsWindow)}
        windowTag
        sub={`${fmtNum(o.newLocationsAllTime)} ${t.allTime}`}
      />
      <Stat
        icon={Star}
        iconClass="bg-amber-50 text-amber-600"
        label={t.reviews}
        value={fmtNum(o.reviewsWindow)}
        windowTag
        sub={`${fmtNum(o.reviewsAllTime)} ${t.allTime}`}
      />
      <Stat
        icon={Users}
        iconClass="bg-violet-50 text-violet-600"
        label={t.participants}
        value={fmtNum(o.activeParticipants)}
        windowTag
        sub={t.participantsHint}
      />
      <Stat
        icon={Award}
        iconClass="from-[#2d6bff] to-[#ff3b4e] bg-gradient-to-br text-white"
        label={t.domestosLocations}
        value={fmtNum(o.domestosCount)}
        sub={
          o.domestosRatedCount > 0
            ? `${fmtNum(o.domestosRatedCount)} ${t.rated} · ⌀ ${fmtRating(o.domestosAvg)}★`
            : `${fmtNum(o.domestosRatedCount)} ${t.rated}`
        }
      />
    </section>
  );
}

interface StatProps {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  sub: string;
  windowTag?: boolean;
}

function Stat({ icon: Icon, iconClass, label, value, sub, windowTag }: StatProps) {
  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {windowTag && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {t.inWindow}
          </span>
        )}
      </div>
      <div className="mt-3 text-[26px] font-black leading-none tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] font-semibold text-slate-600">{label}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{sub}</div>
    </Card>
  );
}
