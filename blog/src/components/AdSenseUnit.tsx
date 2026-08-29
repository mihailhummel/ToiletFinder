// ADSENSE: renders a single AdSense unit, falling back to a supplied node
// whenever a real ad cannot be shown. Delete this file to remove AdSense.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AD_CLIENT, ADS_ENABLED } from "../lib/adSlots";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type FillStatus = "pending" | "filled" | "unfilled" | "error";

// The loader script is shared by every unit on the page, so load it exactly once
// and let all units await the same promise. Mirrors the injection pattern used
// for gtag in the main app's lib/consent.ts (tagged with a data-* attribute so
// it can be found and removed again).
let scriptPromise: Promise<void> | null = null;

function loadAdSenseScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[data-ads="adsense"]')) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    script.setAttribute("data-ads", "adsense");
    script.onload = () => resolve();
    // Ad blockers reject the request outright — that is the common case here,
    // not an exceptional one, so callers just render their fallback.
    script.onerror = () => reject(new Error("adsbygoogle.js failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// Backstop for the case where the script loads but AdSense never writes
// data-ad-status at all (rare, but it leaves the slot blank forever otherwise).
const FILL_TIMEOUT_MS = 6000;

export interface AdSenseUnitProps {
  /** Ad unit id from the AdSense dashboard. Empty string ⇒ render the fallback. */
  slot: string;
  /** 'auto' | 'fluid' | 'vertical' | 'rectangle' … */
  format?: string;
  /** e.g. 'in-article' — pairs with format="fluid". */
  layout?: string;
  responsive?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Shown when no real ad can be served. */
  fallback: ReactNode;
}

export function AdSenseUnit({
  slot,
  format = "auto",
  layout,
  responsive = true,
  className = "",
  style,
  fallback,
}: AdSenseUnitProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const [status, setStatus] = useState<FillStatus>("pending");

  const disabled = !ADS_ENABLED || !slot;

  useEffect(() => {
    if (disabled) return;
    // React StrictMode runs effects twice in dev. The ref survives that, and
    // pushing the same <ins> twice throws
    // "All 'ins' elements in the DOM with class=adsbygoogle already have ads".
    if (pushedRef.current) return;
    pushedRef.current = true;

    let cancelled = false;
    let observer: MutationObserver | undefined;
    let timer: number | undefined;

    const settle = (next: FillStatus) => {
      if (cancelled) return;
      setStatus(next);
      observer?.disconnect();
      if (timer) window.clearTimeout(timer);
    };

    loadAdSenseScript()
      .then(() => {
        const ins = insRef.current;
        if (cancelled || !ins) return;

        // AdSense writes data-ad-status="filled" | "unfilled" straight onto the
        // <ins>. Observing it reacts the moment the decision lands, instead of
        // guessing with a fixed delay (which shifts the layout twice: once when
        // the ad paints, again when a late timer swaps in the fallback).
        const read = () => {
          const value = ins.getAttribute("data-ad-status");
          if (value === "unfilled") settle("unfilled");
          else if (value === "filled") settle("filled");
        };

        observer = new MutationObserver(read);
        observer.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
        read(); // may already be set

        timer = window.setTimeout(() => settle("unfilled"), FILL_TIMEOUT_MS);

        (window.adsbygoogle = window.adsbygoogle || []).push({});
      })
      .catch(() => settle("error"));

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [disabled, slot]);

  if (disabled || status === "unfilled" || status === "error") {
    return <>{fallback}</>;
  }

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={{ display: "block", ...style }}
      data-ad-client={AD_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      {...(layout ? { "data-ad-layout": layout } : {})}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}

export default AdSenseUnit;
