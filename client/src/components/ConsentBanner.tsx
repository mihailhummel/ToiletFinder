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
    title: bg ? "Бисквитки и поверителност" : "Cookies & privacy",
    body: bg
      ? "Използваме само необходими бисквитки, за да работи сайтът. С Ваше съгласие използваме и Google Analytics (анонимизирано), за да разбираме как се ползва картата. Никакво проследяване не се зарежда без съгласие."
      : "We use only essential cookies to run the site. With your consent we also use Google Analytics (anonymised) to understand how the map is used. No tracking loads without consent.",
    accept: bg ? "Приемам" : "Accept",
    reject: bg ? "Отказвам" : "Reject",
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
      <div className="pointer-events-auto mx-auto max-w-3xl bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{t.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {t.body}{" "}
              <Link
                href="/privacy"
                className="text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-700"
              >
                {t.privacy}
              </Link>{" "}
              ·{" "}
              <Link
                href="/cookies"
                className="text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-700"
              >
                {t.cookies}
              </Link>
            </p>
          </div>
          {/* Equal-prominence buttons (same size/shape; Accept gets colour, Reject
              gets an equally weighted outline — neither is hidden or de-emphasised). */}
          <div className="flex gap-2.5 sm:justify-end">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="flex-1 sm:flex-none sm:min-w-[120px] px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-[14px] hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              {t.reject}
            </button>
            <button
              ref={acceptRef}
              type="button"
              onClick={() => decide("accepted")}
              className="flex-1 sm:flex-none sm:min-w-[120px] px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-[14px] hover:bg-blue-700 active:scale-[0.98] transition-all shadow-[0_4px_10px_rgba(37,99,235,0.25)]"
            >
              {t.accept}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
