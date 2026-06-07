# Privacy & Data-Flow Audit — toaletna.com

_Phase 1 (audit-only) of the privacy-compliance work. Findings as of 8 June 2026._

## Stack (verified, not assumed)
- **Frontend:** React + TypeScript + Vite, Tailwind, React Query. Routing: **was none** (single-page map shell) — a lightweight `wouter` router is added in this branch so legal pages can have real URLs.
- **Auth:** Firebase Authentication (Google sign-in only). Client SDK in `client/src/lib/firebase.ts`.
- **Primary data store:** **Supabase (Postgres)**, region `eu-central-1` (Frankfurt, EU). The original spec guessed Firestore — that is **wrong**. User-owned data lives in Supabase; Firebase is used **only for auth identity**. There is also a Firebase Admin SDK on the server (token verification) — no Firestore app data.
- **Analytics:** Google Analytics 4 (`G-FPF6DRB75R`).
- **Hosting:** Railway (Docker). Blog is a second Vite app proxied at `/blog`.
- **Maps:** Leaflet + CARTO basemap tiles. No Google Maps key.

## Where user data lives (Supabase `public`)
| Table | Personal data | Notes |
|---|---|---|
| `toilets` | `user_id` (Firebase UID), `added_by_user_name` | Locations users add |
| `reviews` | `user_id`, `user_name`, `rating`, `text` | Public reviews |
| `reports` | `user_id`, `user_name`, `reason`, `comment` | Abuse/▢ reports (server-only) |
| `toilet_reports` | `user_id` | "doesn't exist" votes (server-only) |
| `blog_posts` | `author` (free text) | Admin content |

`user_id` columns store the **Firebase UID as a text string**, not a Supabase auth UID.

## Findings

### 🔴 CRITICAL — No Firebase↔Supabase auth bridge (data isolation is app-layer only)
The app authenticates with **Firebase**, but Supabase RLS does **not** use `auth.uid()` — clients use the anon key for reads only, and all writes go through the Express server using the **`service_role`** key. There is no Supabase JWT for the end user. **Implication:** per-user data isolation is enforced entirely in the Express layer (Firebase token verification + ownership checks), not by the database. This is acceptable **because** Branch A locked the database so the public/anon role is read-only and writes only happen server-side — but it must be understood for anything new:
- A `user_consent` table **cannot** rely on `auth.uid()` RLS. It must be written by the server (service_role) keyed to the Firebase UID, with RLS denying anon/authenticated entirely. (Implemented in the backend half, B6.)
- Account deletion must run server-side (service_role + Firebase Admin), not client-side. (B7.)

### 🟠 HIGH — Google Analytics fired before consent (FIXED in this branch)
`client/index.html` loaded `gtag.js` unconditionally on every page load, and the blog calls `ReactGA.initialize` unconditionally (`blog/src/App.tsx`). No consent banner existed. That is an ePrivacy/GDPR violation for an EU audience.
**Fix (B3):** GA is now hard-gated — `src/lib/consent.ts` only injects gtag after the user accepts; `index.html` no longer bootstraps GA; a `ConsentBanner` collects the decision; `/cookie-settings` allows withdrawal (which clears `_ga*` cookies). _The blog's `ReactGA.initialize` is gated in the backend half / blog pass._

### 🟡 MEDIUM — No privacy policy, terms, or cookie policy (FIXED in this branch)
None existed. Added `/privacy`, `/terms`, `/cookies`, `/cookie-settings` (BG/EN), linked from the profile menu and cross-linked in each page's footer. Legal/identity facts are marked `[PLACEHOLDER]` for the owner to complete (controller legal name + address, governing law).

### 🟡 MEDIUM — No account-deletion / erasure path (PLANNED B7)
No way for a user to delete their account or data. Backend half adds `DELETE /api/account` (re-auth → delete reviews/reports/consent → anonymize added toilets → delete Firebase account).

### 🟢 GOOD — No health data collected
Despite the IBS/IBD positioning, nothing stores a medical condition or tags one to a user. No Article-9 special-category data. The privacy policy states this explicitly and asks users not to include health info in reviews.

### 🟢 GOOD — EU data residency
Supabase is in `eu-central-1`. GA exports to Google (US) — disclosed in the privacy policy as an international transfer under SCCs/Data Privacy Framework.

## Cookies / local storage inventory
- **Essential:** `toilet-finder-language`, `toaletna-cookie-consent`, `toilet-map-visited` (localStorage); Firebase auth session (IndexedDB).
- **Analytics (consent only):** `_ga`, `_ga_*`, `_gid` (Google Analytics).

## Environment variables (client, public-by-design)
`VITE_FIREBASE_*`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable). Server-only secrets (`SUPABASE_SERVICE_KEY`, Firebase Admin creds) are never exposed to the client. Confirmed in Branch A.

## What remains (backend half)
B6 `user_consent` table + `POST /api/consent`; B7 account deletion; gate blog GA; B8 data-access audit doc; B10 `PRIVACY_IMPLEMENTATION.md`.
