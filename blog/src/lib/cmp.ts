// ADSENSE: Google Funding Choices CMP adapter for the blog. Delete this file and
// the initCmp() call in main.tsx to remove it.
//
// Consent is split by PURPOSE, and each purpose is asked for where it is
// actually disclosed:
//   advertising -> Google's CMP, loaded on /blog only (the map serves no ads).
//                  Its TCF string is the record; this file never writes ours.
//   analytics   -> the site's own cookie banner, which is the only surface that
//                  discloses Google Analytics. It writes the shared
//                  "toaletna-cookie-consent" record, and because /blog is
//                  same-origin the blog honours that same decision.
//
// The two never substitute for one another. A visitor who only ever answered
// Google's ad message has given no analytics consent, so GA stays off for them.
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

// Whether Google's own dialog is on screen right now. We use this to avoid
// stacking our analytics banner on top of it.
let cmpUiShown = false;

export function isCmpUiShown(): boolean {
  return cmpUiShown;
}

// Always emit, even when `state` is unchanged: a cmpuishown -> useractioncomplete
// transition matters to listeners even though both end up "ready".
function emitState() {
  window.dispatchEvent(new CustomEvent(CMP_STATE_EVENT, { detail: { state, cmpUiShown } }));
}

function setState(next: CmpState) {
  state = next;
  emitState();
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

// Re-ask rejecters after this long, matching client/src/lib/consent.ts. Keep the
// two in step: they read and write the same record.
const REJECT_REPROMPT_DAYS = 180;

/**
 * Does this visitor still owe us an analytics decision? Mirrors the main app's
 * needsConsentDecision(): no record, a record from an older policy version, or a
 * rejection old enough to ask once more. An existing answer — accept OR reject,
 * given on the map or on a previous blog visit — means we do not ask again.
 */
export function needsAnalyticsDecision(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return true;
    const c = JSON.parse(raw);
    if (c?.status !== "accepted" && c?.status !== "rejected") return true;
    if ((c?.version ?? 0) < CONSENT_VERSION) return true;
    if (c.status === "rejected") {
      const ageMs = Date.now() - new Date(c.timestamp).getTime();
      if (Number.isFinite(ageMs) && ageMs > REJECT_REPROMPT_DAYS * 24 * 60 * 60 * 1000) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Fired when the footer link asks to reopen our analytics banner. */
export const OPEN_ANALYTICS_CONSENT_EVENT = "toaletna-open-analytics-consent";

/** Let a reader revisit the analytics decision from the blog (Art. 7(3) withdrawal). */
export function openAnalyticsConsent(): void {
  window.dispatchEvent(new CustomEvent(OPEN_ANALYTICS_CONSENT_EVENT));
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

  // NOTE: we deliberately do NOT derive analytics consent from the TCF signal.
  //
  // The TC string does not carry analytics consent. Google Analytics is not a
  // TCF vendor; GA4 obeys Consent Mode's `analytics_storage`, which the TCF
  // string does not cover. Mapping TCF Purpose 1 ("store and/or access
  // information on a device") onto "GA may run" would be inventing a consent
  // the reader never gave: Google's message describes advertising, and consent
  // must be specific and informed per PURPOSE (EDPB Guidelines 05/2020).
  //
  // So this adapter now governs advertising only. Analytics consent comes from
  // the site's own banner, which is where analytics is actually disclosed. A
  // reader who has never seen that banner simply gets no analytics — fail-closed
  // and lawful, at the cost of some blog pageview data.
  if (tcData.gdprApplies === false) {
    cmpUiShown = false;
    setState("ready");
    return;
  }

  // Google is showing its message right now — hold our analytics banner back.
  if (tcData.eventStatus === "cmpuishown") {
    cmpUiShown = true;
    emitState();
    return;
  }

  if (tcData.eventStatus !== "tcloaded" && tcData.eventStatus !== "useractioncomplete") return;

  cmpUiShown = false;
  setState("ready");
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
