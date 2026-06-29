# Domestos Admin Manager

A **read-only campaign dashboard** for the Domestos × toaletna.com initiative
(29.06–30.08.2026), served at **domestos.toaletna.com**. It lets the Domestos /
agency team self-serve track the campaign: new locations, reviews, active
participants, and — the centrepiece — a fair **leaderboard** of how locations are
performing.

It is a **standalone Railway service** (mirrors `blog/`), completely separate from
the main app. To switch the whole thing off when the campaign ends: **delete the
Railway service and its custom domain.** No changes to the main app are required.

## How it works

- `server.mjs` — Express. Serves the built Vite frontend **and** a single gated API
  endpoint (`GET /api/dashboard`) plus `GET /api/me`. Same origin → no CORS.
- `lib/auth.mjs` — the only security boundary. Verifies the visitor's Firebase ID
  token (Admin SDK) and allows **site admins** (`admin` claim) OR emails listed in
  `DOMESTOS_ALLOWLIST`. Allowlisted staff get view-only access and hold no admin
  claim, so they cannot touch the live map.
- `lib/dashboard.mjs` — reads `toilets` + `reviews` from Supabase (service key) and
  computes everything, cached 60s.
- `lib/ranking.mjs` — the **Bayesian weighted rating** (IMDb Top-250 method). See
  the in-app "Как се определя класирането?" panel for the plain-language explanation.

### Ranking in one line

```
score = (v / (v + m)) · R + (m / (v + m)) · C
```

`R` = location average, `v` = review count, `m` = confidence constant (default 5),
`C` = mean rating across the set. A 4.5★/20-reviews location beats a 5.0★/1-review
one — exactly as intended.

## Local development

```powershell
# from Domestos-Admin-Manager/
Copy-Item .env.example .env   # then fill in the values (same as the main app)
npm install
npm run test:ranking          # sanity-check the leaderboard math (no deps needed)
npm run build                 # build the frontend  (run from PowerShell, NOT Git Bash)
npm start                     # serve at http://localhost:4000
```

For frontend-only iteration: `npm run dev` (Vite on :4001, proxies /api to :4000).

## Deploy (Railway)

1. **Prerequisite:** ensure the `is_domestos` column exists in Supabase
   (`supabase/migrations/add_is_domestos.sql`) and flag the special locations via the
   main app's admin Add/Edit modal. The Domestos tab is empty until at least one
   location is flagged.
2. New Railway service from this repo, **Root Directory = `Domestos-Admin-Manager`**.
3. Set the env vars from `.env.example` (Supabase + Firebase Admin + `DOMESTOS_ALLOWLIST`
   + `VITE_FIREBASE_*`).
4. Add the custom domain **domestos.toaletna.com** to the service; add the DNS CNAME.
5. In **Firebase → Authentication → Settings → Authorized domains**, add
   `domestos.toaletna.com` (Google sign-in fails otherwise).

## Disable when the campaign ends

Delete the Railway service + custom domain. (The folder can stay in the repo.)
