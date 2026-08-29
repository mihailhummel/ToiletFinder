# AdSense integration

Publisher: `pub-5144798032380350` (`ca-pub-5144798032380350`)

Ads run **on the blog only**. The map app carries no ad units — it is a
full-viewport application with no scrollable content, which AdSense's Valuable
Inventory policy treats poorly, and its bottom-right corner is already occupied
by two floating action buttons.

The main app still participates in two ways: it serves the root `ads.txt`, and it
hosts the consent CMP so that a decision made anywhere on `toaletna.com` applies
everywhere.

## Go-live ordering (important)

**Publish the GDPR message in AdSense → Privacy & messaging BEFORE setting the
flags to `true` in production.**

The CMP only registers the TCF API (`__tcfapi`) once a message is configured for
the site. If the flags are on and no message exists, one of two things happens
and neither is good:

- `__tcfapi` never appears → after 5s the fallback banner takes over. Harmless,
  but visitors briefly see nothing and ads never serve.
- `__tcfapi` appears with no consent recorded → every EEA visitor is stored as
  `rejected`, and because the CMP reports itself as working, the fallback banner
  stays hidden. Analytics silently stops for EEA traffic with no way to opt in.

Order of operations: create the AdSense site → verify via `ads.txt` → publish the
GDPR message → create the ad units and paste their ids into `adSlots.ts` → only
then set `VITE_ADS_ENABLED` / `ADS_ENABLED` to `true` on Railway.

## Master switches

| Variable | Where | Effect |
|---|---|---|
| `VITE_ADS_ENABLED` | root `.env`, `Dockerfile` ARG/ENV, Railway (main service) | Client bundle: loads the CMP, hands consent to Google |
| `VITE_ADS_ENABLED` | `blog/.env`, Railway (blog service) | Blog bundle: renders real ad units + loads the CMP |
| `ADS_ENABLED` | root `.env`, Railway (main service) | Express: widens the CSP to Google's ad origins |

Anything other than the literal string `"true"` means off. An unset variable is
off, which is the correct failure mode — a missed Railway variable degrades to
house ads rather than breaking the page.

**Turning all three off restores the previous behaviour exactly**, including the
site's own cookie banner and the house-ad creative. No code changes needed.

## Consent model

Google's Funding Choices CMP is the consent surface. It is IAB TCF certified,
which is required to serve ads to EEA visitors (Bulgaria included).

This is **TCF gating, not Google Consent Mode v2**. `client/src/lib/cmp.ts` reads
the TCF signal and calls the existing `setConsent()` in `lib/consent.ts`, which
already writes the shared localStorage record, loads/unloads gtag and clears
`_ga*` cookies. The consent engine was not rewritten — the CMP is just a new
front end on it. Consent Mode v2 was rejected because it requires loading
`gtag.js` before a decision exists; what that gives up is conversion modelling,
an advertiser feature irrelevant to a publisher. Ad serving is governed by TCF,
so revenue is unaffected.

`fundingchoicesmessages.google.com` is blocked by uBlock Origin and Brave. When
the CMP fails to resolve within 5s, both apps fall back to their own banner
(`ConsentBanner` / `ConsentFallbackBanner`), so those visitors keep a way to opt
in. Without that fallback they would have had no consent surface at all.

Refusing consent does **not** hide ads: Google serves cookieless "limited ads"
instead, which is real revenue. The house ad is only for genuinely-can't-serve
cases. This depends on the "do not consent" behaviour configured in
AdSense → Privacy & messaging.

## Slot configuration

Ad unit ids live in `blog/src/lib/adSlots.ts`. They are public values, so a
constants file is used rather than env vars. **An empty id makes that placement
render the house ad**, which is why this ships before the units exist.

| Key | Unit id | Placement | Format |
|---|---|---|---|
| `sidebar` | `3174863176` | Sticky desktop side rails on the blog home and posts | responsive display (`auto`) |
| `inArticle` | *not created yet* | `{insert_ad_1}` / `{insert_ad_2}` tokens in post bodies | fluid, in-article |
| `homeCard` | `3643540535` | Blog home mobile slots | responsive display (`auto`) |

`inArticle` needs an **In-article ad** unit (AdSense → Ads → By ad unit → In-article
ad), not a Display ad — the format is `fluid` with `data-ad-layout="in-article"`,
which a Display unit does not serve. Until it exists those two slots show the
house ad. This is the highest-value placement of the three, so it is worth
creating.

Leave Auto ads **off** — they place units wherever they like and will break the
sticky rail layout.

## Full removal

1. Unset `VITE_ADS_ENABLED` (both services) and `ADS_ENABLED`. This alone
   restores previous behaviour; the rest is cleanup.
2. Delete these files:
   - `client/src/lib/cmp.ts`
   - `client/public/ads.txt`, `blog/public/ads.txt`
   - `blog/src/lib/cmp.ts`, `blog/src/lib/adSlots.ts`
   - `blog/src/components/AdSenseUnit.tsx`
   - `blog/src/components/ConsentFallbackBanner.tsx`
3. Replace the body of `blog/src/components/Ads.tsx` with:
   ```ts
   export { HouseAd as Ad1, HouseAd as Ad2 } from "./HouseAd";
   ```
   (or inline `HouseAd.tsx` back into it — it is the original creative verbatim).
4. Remove the blocks marked `ADSENSE` everywhere else:
   ```
   grep -rn ADSENSE --include=*.ts --include=*.tsx --include=*.html --include=*.css \
     --include=Dockerfile --include=_headers .
   ```
   That covers `server/index.ts` (CSP), `client/src/App.tsx`,
   `client/src/main.tsx`, `client/src/pages/legal/*`, `client/vite.config.ts`,
   `client/index.html`, `blog/src/App.tsx`, `blog/src/main.tsx`,
   `blog/src/index.css`, `Dockerfile`.
5. In `blog/src/pages/Post.tsx` and `Home.tsx`, drop the `placement` props and
   the `ad-rail` class; restore `lg:hidden` on the in-article wrappers if you
   want those slots back to mobile-only.
