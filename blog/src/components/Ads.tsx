// ADSENSE: this file is the switch between real AdSense units and the original
// house creative.
//
// TO REMOVE ADSENSE ENTIRELY: replace this file's body with
//   export { HouseAd as Ad1, HouseAd as Ad2 } from "./HouseAd";
// and delete AdSenseUnit.tsx + lib/adSlots.ts. Nothing else in the blog imports
// them. Setting VITE_ADS_ENABLED to anything but "true" already achieves the
// same behaviour at runtime without touching code.
import { AdSenseUnit } from "./AdSenseUnit";
import { HouseAd } from "./HouseAd";
import { AD_SLOTS } from "../lib/adSlots";

export type AdPlacement = "sidebar" | "in-article" | "card";

interface AdProps {
  className?: string;
  placement?: AdPlacement;
}

// Each placement pins its own unit id, ad format and reserved box. The reserved
// box is what keeps the layout from shifting: it is identical whether the slot
// ends up holding a real ad, the house ad, or nothing yet.
const PLACEMENTS = {
  // Sticky desktop side rails. The <aside> supplies the height (see .ad-rail in
  // index.css, which drops to 300px on short viewports), so the box is definite
  // and h-full resolves against it.
  sidebar: {
    slot: AD_SLOTS.sidebar,
    // "auto", matching how the unit was created in AdSense (responsive display).
    // A "vertical" shape hint would be valid too, but it restricts which sizes
    // may fill and so lowers fill rate; the 160px-wide rail already constrains
    // the shape physically, so there is nothing to gain by narrowing it further.
    format: "auto",
    layout: undefined,
    wrapper: "w-full h-full flex",
    unit: "w-full h-full",
    fallback: "w-full h-full",
  },
  // {insert_ad_1} / {insert_ad_2} inside the article body. Fluid in-article is
  // the best-performing format but also the least predictable in height, hence
  // the reserved min-height.
  //
  // The height here is a MINIMUM, not a fixed value, so the box is indefinite
  // and h-full on a child would collapse to content height. The unit is left
  // unconstrained (fluid sizes itself) and the fallback uses self-stretch, which
  // — unlike height:100% — does stretch a flex item to an indefinite container's
  // cross size, so the house ad fills the reserved 280px instead of shrinking to
  // the height of its CTA button.
  "in-article": {
    slot: AD_SLOTS.inArticle,
    format: "fluid",
    layout: "in-article",
    wrapper: "w-full min-h-[280px] flex",
    unit: "w-full",
    fallback: "w-full self-stretch",
  },
  // Blog home mobile slots. Call sites pass their own h-[250px], so the wrapper
  // deliberately sets no height of its own — two competing Tailwind height
  // classes would be resolved by stylesheet order, not by class-attribute order.
  card: {
    slot: AD_SLOTS.homeCard,
    // "auto", matching the responsive display unit created in AdSense.
    format: "auto",
    layout: undefined,
    wrapper: "w-full flex",
    unit: "w-full h-full",
    fallback: "w-full h-full",
  },
} as const;

function Ad({ className = "", placement = "sidebar" }: AdProps) {
  const config = PLACEMENTS[placement];

  return (
    <div className={`${config.wrapper} ${className}`}>
      <AdSenseUnit
        slot={config.slot}
        format={config.format}
        layout={config.layout}
        className={config.unit}
        fallback={<HouseAd className={config.fallback} />}
      />
    </div>
  );
}

// Ad1 / Ad2 keep their original signatures so existing call sites in Post.tsx
// and Home.tsx keep working. They render the same unit, exactly as before.
export const Ad1 = (props: AdProps) => <Ad {...props} />;
export const Ad2 = (props: AdProps) => <Ad {...props} />;
