import { Activity, Award, Users, type LucideIcon } from 'lucide-react';
import { t } from '@/i18n';

export type Tab = 'users' | 'domestos' | 'activity';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'domestos', label: t.navDomestos, icon: Award },
  { id: 'users', label: t.navUsers, icon: Users },
  { id: 'activity', label: t.navActivity, icon: Activity },
];

export function TabNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200/70 bg-white p-1 shadow-sm">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold transition ${
              isActive
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
