import { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitch } from "@/components/LanguageSwitch";

interface LegalLayoutProps {
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}

// Shared chrome for the legal/info pages (privacy, terms, cookies, cookie-settings).
// Provides a back-to-map link, language switch, readable content column, and a
// footer that cross-links every legal page (satisfies the GDPR "linked from
// everywhere" expectation).
export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const { language } = useLanguage();
  const bg = language === "bg";

  const nav = {
    back: bg ? "Към картата" : "Back to map",
    privacy: bg ? "Поверителност" : "Privacy Policy",
    terms: bg ? "Условия" : "Terms of Service",
    cookies: bg ? "Бисквитки" : "Cookie Policy",
    settings: bg ? "Настройки за бисквитки" : "Cookie Settings",
    updated: bg ? "Последна актуализация" : "Last updated",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {nav.back}
          </Link>
          <LanguageSwitch />
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
        {lastUpdated && (
          <p className="mt-1 text-[13px] text-slate-500">
            {nav.updated}: {lastUpdated}
          </p>
        )}
        <div className="legal-prose mt-6 text-[15px] leading-relaxed text-slate-700 space-y-5">
          {children}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <Link href="/privacy" className="text-slate-600 hover:text-blue-600 font-medium">
            {nav.privacy}
          </Link>
          <Link href="/terms" className="text-slate-600 hover:text-blue-600 font-medium">
            {nav.terms}
          </Link>
          <Link href="/cookies" className="text-slate-600 hover:text-blue-600 font-medium">
            {nav.cookies}
          </Link>
          <Link href="/cookie-settings" className="text-slate-600 hover:text-blue-600 font-medium">
            {nav.settings}
          </Link>
          <Link href="/" className="text-slate-600 hover:text-blue-600 font-medium">
            {nav.back}
          </Link>
        </div>
      </footer>
    </div>
  );
}

// Small helpers for consistent section formatting inside legal pages.
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-slate-900">{heading}</h2>
      {children}
    </section>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  // Visually flags a legal/identity fact the owner must fill in before going live.
  return (
    <mark className="bg-amber-100 text-amber-900 px-1 rounded font-semibold">
      [{children}]
    </mark>
  );
}
