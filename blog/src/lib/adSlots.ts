// ADSENSE: ad unit configuration. Delete this file to remove AdSense.
//
// Slot IDs are public values (they ship in the page HTML anyway), so a plain
// constants file beats env vars here — one file to delete, and no Dockerfile /
// Railway wiring to keep in sync.
//
// An EMPTY slot id means "not configured yet" and makes that placement fall back
// to the house ad, so this ships and behaves sanely before the units exist in
// the AdSense dashboard. Paste the ids from AdSense → Ads → By ad unit.

export const AD_CLIENT = "ca-pub-5144798032380350";

export const AD_SLOTS = {
  /** Display unit, vertical — the sticky desktop side rails (160x600 / 300x600). */
  sidebar: "",
  /** In-article (fluid) unit — the {insert_ad_1} / {insert_ad_2} body slots. */
  inArticle: "",
  /** Display unit, rectangle — the blog home mobile slots (300x250). */
  homeCard: "",
} as const;

/** Master switch. Build with VITE_ADS_ENABLED=true to serve real ads. */
export const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === "true";
