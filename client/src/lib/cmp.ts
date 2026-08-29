// ADSENSE: Google Funding Choices CMP adapter. Delete this file, the initCmp()
// call in main.tsx, and the two guards in App.tsx / CookieSettings.tsx to remove.
//
// Bulgaria is in the EEA, so Google requires a certified CMP for ad serving.
// Rather than replacing the consent engine in lib/consent.ts, this adapter puts
// a new *front end* on it: it reads Google's IAB TCF signal and calls the
// existing setConsent(), which already writes the shared localStorage record,
// loads/unloads gtag, clears _ga* cookies and fires CONSENT_EVENT. Everything
// downstream — including the blog, which reads the same key — keeps working.
//
// Mechanism note: this is TCF gating, NOT Google Consent Mode v2. Consent Mode
// would load gtag.js up front and send cookieless pings before a decision,
// which is exactly what this codebase's analytics hard-gate exists to prevent.
// What that gives up is conversion modelling, an advertiser feature of no value
// to a publisher; ad serving is governed by TCF, so revenue is unaffected.
import { useEffect, useState } from "react";
import { setConsent } from "./consent";

const PUBLISHER_ID = "pub-5144798032380350";

/** Master switch. Build with VITE_ADS_ENABLED=true to hand consent to the CMP. */
export const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === "true";

/** Fired when the CMP resolves or is found to be blocked. */
export const CMP_STATE_EVENT = "toaletna-cmp-state";

export type CmpState = "pending" | "ready" | "unavailable";

// How long to wait for the CMP before assuming an ad blocker ate it.
const CMP_TIMEOUT_MS = 5000;

let state: CmpState = ADS_ENABLED ? "pending" : "unavailable";
let started = false;

export function getCmpState(): CmpState {
  return state;
}

function setState(next: CmpState) {
  if (state === next) return;
  state = next;
  window.dispatchEvent(new CustomEvent(CMP_STATE_EVENT, { detail: next }));
}

// Google requires a frame named "googlefcPresent" for messages to render. This
// is their published snippet, kept here rather than inline in index.html so the
// whole integration stays behind the feature flag.
function signalGooglefcPresent(): void {
  if ((window.frames as any)["googlefcPresent"]) return;
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

  // Outside the EEA/UK the CMP gathers no consent and none is required.
  if (tcData.gdprApplies === false) {
    setState("ready");
    setConsent("accepted");
    return;
  }

  if (tcData.eventStatus !== "tcloaded" && tcData.eventStatus !== "useractioncomplete") return;

  setState("ready");
  // Purpose 1 = "Store and/or access information on a device" — the ePrivacy
  // cookie purpose, which is what gates analytics storage.
  const purpose1 = tcData.purpose?.consents?.[1] === true;
  setConsent(purpose1 ? "accepted" : "rejected");
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
  // if it never appears, analytics stays off and ConsentBanner takes over as the
  // consent surface (see App.tsx).
  const deadline = Date.now() + CMP_TIMEOUT_MS;
  const poll = window.setInterval(() => {
    const tcfapi = (window as any).__tcfapi;
    if (typeof tcfapi === "function") {
      window.clearInterval(poll);
      tcfapi("addEventListener", 2, (tcData: any, success: boolean) => {
        if (success) onTcData(tcData);
      });
      return;
    }
    if (Date.now() > deadline) {
      window.clearInterval(poll);
      setState("unavailable");
    }
  }, 200);
}

/** True when the CMP is the active consent surface (so our own banner stays hidden). */
export function cmpOwnsConsent(): boolean {
  return ADS_ENABLED && state !== "unavailable";
}

/** Reopen the CMP dialog so a visitor can change their mind. */
export function showConsentUi(): void {
  const googlefc = (window as any).googlefc;
  if (googlefc?.showRevocationMessage) googlefc.showRevocationMessage();
}

/**
 * Subscribe to CMP state in a component. Used to decide whether our own
 * ConsentBanner needs to stand in for a blocked CMP.
 */
export function useCmpState(): CmpState {
  const [value, setValue] = useState<CmpState>(getCmpState);

  useEffect(() => {
    const onChange = () => setValue(getCmpState());
    window.addEventListener(CMP_STATE_EVENT, onChange);
    // The CMP may already have resolved before this component mounted.
    onChange();
    return () => window.removeEventListener(CMP_STATE_EVENT, onChange);
  }, []);

  return value;
}
