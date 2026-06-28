import { ShieldX } from 'lucide-react';
import { signOutUser } from '@/firebase';
import { t } from '@/i18n';

export function AccessDenied({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <ShieldX className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">{t.deniedTitle}</h1>
        <p className="mx-auto mt-2 max-w-[18rem] text-[13px] leading-relaxed text-slate-500">
          {t.deniedBody}
        </p>
        {email && (
          <p className="mt-4 text-xs text-slate-400">
            {t.loggedInAs}: <span className="font-medium text-slate-600">{email}</span>
          </p>
        )}
        <button
          onClick={() => void signOutUser()}
          className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {t.signOut}
        </button>
      </div>
    </div>
  );
}
