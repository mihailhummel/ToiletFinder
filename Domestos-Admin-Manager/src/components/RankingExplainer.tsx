import { useState } from 'react';
import { Calculator, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { fmtRating, t } from '@/i18n';
import type { DashboardData } from '@/types';
import { Card, NAVY } from './ui';

export function RankingExplainer({ ranking }: { ranking: DashboardData['ranking'] }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left transition hover:bg-slate-50"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Calculator className="h-4 w-4" />
          </span>
          <span className="text-[14px] font-bold tracking-tight" style={{ color: NAVY }}>
            {t.explainTitle}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          {open ? t.explainToggleOpen : t.explainToggleClosed}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 pb-5 pt-4 text-[13px] leading-relaxed text-slate-700">
          <p>
            Не подреждаме локациите само по среден брой звезди. Една-единствена <strong>5★</strong>{' '}
            оценка не е толкова надеждна, колкото среден рейтинг <strong>4,5★ от 20 различни души</strong>.
            Затова използваме <strong>претеглена оценка по метода на Бейс</strong> — същия подход, който
            IMDb прилага за класацията си „Топ 250“.
          </p>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-center text-[15px] font-bold text-slate-800">
              точки = ( v / (v + m) ) · R &nbsp;+&nbsp; ( m / (v + m) ) · C
            </div>
            <dl className="mx-auto mt-3 max-w-md space-y-1 text-[12px] text-slate-600">
              <Legend k="R">средният рейтинг на локацията (1–5)</Legend>
              <Legend k="v">броят оценки на локацията</Legend>
              <Legend k="m">
                колко оценки са нужни, преди да се доверим основно на собствения рейтинг — сега{' '}
                <strong>{ranking.m}</strong>
              </Legend>
              <Legend k="C">
                средният рейтинг за всички локации в класацията (Domestos:{' '}
                <strong>{fmtRating(ranking.C_domestos)}</strong>, общо:{' '}
                <strong>{fmtRating(ranking.C_all)}</strong>)
              </Legend>
            </dl>
          </div>

          <p>
            Накратко: колкото повече оценки събере една локация, толкова повече се доверяваме на нейния
            собствен рейтинг. Локациите с малко оценки се изтеглят към средното, за да не води някой само
            заради един късметлийски глас.
          </p>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-blue-600">
              Пример (при C = 4,0 и m = 5)
            </div>
            <ul className="space-y-1.5 text-[12.5px]">
              <li className="flex items-center justify-between gap-2">
                <span>4,5★ от 20 оценки</span>
                <span className="font-black text-slate-900">→ 4,40 точки 🥇</span>
              </li>
              <li className="flex items-center justify-between gap-2 text-slate-500">
                <span>5,0★ от 1 оценка</span>
                <span className="font-bold">→ 4,17 точки</span>
              </li>
            </ul>
            <p className="mt-2 text-[11.5px] text-slate-500">
              Така доказаната локация с 20 оценки изпреварва тази с една-единствена оценка.
            </p>
          </div>

          <p className="text-[12px] text-slate-500">
            При равен резултат предимство имат локациите с повече оценки, след това с по-висок среден
            рейтинг.
          </p>
        </div>
      )}
    </Card>
  );
}

function Legend({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-4 shrink-0 font-black text-slate-800">{k}</dt>
      <dd>— {children}</dd>
    </div>
  );
}
