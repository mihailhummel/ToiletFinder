// ADSENSE: Google Funding Choices CMP adapter for the blog. Delete this file and
// the initCmp() call in main.tsx to remove it.
//
// Consent is split by surface, deliberately:
//   toaletna.com        -> the site's own cookie banner (analytics only). The
//                          map app carries no ads, so it needs no ad consent
//                          and never loads this file.
//   toaletna.com/blog   -> Google's CMP, which is what the ads require.
// The blog is served same-origin at /blog, so both write the same
// localStorage record ("toaletna-cookie-consent") and a decision made on either
// surface satisfies analytics on both. Google's own TCF string, stored
// separately by the CMP, is what governs ad personalisation.
//
// Mechanism note: this is IAB TCF gating, NOT Google Consent Mode v2. We read
// the TCF signal and decide whether analytics may run. We deliberately do not
// load gtag.js before a decision, so there are no cookieless pings.

const CONSENT_KEY = "toaletna-cookie-consent";
const CONSENT_VERSION = 1;
const PUBLISHER_ID = "pub-5144798032380350";

/** Fired when the CMP resolves, so the UI can react (see ConsentGate). */
export const CMP_STATE_EVENT = "toaletna-cmp-state";

export type CmpState = "pending" | "ready" | "unavailable";

// How long to wait before assuming the CMP was blocked and showing our own
// banner instead. We keep watching past this point (up to CMP_MAX_WAIT_MS) so a
// merely slow CMP still takes over and hides the fallback, rather than leaving
// the reader looking at two consent banners at once.
const CMP_TIMEOUT_MS = 5000;
const CMP_MAX_WAIT_MS = 30000;

let state: CmpState = "pending";
let started = false;

export function getCmpState(): CmpState {
  return state;
}

export const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === "true";

function setState(next: CmpState) {
  if (state === next) return;
  state = next;
  window.dispatchEvent(new CustomEvent(CMP_STATE_EVENT, { detail: next }));
}

/** Write the shared consent record and notify listeners (same shape the main app uses). */
export function recordConsent(status: "accepted" | "rejected"): void {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ status, version: CONSENT_VERSION, timestamp: new Date().toISOString() }),
    );
  } catch {
    /* storage unavailable — analytics simply won't run */
  }
  window.dispatchEvent(new CustomEvent("toaletna-consent-change", { detail: status }));
}

export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw);
    return c?.status === "accepted" && (c?.version ?? 0) >= CONSENT_VERSION;
  } catch {
    return false;
  }
}

// Google requires a frame named "googlefcPresent" on the page for messages to
// render. This is their published snippet, moved out of index.html so the whole
// integration stays behind the feature flag.
function signalGooglefcPresent(): void {
  if (window.frames["googlefcPresent" as any]) return;
  if (!document.body) {
    setTimeout(signalGooglefcPresent, 0);
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;display:none;";
  iframe.name = "googlefcPresent";
  document.body.appendChild(iframe);
}

function onTcData(tcData: any): void {
  if (!tcData) return;

  // Outside the EEA/UK the CMP does not gather consent and none is required.
  if (tcData.gdprApplies === false) {
    setState("ready");
    recordConsent("accepted");
    return;
  }

  if (tcData.eventStatus !== "tcloaded" && tcData.eventStatus !== "useractioncomplete") return;

  setState("ready");
  // Purpose 1 = "Store and/or access information on a device" — the ePrivacy
  // cookie purpose, which is what gates analytics storage.
  const purpose1 = tcData.purpose?.consents?.[1] === true;
  recordConsent(purpose1 ? "accepted" : "rejected");
}

export function initCmp(): void {
  if (!ADS_ENABLED || started || typeof window === "undefined") return;
  started = true;

  signalGooglefcPresent();

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://fundingchoicesmessages.google.com/i/${PUBLISHER_ID}?ers=1`;
  script.setAttribute("data-cmp", "googlefc");
  script.onerror = () => setState("unavailable");
  document.head.appendChild(script);

  // __tcfapi only exists once the CMP has booted, so poll for it. Fail closed:
  // if it never shows up (ad blocker), analytics stays off and the consent UI
  // falls back to the site's own banner.
  const softDeadline = Date.now() + CMP_TIMEOUT_MS;
  const hardDeadline = Date.now() + CMP_MAX_WAIT_MS;
  const poll = window.setInterval(() => {
    const tcfapi = (window as any).__tcfapi;
    if (typeof tcfapi === "function") {
      window.clearInterval(poll);
      // onTcData flips state to "ready", which retracts the fallback banner if
      // the soft deadline already put it on screen.
      tcfapi("addEventListener", 2, (tcData: any, success: boolean) => {
        if (success) onTcData(tcData);
      });
      return;
    }
    if (Date.now() > softDeadline) setState("unavailable");
    if (Date.now() > hardDeadline) window.clearInterval(poll);
  }, 200);
}

// The kernel exposes the legacy `googlefc` alias as well as `__googlefc`; which
// one carries showRevocationMessage has changed between versions, so try both.
function revocationApi(): { showRevocationMessage: () => void } | null {
  const w = window as any;
  for (const candidate of [w.googlefc, w.__googlefc]) {
    if (typeof candidate?.showRevocationMessage === "function") return candidate;
  }
  return null;
}

/** True once Google's CMP can reopen its dialog (drives the footer link). */
export function canShowConsentUi(): boolean {
  return revocationApi() !== null;
}

/** Reopen the CMP dialog so a visitor can change their mind. */
export function showConsentUi(): void {
  revocationApi()?.showRevocationMessage();
}
