import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { signInWithGoogle } from '@/firebase';
import { t } from '@/i18n';

const BLUE = '#2d6bff';
const RED = '#ff3b4e';

export function SignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      // onAuthStateChanged in App takes over from here.
    } catch (e) {
      setError(e instanceof Error ? e.message : t.signInError);
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, rgba(45,107,255,0.10), #f8fafc 55%, rgba(255,59,78,0.08))' }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
        <div className="mb-5 flex items-center justify-center gap-2">
          <img src="/domestos-pin.png" alt="Domestos" className="h-12 w-12 object-contain drop-shadow" />
          <span className="text-2xl font-black text-slate-300">×</span>
          <img src="/logo.png" alt="toaletna.com" className="h-7 w-auto" />
        </div>

        <h1 className="text-lg font-black tracking-tight text-slate-900">{t.signInTitle}</h1>
        <p className="mx-auto mt-2 max-w-[16rem] text-[13px] leading-relaxed text-slate-500">
          {t.signInLead}
        </p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider text-white shadow-md transition-all hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
          style={{ background: `linear-gradient(90deg, ${BLUE}, ${RED})` }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.signingIn}
            </>
          ) : (
            t.signInButton
          )}
        </button>

        {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
