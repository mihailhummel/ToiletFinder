// ADSENSE: fallback consent banner, shown ONLY when Google's CMP fails to load.
//
// fundingchoicesmessages.google.com is on uBlock Origin's and Brave's default
// blocklists. Without this, those visitors would get no consent prompt at all
// and no way to opt into analytics — worse than before the CMP was introduced.
// Delete this file (and its use in App.tsx) along with lib/cmp.ts.
import { useEffect, useState } from "react";
import { CMP_STATE_EVENT, getCmpState, recordConsent, ADS_ENABLED } from "../lib/cmp";

export function ConsentFallbackBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ADS_ENABLED) return;

    const evaluate = () => {
      // Only stand in for the CMP when it is genuinely unavailable, and only if
      // the visitor has not already decided (here or on the main site).
      const undecided = !localStorage.getItem("toaletna-cookie-consent");
      setVisible(getCmpState() === "unavailable" && undecided);
    };

    evaluate();
    window.addEventListener(CMP_STATE_EVENT, evaluate);
    return () => window.removeEventListener(CMP_STATE_EVENT, evaluate);
  }, []);

  if (!visible) return null;

  const decide = (status: "accepted" | "rejected") => {
    recordConsent(status);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Бисквитки"
      className="fixed bottom-0 inset-x-0 z-[4000] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 p-4 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <p className="min-w-0 sm:flex-1 text-[13px] leading-relaxed text-slate-600">
            Този сайт работи с бисквитки 🍪 (истинските са по-вкусни, знаем). Помагат ни да
            разберем колко хора ни четат. Нищо страшно.
          </p>
          {/* Equal weight for both choices — refusing is as easy as accepting. */}
          <div className="flex gap-2.5 sm:flex-shrink-0">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-[11.5px] sm:text-[13px] hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              Само нужните
            </button>
            <button
              type="button"
              onClick={() => decide("accepted")}
              className="flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-[11.5px] sm:text-[13px] hover:bg-blue-700 active:scale-[0.98] transition-all shadow-[0_4px_10px_rgba(37,99,235,0.25)]"
            >
              Приемам 🍪
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsentFallbackBanner;
