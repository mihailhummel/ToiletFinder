// ADSENSE: the blog's Google Analytics consent banner.
//
// Purpose split (see lib/cmp.ts): Google's CMP asks about ADVERTISING, this asks
// about ANALYTICS. Google's message says nothing about Google Analytics, so it
// cannot stand in for this one — consent must be specific and informed per
// purpose. Both write/read the same site-wide record, so whichever surface the
// reader answers on, they are not asked twice.
//
// It appears when a decision is still owed, which is the correct trigger — NOT
// how the reader arrived. Someone who came from the map may have rejected, or
// never answered at all; someone arriving from search may have decided on a
// previous visit. Only the stored record knows.
//
// It deliberately waits for Google's dialog to close before appearing, so the
// reader is never faced with two consent prompts stacked on top of each other.
import { useEffect, useState } from "react";
import {
  ADS_ENABLED,
  CMP_STATE_EVENT,
  OPEN_ANALYTICS_CONSENT_EVENT,
  getCmpState,
  isCmpUiShown,
  needsAnalyticsDecision,
  recordConsent,
} from "../lib/cmp";

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false);
  // Set by the footer link, which must be able to reopen this even for a reader
  // who already decided (GDPR Art. 7(3): withdrawing must be as easy as giving).
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      // With ads off the CMP never runs, so there is nothing to wait for.
      const cmpSettled = !ADS_ENABLED || getCmpState() !== "pending";
      setVisible(cmpSettled && !isCmpUiShown() && needsAnalyticsDecision());
    };

    const open = () => setForceOpen(true);

    evaluate();
    window.addEventListener(CMP_STATE_EVENT, evaluate);
    window.addEventListener(OPEN_ANALYTICS_CONSENT_EVENT, open);
    return () => {
      window.removeEventListener(CMP_STATE_EVENT, evaluate);
      window.removeEventListener(OPEN_ANALYTICS_CONSENT_EVENT, open);
    };
  }, []);

  if (!visible && !forceOpen) return null;

  const decide = (status: "accepted" | "rejected") => {
    recordConsent(status);
    setVisible(false);
    setForceOpen(false);
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
          <div className="min-w-0 sm:flex-1">
            <p className="text-[13px] leading-relaxed text-slate-600">
              Този сайт работи с бисквитки 🍪 (истинските са по-вкусни, знаем). Аналитичните
              бисквитки (Google Analytics) ни показват колко хора четат блога и ползват картата.
              Този избор важи за целия toaletna.com.
            </p>
            <p className="mt-1.5 text-[12px] text-blue-600">
              <a
                href="https://toaletna.com/cookies"
                className="font-semibold underline underline-offset-2 hover:text-blue-700"
              >
                Бисквитки
              </a>
              {" · "}
              <a
                href="https://toaletna.com/privacy"
                className="font-semibold underline underline-offset-2 hover:text-blue-700"
              >
                Поверителност
              </a>
            </p>
          </div>
          {/* Both one-click and equally weighted — refusing is as easy as accepting. */}
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

export default AnalyticsConsentBanner;
