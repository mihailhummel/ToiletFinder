# Toilet de-duplication — manual SQL migrations

Run these in the **Supabase SQL Editor**, in order. Each file is self-contained
and commented. The whole operation is **soft-delete only** (no hard deletes) and
fully reversible from the step-01 backup.

| File | Writes? | Purpose |
|------|---------|---------|
| `00_inspect_schema.sql` | no | Confirm column types (esp. `tags` is `jsonb`) + baseline counts. **Run first.** |
| `01_backup.sql` | yes | Create `*_backup_20260603` tables. Do not proceed until counts match. |
| `02_preview_dedup.sql` | no | Preview removal counts (two `*_MUST_BE_0` = 0) **+ review-integrity pre-flight** (section 2b): confirms no two distinct reviewed toilets share a coordinate, no orphan reviews, none already removed. |
| `03_dedup_soft_delete.sql` | yes | The dedup. Hard guard aborts the transaction if any protected row is in the removal set. |
| `04_enrich_survivors.sql` | yes | Backfill survivor gaps from siblings + recompute `review_count`/`average_rating`. |
| `05_normalize_types.sql` | yes | **Optional.** Canonicalise `type` strings. Keeps `bus_station`/`train_station` as-is. |
| `06_verify.sql` | no | Confirm no duplicate coords, 127 user rows, 0 protected rows removed. |
| `07_rollback.sql` | — | Commented undo options (per-run undo or full restore from backup). |

## Protected rows (never removed)
- `source = 'user'`
- any row whose `id` appears in `reviews.toilet_id`

The reviews export (39 reviews / 35 distinct toilets) confirmed **15 of the 35
reviewed toilets are osm/geoapify rows, not user rows** — so protection must be
by `id IN reviews`, not by `source`. The migration does exactly that.

Step 03's guard `RAISE EXCEPTION`s (rolling back the whole transaction) if either
class is ever in the removal set, so a bad run changes nothing.

## Survivor selection priority
1. has a review → 2. `source='user'` → 3. non-empty `tags` →
4. `type_priority` (public > EKOTOI > gas-station > mall > restaurant≈cafe >
   bus_station≈train_station > other > toilet > geoapify junk) →
5. `osm` > `geoapify` → 6. oldest `created_at`.

`type_priority` was derived from the frontend, not guessed: pins are distinguished
only by **colour** (`getToiletMarkerColor` in `client/src/components/Map.tsx`), with
`public` rendering best and unrecognised types (incl. the literal `toilet`) falling
back to purple "other". Type *filtering* in `FilterPanel` is dead code (`filters`
state in `App.tsx` is set but never read), so collapsing types cannot hide pins.

## If `tags` / `coordinates` turn out to be `text`, not `jsonb`
`00` will reveal this. If so, in files 02–04 replace `t.tags <> '{}'::jsonb` with
`t.tags <> '{}'`, and `coordinates->>'lat'` with `(coordinates::jsonb)->>'lat'`.

## Hard delete (separate, standalone)
`../hard_delete_soft_removed.sql` (one level up, intentionally NOT part of this
sequence) permanently deletes every `is_removed = true` row — the 5092 dedup
duplicates plus the 3 pre-existing user test rows. It is **irreversible** except
via the step-01 backup, guards against deleting any reviewed toilet, and clears
dependent `reports`/`toilet_reports` first. Run it on its own, only after the
live map has been verified.

## Other later phases (NOT scripted here)
- Add a unique partial index on rounded `(lat,lng)` to stop new duplicate imports.
- Fuzzy/near-duplicate cleanup (points a few metres apart) — needs human review.
