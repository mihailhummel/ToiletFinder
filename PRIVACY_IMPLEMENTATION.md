# Privacy / GDPR Implementation — toaletna.com

Companion to `AUDIT_REPORT.md`. Documents the privacy-compliance work (Branch B)
and the manual steps required to finish going live.

## Overview of changes

**Consent & analytics (ePrivacy hard-gate)**
- `client/src/lib/consent.ts` — consent storage (`localStorage` `toaletna-cookie-consent` = `{status,version,timestamp}`) + Google Analytics loader that injects `gtag.js` **only after Accept**; reject/withdraw deletes `_ga*` cookies.
- `client/src/components/ConsentBanner.tsx` — BG/EN banner, equal-weight Accept/Reject, links to /privacy and /cookies; shown only when no decision (or version is stale).
- `client/index.html` — removed the unconditional GA bootstrap **and** the googletagmanager preconnect.
- `client/src/main.tsx` — `initAnalytics()` loads GA on startup only if previously accepted.
- `blog/src/App.tsx` — blog GA now also gated on the shared consent (same-origin localStorage).

**Legal pages (BG/EN, with `[PLACEHOLDER]` legal facts)**
- `/privacy`, `/terms`, `/cookies` (`client/src/pages/legal/*`), plus interactive `/cookie-settings`.
- `client/src/App.tsx` — added a `wouter` router (map is the default route; legal pages are siblings).
- Footer links: each legal page footer + the profile-menu (`NavMenu.tsx`).

**Consent record on sign-in (B6)**
- Table `public.user_consent` (append-only, PK `(firebase_uid, consent_version)`).
- `POST /api/consent` (`server/routes.ts`) → `storage.recordConsent` (insert-once).
- `client/src/hooks/useAuth.ts` records consent once per version on sign-in.

**Account deletion (B7)**
- `DELETE /api/account` (`server/routes.ts`) → `storage.deleteUserData` (delete reviews/reports/toilet_reports; anonymize added toilets; best-effort consent cleanup) → `auth.deleteUser` (Firebase Admin).
- UI: "Delete account" in the profile menu → destructive `confirmDialog` → sign-out + `notify`.

## Files created
- `client/src/lib/consent.ts`, `client/src/components/ConsentBanner.tsx`
- `client/src/pages/legal/{LegalLayout,PrivacyPolicy,TermsOfService,CookiePolicy,CookieSettings}.tsx`
- `supabase/migrations/manual/05_user_consent.sql`
- `AUDIT_REPORT.md`, `PRIVACY_IMPLEMENTATION.md`

## Files modified
- `client/src/App.tsx`, `client/src/main.tsx`, `client/index.html`
- `client/src/hooks/useAuth.ts`, `client/src/contexts/LanguageContext.tsx`, `client/src/components/NavMenu.tsx`
- `server/routes.ts`, `server/storage.ts`, `server/supabase-storage.ts`
- `blog/src/App.tsx`, `client/package.json` (wouter)

## MANUAL ACTIONS REQUIRED (owner)
1. **Run SQL** in Supabase SQL Editor: `supabase/migrations/manual/05_user_consent.sql` (creates `user_consent`). Do this **before/with** deploying the backend half — `deleteUserData` tolerates its absence, but `/api/consent` needs it.
2. **Fill the `[PLACEHOLDER]`s** in the legal pages: data-controller legal name + address (`PrivacyPolicy.tsx`), governing law (`TermsOfService.tsx`). They render highlighted so they're easy to find.
3. **Bump `CONSENT_VERSION`** in `client/src/lib/consent.ts` whenever the cookie/privacy terms materially change — this re-prompts everyone and records a fresh consent row.

## Firebase requirements
- Account deletion uses the Firebase Admin SDK server-side (`auth.deleteUser`) — already configured via `firebase-admin-config`. No client Firebase change.

## Supabase requirements
- Run `05_user_consent.sql`. `user_consent` is service_role-only (no anon/authenticated access), consistent with the Branch A lockdown.

## Google Analytics requirements
- Measurement ID `G-FPF6DRB75R` is hardcoded (public) in `lib/consent.ts` and gated on consent. GA is configured with `anonymize_ip` + ad-signals off. (Optional alternative: Google Consent Mode v2 with `default = denied` — would load gtag in a cookieless state and send pingbacks before consent. We chose the stricter hard-gate; switching later means loading gtag in `main.tsx` with `consent default denied` and calling `consent update` on Accept.)

---

## B8 — Data-access security audit (summary)

Per-user isolation is enforced at the **Express layer** (Firebase token verification + ownership checks), not by Supabase RLS, because there is **no Firebase↔Supabase auth bridge** (see `AUDIT_REPORT.md`). After the Branch A lockdown this is sound:

| Severity | Finding | Status |
|---|---|---|
| HIGH | No Firebase↔Supabase bridge → RLS can't use `auth.uid()` | Mitigated: public roles are read-only; all writes via service_role server; consent/deletion are server-only keyed to Firebase UID |
| (was CRITICAL) | anon could INSERT/UPDATE/DELETE all core tables | **Fixed** in Branch A (`02_security_lockdown.sql`) |
| (was HIGH) | Any signed-up user could write `blog_posts` | **Fixed** — admin-email allowlist |
| INFO | `user_consent` table | service_role-only (RLS on, no public policies) |

No table-wide public writes remain (verified live via `get_advisors` + grants). Corrected RLS already shipped in Branch A; no further RLS changes needed for the privacy work beyond `05_user_consent.sql`.

## Remaining risks / follow-ups
- **`[PLACEHOLDER]` legal facts** must be filled before this is truly production-legal.
- **Blog consent UX**: the blog respects the shared consent decision but has no banner of its own; a visitor landing directly on `/blog` with no prior decision simply gets no analytics until they set a choice on the main site. (Acceptable; a blog banner could be added later.)
- **Account-deletion reauth**: deletion is authorized by a fresh Firebase ID token (max 1h) verified server-side. Optional hardening: require `reauthenticateWithPopup` client-side for extra assurance before calling `DELETE /api/account`.
- Infra items from the security audit remain optional (Postgres upgrade, leaked-password protection, MFA, Cloudflare WAF, disable public signup).

## Final summary
1. **Changes:** consent hard-gate for GA (main + blog), bilingual legal pages + cookie settings, client router, consent audit table + endpoint, GDPR account deletion.
2. **Files modified:** App.tsx, main.tsx, index.html, useAuth.ts, LanguageContext.tsx, NavMenu.tsx, server routes/storage/supabase-storage, blog/App.tsx, client/package.json.
3. **Files created:** consent lib + banner, 5 legal page components, 05_user_consent.sql, AUDIT_REPORT.md, PRIVACY_IMPLEMENTATION.md.
4. **Manual actions:** run 05_user_consent.sql; fill legal `[PLACEHOLDER]`s; bump CONSENT_VERSION on future terms changes.
5. **Security findings:** no open data-access issues post-Branch-A; isolation is app-layer by design (documented).
6. **Remaining risks:** placeholder legal facts; blog has no own banner; optional deletion reauth; optional infra hardening.
