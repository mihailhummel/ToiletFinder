import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { auth } from '@/firebase';
import { ApiError, fetchDashboard, fetchMe } from '@/lib/api';
import type { DashboardData, Viewer } from '@/types';
import { t } from '@/i18n';
import { SignIn } from '@/components/SignIn';
import { AccessDenied } from '@/components/AccessDenied';
import { Header } from '@/components/Header';
import { StatCards } from '@/components/StatCards';
import { TabNav, type Tab } from '@/components/TabNav';
import { UsersView } from '@/components/UsersView';
import { DomestosView } from '@/components/DomestosView';
import { ActivityView } from '@/components/ActivityView';
import { RankingExplainer } from '@/components/RankingExplainer';

type Phase = 'auth-loading' | 'signed-out' | 'data-loading' | 'denied' | 'error' | 'ready';

export default function App() {
  const [phase, setPhase] = useState<Phase>('auth-loading');
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('domestos');

  const load = useCallback(async () => {
    try {
      const [me, dash] = await Promise.all([fetchMe(), fetchDashboard()]);
      setViewer(me);
      setData(dash);
      setPhase('ready');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setPhase('denied');
      } else {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setPhase('data-loading');
        void load();
      } else {
        setPhase('signed-out');
        setData(null);
        setViewer(null);
      }
    });
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const dash = await fetchDashboard();
      setData(dash);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setPhase('denied');
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (phase === 'auth-loading' || phase === 'data-loading') return <FullScreenSpinner />;
  if (phase === 'signed-out') return <SignIn />;
  if (phase === 'denied') return <AccessDenied email={user?.email ?? null} />;
  if (phase === 'error') {
    return (
      <ErrorScreen
        message={errorMsg}
        onRetry={() => {
          setPhase('data-loading');
          void load();
        }}
      />
    );
  }
  if (!data || !viewer) return <FullScreenSpinner />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        viewer={viewer}
        campaign={data.campaign}
        generatedAt={data.generatedAt}
        onRefresh={refresh}
        refreshing={refreshing}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <StatCards data={data} />
        <TabNav active={tab} onChange={setTab} />

        {tab === 'users' && <UsersView data={data} />}
        {tab === 'domestos' && <DomestosView data={data} />}
        {tab === 'activity' && <ActivityView data={data} />}

        {tab === 'domestos' && <RankingExplainer ranking={data.ranking} />}
      </main>
    </div>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-3 h-9 w-9 text-amber-500" />
        <h1 className="mb-1 text-lg font-bold text-slate-900">{t.errorTitle}</h1>
        <p className="mb-1 text-sm text-slate-600">{t.errorBody}</p>
        {message && <p className="mb-4 text-xs text-slate-400">{message}</p>}
        <button
          onClick={onRetry}
          className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t.tryAgain}
        </button>
      </div>
    </div>
  );
}
