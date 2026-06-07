// Cookie-consent + analytics hard-gate.
//
// GDPR/ePrivacy: Google Analytics must NOT load and NO tracking request may fire
// until the user explicitly accepts. We store the decision in localStorage and
// only inject gtag.js after acceptance. On reject/withdraw we never load GA and
// proactively delete any _ga* cookies.

export type ConsentStatus = "accepted" | "rejected";

export interface ConsentRecord {
  status: ConsentStatus;
  version: number;
  timestamp: string; // ISO
}

const CONSENT_KEY = "toaletna-cookie-consent";

// Bump this when the cookie/privacy terms change materially — older stored
// decisions become stale and the banner re-prompts (and a new consent row is
// recorded on the server, see /api/consent).
export const CONSENT_VERSION = 1;

// Public GA4 Measurement ID (not a secret; safe in the client).
const GA_MEASUREMENT_ID = "G-FPF6DRB75R";

// Fired whenever the stored decision changes, so the banner / settings page can react.
export const CONSENT_EVENT = "toaletna-consent-change";

export function getConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed?.status !== "accepted" && parsed?.status !== "rejected") return null;
    return parsed;
  } catch {
    return null;
  }
}

// Show the banner when there is no decision yet, OR the stored decision predates
// the current consent version.
export function needsConsentDecision(): boolean {
  const c = getConsent();
  return !c || c.version < CONSENT_VERSION;
}

export function hasAnalyticsConsent(): boolean {
  const c = getConsent();
  return !!c && c.status === "accepted" && c.version >= CONSENT_VERSION;
}

export function setConsent(status: ConsentStatus): ConsentRecord {
  const record: ConsentRecord = {
    status,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    /* storage may be unavailable; analytics simply won't load */
  }

  if (status === "accepted") {
    loadAnalytics();
  } else {
    unloadAnalytics();
    clearAnalyticsCookies();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: record }));
  }
  return record;
}

let gaLoaded = false;

// Dynamically inject gtag.js — only ever called after acceptance.
export function loadAnalytics(): void {
  if (typeof window === "undefined" || gaLoaded) return;
  if (!hasAnalyticsConsent()) return; // hard gate

  gaLoaded = true;
  (window as any)[`ga-disable-${GA_MEASUREMENT_ID}`] = false;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.setAttribute("data-analytics", "ga");
  document.head.appendChild(script);

  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  function gtag(...args: any[]) {
    w.dataLayer.push(args);
  }
  w.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

// Disable GA going forward (used on withdrawal). Full removal happens on reload;
// the ga-disable flag stops any further hits immediately.
export function unloadAnalytics(): void {
  if (typeof window === "undefined") return;
  gaLoaded = false;
  (window as any)[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  try {
    delete (window as any).gtag;
  } catch {
    (window as any).gtag = undefined;
  }
  document
    .querySelectorAll('script[data-analytics="ga"]')
    .forEach((el) => el.parentNode?.removeChild(el));
}

// Delete GA cookies (_ga, _ga_*, _gid, _gat) across the current host and the
// registrable domain so analytics leaves no trace after a reject/withdrawal.
export function clearAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const domains = Array.from(
    new Set([host, `.${host}`, ".toaletna.com", "toaletna.com"]),
  );
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name === "_gat") {
      for (const d of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
      }
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

// Call once on app start: if the user previously accepted (current version),
// load GA; otherwise do nothing (no tracking before consent).
export function initAnalytics(): void {
  if (hasAnalyticsConsent()) loadAnalytics();
}
