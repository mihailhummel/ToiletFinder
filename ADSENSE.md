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
| `VITE_ADS_ENABLED` | root `.env`, `Dockerfile` ARG/ENV, Railway (main service) | Unused by the map app since consent was split by surface — the main bundle no longer loads the CMP. Harmless to leave set. |
| `VITE_ADS_ENABLED` | `blog/.env`, Railway (blog service) | Blog bundle: renders real ad units + loads the CMP |
| `ADS_ENABLED` | root `.env`, Railway (main service) | Express: widens the CSP to Google's ad origins **and** sets `Referrer-Policy: strict-origin-when-cross-origin` (see below — without it Google serves nothing). Required, because `/blog` is proxied through this app. |

Anything other than the literal string `"true"` means off. An unset variable is
off, which is the correct failure mode — a missed Railway variable degrades to
house ads rather than breaking the page.

**Turning them off restores the previous behaviour exactly**, including the
house-ad creative and helmet's `no-referrer` default. No code changes needed.
The map app's own cookie banner is unaffected either way — it is no longer tied
to the ads flags at all.

## Consent model

Consent is split by surface, on purpose:

| Surface | Consent UI | Covers |
|---|---|---|
| `toaletna.com` (map) | the site's own cookie banner (`ConsentBanner`) | Google Analytics only |
| `toaletna.com/blog`, `/blog/*` | Google's Funding Choices CMP | advertising only |

The map app carries no ad units, so it needs no ad consent and never loads the
CMP — `client/src/lib/cmp.ts` does not exist, and `client/src/main.tsx` only
calls `initAnalytics()`. `/cookie-settings` governs analytics alone. Readers
reopen the ad-consent dialog from the **"Настройки за реклами"** link in the blog
footer, which only renders once the CMP is actually loaded so it is never a dead
button.

**The two never substitute for one another.** Consent must be specific and
informed *per purpose* (EDPB Guidelines 05/2020) — not per page — so each purpose
is asked for on the surface that actually discloses it:

- **Advertising** — Google's CMP, blog only. Its TCF string is the record.
- **Analytics** — the site's own banner, the only place GA is disclosed. It
  writes the shared `toaletna-cookie-consent` record, and since `/blog` is
  same-origin the blog honours that same decision.

The blog's CMP adapter deliberately does **not** write the analytics record from
the TCF signal. The TC string does not carry analytics consent: GA is not a TCF
vendor, and GA4 obeys Consent Mode's `analytics_storage`, which TCF does not
cover. Treating TCF Purpose 1 ("store and/or access information on a device") as
"GA may run" would manufacture a consent the reader never gave, since Google's
message describes advertising.

So the blog carries **both** prompts: Google's CMP for advertising, and
`AnalyticsConsentBanner` for analytics. The analytics banner is shown when a
decision is still owed — **never based on how the reader arrived**. Entry point
is a broken proxy for consent: someone who came from the map may have rejected,
or clicked through without answering at all, and someone arriving from search may
have decided on an earlier visit. Only the stored record knows, so
`needsAnalyticsDecision()` (which mirrors the map's `needsConsentDecision()`,
including the 180-day re-ask for rejecters) is the trigger.

The banner waits for Google's dialog to close before appearing — tracked via the
TCF `cmpuishown` event status — so a reader is never shown two stacked prompts.

Either decision can be revisited from the blog footer: **"Настройки за реклами"**
reopens Google's dialog, **"Настройки за бисквитки"** reopens the analytics
banner (GDPR Art. 7(3): withdrawal must be as easy as consent).

The adapter is **TCF gating, not Google Consent Mode v2** — it never loads
`gtag.js` before a decision, so there are no cookieless pings.

`fundingchoicesmessages.google.com` is blocked by uBlock Origin and Brave. When
the CMP fails to resolve within 5s the blog falls back to its own banner
(`ConsentFallbackBanner`) so those readers keep a way to opt in. Watching
continues for 30s, so a merely slow CMP still takes over and retracts the
fallback rather than leaving two banners on screen.

Refusing consent does **not** hide ads: Google serves cookieless **limited ads**,
which is real revenue. Configure the "do not consent" path in AdSense → Privacy &
messaging as *limited ads*, **not** non-personalised ads — the two are not
interchangeable. Non-personalised ads still set cookies for frequency capping and
reporting, so they need ePrivacy consent you would not have; limited ads disable
everything requiring a local identifier. (An earlier version of this file
conflated the two.)

For the same reason `AdSenseUnit` refuses to serve at all when the CMP is
unavailable, falling back to the house ad: without a certified CMP signal, EEA
traffic is only eligible for non-personalised ads. That costs nothing real —
anything blocking the CMP almost certainly blocks the ad script too.

## Slot configuration

Ad unit ids live in `blog/src/lib/adSlots.ts`. They are public values, so a
constants file is used rather than env vars. **An empty id makes that placement
render the house ad**, which is why this ships before the units exist.

