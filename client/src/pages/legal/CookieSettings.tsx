import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LegalLayout, LegalSection } from "./LegalLayout";
import { getConsent, setConsent, CONSENT_EVENT, type ConsentRecord } from "@/lib/consent";

export default function CookieSettings() {
  const { language } = useLanguage();
  const bg = language === "bg";
  const [consent, setConsentState] = useState<ConsentRecord | null>(null);

  useEffect(() => {
    setConsentState(getConsent());
    const onChange = () => setConsentState(getConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const apply = (status: "accepted" | "rejected") => {
    // setConsent loads/unloads GA and clears _ga* cookies immediately.
    setConsentState(setConsent(status));
  };

  const accepted = consent?.status === "accepted";
  const rejected = consent?.status === "rejected";

  const statusLabel = !consent
    ? bg ? "Все още не сте избрали" : "No choice made yet"
    : accepted
      ? bg ? "Анализът е РАЗРЕШЕН" : "Analytics is ENABLED"
      : bg ? "Анализът е ОТКАЗАН" : "Analytics is DISABLED";

  return (
    <LegalLayout title={bg ? "Настройки за бисквитки" : "Cookie Settings"}>
      <LegalSection heading={bg ? "Необходими бисквитки" : "Essential cookies"}>
        <p>
          {bg
            ? "Винаги активни — нужни за работата на сайта (език, сесия при вход, запомняне на този избор). Не могат да бъдат изключени."
            : "Always on — required for the site to work (language, sign-in session, remembering this choice). These cannot be turned off."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Аналитични бисквитки (Google Analytics)" : "Analytics cookies (Google Analytics)"}>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[14px] font-bold text-slate-900">
            {bg ? "Текущо състояние: " : "Current status: "}
            <span className={accepted ? "text-emerald-600" : rejected ? "text-red-600" : "text-slate-500"}>
              {statusLabel}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-slate-600">
            {bg
              ? "Помага ни да разберем как се ползва картата. Нищо не се проследява без Вашето съгласие."
              : "Helps us understand how the map is used. Nothing is tracked without your consent."}
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => apply("rejected")}
              aria-pressed={rejected}
              className={`flex-1 sm:flex-none sm:min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all active:scale-[0.98] ${
                rejected
                  ? "bg-red-50 text-red-700 border-2 border-red-300"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <X className="w-4 h-4" />
              {bg ? "Откажи" : "Reject"}
            </button>
            <button
              type="button"
              onClick={() => apply("accepted")}
              aria-pressed={accepted}
              className={`flex-1 sm:flex-none sm:min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all active:scale-[0.98] ${
                accepted
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              <Check className="w-4 h-4" />
              {bg ? "Разреши" : "Accept"}
            </button>
          </div>
        </div>
        {consent && (
          <p className="mt-2 text-[12px] text-slate-400">
            {bg ? "Последна промяна: " : "Last updated: "}
            {new Date(consent.timestamp).toLocaleString(bg ? "bg-BG" : "en-GB")}
          </p>
        )}
      </LegalSection>
    </LegalLayout>
  );
}
