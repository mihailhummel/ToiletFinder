import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { needsConsentDecision, setConsent, CONSENT_EVENT } from "@/lib/consent";

// GDPR/ePrivacy cookie-consent banner. Shows only when there is no stored
// decision (or it is stale). Google Analytics is hard-gated in lib/consent.ts —
// nothing tracks until "Accept" is pressed. "Accept" and "Reject" are given
// equal visual weight (no dark patterns).
export function ConsentBanner() {
  const { language } = useLanguage();
  const [visible, setVisible] = useState(false);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setVisible(needsConsentDecision());
    // If consent is changed elsewhere (e.g. the cookie-settings page), reflect it.
    const onChange = () => setVisible(needsConsentDecision());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (visible) acceptRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

  const decide = (status: "accepted" | "rejected") => {
    setConsent(status);
    setVisible(false);
  };

  const bg = language === "bg";
  const t = {
    title: bg ? "Бисквитки" : "Cookies",
    body: bg
      ? "Използваме бисквитки, за да работи сайтът. С Ваше съгласие добавяме и анонимна статистика (Google Analytics), за да подобряваме картата."
      : "We use cookies to run the site. With your consent we also add anonymous analytics (Google Analytics) to improve the map.",
    accept: bg ? "Приемам" : "Accept",
    // "Only necessary" is the (one-click) reject — a softer label than "Reject",
    // which is permitted and lifts opt-in while keeping refusal as easy as accept.
    reject: bg ? "Само необходими" : "Only necessary",
    privacy: bg ? "Поверителност" : "Privacy",
    cookies: bg ? "Бисквитки" : "Cookies",
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.title}
      className="fixed bottom-0 inset-x-0 z-[4000] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 p-4 sm:px-5 sm:py-4">
        {/* One row on desktop (text left, buttons right); stacks on mobile. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <p className="min-w-0 sm:flex-1 text-[13px] leading-relaxed text-slate-600">
            <span className="font-bold text-slate-900">{t.title}. </span>
            {t.body}{" "}
            <Link href="/privacy" className="text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-700">
              {t.privacy}
            </Link>{" "}
            ·{" "}
            <Link href="/cookies" className="text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-700">
              {t.cookies}
            </Link>
          </p>
          {/* Both one-click and equally easy; Accept is colour-led, "Only necessary"
              is an equally-weighted outline — refusing is as easy as accepting. */}
          <div className="flex gap-2.5 sm:flex-shrink-0">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="flex-1 sm:flex-none whitespace-nowrap px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-[13px] hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              {t.reject}
            </button>
            <button
              ref={acceptRef}
              type="button"
              onClick={() => decide("accepted")}
              className="flex-1 sm:flex-none whitespace-nowrap px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-[13px] hover:bg-blue-700 active:scale-[0.98] transition-all shadow-[0_4px_10px_rgba(37,99,235,0.25)]"
            >
              {t.accept}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
