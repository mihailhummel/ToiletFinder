# Dedup runbook — do it and test it, step by step

All SQL runs in the **Supabase SQL Editor** (Dashboard → your project → SQL Editor →
"New query"). For each step: open the file, copy its full contents, paste, click
**Run**, then check the result against "Expect". Run files **one at a time, in order**.

Files live in `supabase/migrations/dedup/`; the hard delete is one level up in
`supabase/migrations/hard_delete_soft_removed.sql`.

---

## Phase 0 — Prep (5 min)
1. Open the Supabase SQL Editor for the production project.
2. Optional but recommended: Dashboard → Table Editor → `toilets` → export to CSV,
   and the same for `reviews` (an off-database copy, in addition to the SQL backup).

---

## Phase 1 — Inspect schema · `00_inspect_schema.sql` (read-only)
- **Run it.**
- **Expect:**
  - `coordinates` → `data_type = jsonb`, `tags` → `jsonb`.
  - source breakdown: `osm 7782`, `geoapify 806`, `user 127` (total, incl. removed).
- **If `tags` or `coordinates` come back as `text`** (not jsonb): in files `02`, `03`,
  `04` replace `t.tags <> '{}'::jsonb` with `t.tags <> '{}'`, and
  `coordinates->>'lat'` with `(coordinates::jsonb)->>'lat'`. (Per the export they are
  jsonb, so you almost certainly won't need this.)

---

## Phase 2 — Backup · `01_backup.sql` (writes)
- **Run it.**
- **Expect:** the verification row shows `toilets_match = true` and `reviews_match = true`.
- **Do NOT continue** until both are true. If the CREATE fails saying the table already
  exists, a backup from today is already there — that's fine.

---

## Phase 3 — Preview + safety pre-flight · `02_preview_dedup.sql` (read-only)
- **Run it.** It returns several result sets — check each:
  1. Dedup preview: `to_remove = 5092`, `survivors = 3620`,
     `user_to_remove_MUST_BE_0 = 0`, `reviewed_to_remove_MUST_BE_0 = 0`.
  2. Review headline: `total_reviews = 39`, `distinct_reviewed_toilets = 35`,
     `reviewed_live = 35`, `reviewed_already_removed = 0`.
  3. `orphan_review_toilet_ids_EXPECT_0 = 0`.
  4. `coord_groups_with_multiple_reviewed_MUST_BE_0 = 0`.
- **If any *_MUST_BE_0 / EXPECT_0 is not 0 → STOP.** Do not run Phase 4. (Result set 4
  list shows the offending coordinates if so.)

---

## Phase 4 — The dedup (soft-delete) · `03_dedup_soft_delete.sql` (writes)
- **Run the whole file at once** (it's one `BEGIN … COMMIT`).
- The built-in guard aborts the entire transaction if any protected row would be
  removed, so a bad run changes nothing.
- **Expect** the final result row: `live_total = 3620`, `live_user_rows = 124`,
  `removed_today = 5092`, `protected_removed_today = 0`.
- If those look right it has already `COMMIT`ed. If something looks wrong and it did
  NOT error, run `ROLLBACK;` immediately (only works before the COMMIT executed).

---

## Phase 5 — Enrich survivors + fix review stats · `04_enrich_survivors.sql` (writes)
- **Run it.** Backfills survivor gaps from their removed siblings and recomputes
  `review_count` / `average_rating`. No row is deleted; only empty fields are filled.
- **Expect:** completes with no error. (Spot-check later in Phase 7/8.)

---

## Phase 6 — Normalize types · `05_normalize_types.sql` (writes, OPTIONAL)
- **Run it** if you want consistent categories (recommended). `bus_station` /
  `train_station` are intentionally left as-is.
- **Expect:** result 5a previews the rows that change; 5c shows the final type
  distribution (no `toilet`, `gas_station`, `shop`, or geoapify junk left).

---

## Phase 7 — Verify the database · `06_verify.sql` (read-only)
- **Run it.**
- **Expect:**
  - 6a: `rows = distinct_coords` (both 3620) → no duplicate coordinates remain.
  - 6b: `live_total = 3620`, `live_user_rows = 124`, `soft_removed_total = 5095`.
  - 6c: `protected_soft_removed_MUST_BE_0 = 0`.
  - 6d: `reviewed_but_removed_MUST_BE_0 = 0`.
  - 6e: type distribution looks sane.

---

## Phase 8 — Test the live map (frontend)
The app reads Supabase directly and filters `is_removed = false`, so changes show up
once the local cache is cleared.

1. Start the app locally:
   ```
   npm run dev
   ```
   (server + client via the root `dev` script). Open the client URL it prints.
2. **Clear the toilet cache** (it caches in localStorage), so you see fresh data:
   open DevTools console and run `localStorage.removeItem('toilet-map-cache')`, then
   hard-refresh. Or just use a private/incognito window.
3. **Check, around Sofia:**
   - No stacked/overlapping pins at the same spot (zoom in on previously dense areas).
   - Your known **user-added** pins are present.
   - Pins that had **reviews** still show their reviews (open the popup → stars/count).
   - Pin **colours** match category: public = blue, EKOTOI = green, gas station = red,
     mall = light blue, cafe/restaurant = yellow, bus/train + other = purple, baby
     changing = pink.
   - Spot-check a popup's title/availability/accessibility looks right (enrichment).
4. If anything's off, go to Phase 9 (rollback) before doing the hard delete.

---

## Phase 9 — Rollback (only if needed) · `07_rollback.sql`
- **Undo just this run's soft-deletes:** uncomment & run Option A
  (`is_removed = false … WHERE removed_at::date = CURRENT_DATE`).
- **Full restore (also reverts enrichment + normalization):** uncomment & run Option B
  (truncate + reinsert from `toilets_backup_20260603`), check `match = true`, COMMIT.

---

## Phase 10 — Make it permanent (later) · `../hard_delete_soft_removed.sql`
**Only after** Phase 8 looks good and you've let it sit as long as you want. This is
**irreversible** except from the backup table.
- **Run the whole file at once.**
- **Expect:** preview shows `toilets_to_delete ≈ 5095` (`user_rows_to_delete = 3` — the
  test rows); final row `soft_removed_remaining_MUST_BE_0 = 0`, `toilets_remaining = 3620`.
- The guard refuses to run if any soft-removed toilet has a review.

### Cleanup (optional, much later)
Once you're 100% confident, drop the backup tables (see the bottom of `07_rollback.sql`):
`DROP TABLE toilets_backup_20260603; DROP TABLE reviews_backup_20260603;`

---

## Quick reference — run order
```
00_inspect_schema      (read)
01_backup              (write)  → match = true
02_preview_dedup       (read)   → all *_MUST_BE_0 = 0
03_dedup_soft_delete   (write)  → protected_removed_today = 0
04_enrich_survivors    (write)
05_normalize_types     (write, optional)
06_verify              (read)   → rows = distinct_coords
-- test the map (Phase 8) --
hard_delete_soft_removed (write, standalone, later, irreversible)
```