| Key | Unit id | Placement | Format |
|---|---|---|---|
| `sidebar` | `3174863176` | Sticky desktop side rails on the blog home and posts | responsive display (`auto`) |
| `inArticle` | `6623153590` | `{insert_ad_1}` / `{insert_ad_2}` tokens in post bodies | fluid, in-article |
| `homeCard` | `3643540535` | Blog home mobile slots | responsive display (`auto`) |

All three units are created and wired. The component emits markup matching each
unit's dashboard snippet exactly, including the differences between them:
`data-full-width-responsive="true"` on the two display units, and on the
in-article unit `text-align:center` with **no** `data-full-width-responsive`
(which is what Google's generated fluid code omits).

Leave Auto ads **off** — they place units wherever they like and will break the
sticky rail layout.

## Referrer-Policy must not be `no-referrer`

Google identifies the publisher site from the `Referer` header on the requests to
`fundingchoicesmessages.google.com` and `pagead2.googlesyndication.com`. helmet
defaults to `Referrer-Policy: no-referrer`, which strips it. With an empty
Referer both endpoints answer **204 No Content** — the CMP never defines
`__tcfapi`, no consent dialog appears, and no ad ever fills. Nothing errors and
nothing is "blocked", so DevTools looks clean; the requests simply come back
empty.

Verified against the live publisher id:

| Referer sent | Funding Choices response |
|---|---|
| none | 23 KB stub (204 in a browser context) |
| `https://toaletna.com/` | 227 KB CMP kernel |
| full post URL | 227 KB CMP kernel |

The origin alone is enough, so `server/index.ts` sets
`strict-origin-when-cross-origin` when `ADS_ENABLED` is on and keeps helmet's
`no-referrer` when it is off. That is also the modern browser default and what
`client/public/_headers` already documented as the intended policy.

## Size ad containers with `min-height`, never `height`

`adsbygoogle.js` walks up the DOM from its `<ins>` and stamps
`height: auto !important` inline onto ancestor elements, so a responsive unit can
size itself. A plain `height` on the rail was therefore wiped out at runtime and
the box collapsed to ~40px — the height of the house ad's button — which is why
the tall creative looked half-height on some screens. AdSense does not touch
`min-height`, so `.tlt-rail` uses that.

Two consequences worth remembering:

- The element carrying the min-height must be a **flex container**, because
  `height: 100%` on a child resolves against a min-height-only parent as `auto`
  and collapses. Children use `self-stretch` instead of `h-full`.
- `.tlt-rail` sits on the wrapper inside `Ads.tsx`, not on the `<aside>` in the
  page, so the sizing element is one this component fully controls.

The height is `clamp(300px, calc(100vh - 7rem), 600px)`: the standard 600px
skyscraper when it fits under the sticky 64px header, shrinking smoothly on short
screens. It replaced a hard `@media (max-height:760px)` step that was far too
blunt — a 1080p display at 150% Windows scaling reports a ~633px viewport, so
ordinary desktops fell off the cliff to 300px.

## Ads are placed automatically when an article has no tags

Authors can position in-article units with `{insert_ad_1}` / `{insert_ad_2}`.
Where a post contains neither, `Post.tsx` inserts them itself, so every article
carries in-content ads:

- The body is split on blank lines into blocks.
- Insertion points prefer the break directly above a markdown heading — the most
  natural pause in an article — falling back to a paragraph boundary in posts
  with no headings.
- Posts of 30+ blocks get two units (at roughly 33% and 66%); shorter ones get a
  single mid-article unit; posts under 6 blocks get none.
- Ads are kept at least 4 blocks apart, and never in the first 3 or last 2 blocks.

Authored tags always win: if a post contains even one, its placement is used
verbatim and nothing is added.

## Never name your own elements `ad-*`

The side rails were originally given the class `ad-rail`. That name is matched by
public ad-blocker cosmetic filter lists, and one of their rules applies
`position: absolute !important` to it. That tore both rails out of the flex row,
stacked them behind the article and dumped the content flush-left with no ads
visible — on **every** visitor, not just ones running a blocker, because Google's
own ad-block detection pulls that filter list onto the page.

The rail class is now `tlt-rail`. When adding markup around ads, keep container
class names project-specific and avoid `ad`, `ads`, `banner`, `sponsor` and
similar. The one exception is `ins.adsbygoogle`, which Google requires and
blockers will hide — that is exactly what the house-ad fallback exists for.

Related: both blog rows use `justify-center`, not `justify-between`, so the
article column stays centred whether or not the rails render. With
`justify-between`, a hidden rail (ad blocker, or any viewport below `lg`) left
the content pinned to the left edge.

## Full removal

1. Unset `VITE_ADS_ENABLED` (both services) and `ADS_ENABLED`. This alone
   restores previous behaviour; the rest is cleanup.
2. Delete these files:
   - `client/public/ads.txt`, `blog/public/ads.txt`
   - `blog/src/lib/cmp.ts`, `blog/src/lib/adSlots.ts`
   - `blog/src/components/AdSenseUnit.tsx`
   - `blog/src/components/AnalyticsConsentBanner.tsx`
   - the two consent-settings buttons in `blog/src/components/Layout.tsx`
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
