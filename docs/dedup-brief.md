# toaletna.com — Toilet De‑duplication Brief for Claude Code

**Goal:** Remove duplicate toilet locations (rows sharing the same geo coordinate) from the
Supabase `toilets` table so markers stop stacking, **without losing any important data**.

This is a **destructive-by-intent** task, so the whole plan is built around being **reversible**:
we **soft-delete** (flag) instead of hard-deleting, after taking a full backup. Hard deletion, if
ever wanted, happens only as a separate, later, manual step.

---

## 0. Non‑negotiable safety rules (read first)

1. **NEVER remove a row where `source = 'user'`.** These are user-submitted locations. Hard rule.
2. **NEVER remove a row that has at least one review** (i.e. its `id` appears in `reviews.toilet_id`).
   This includes auto-generated (`osm`/`geoapify`) rows that happen to have reviews.
3. **Do not hard-DELETE anything in the main run.** Soft-delete only (`is_removed = true`).
4. **Take a full backup before any write** (see Step 2).
5. Run everything inside a **transaction** and preview row counts **before** committing.
6. After the run, **assert** that 0 protected rows were removed. If the assertion fails, ROLLBACK.

If any step is ambiguous, stop and report rather than guess.

---

## 1. Data model (verified from the current export)

Table `public.toilets`, ~8,715 rows. Relevant columns:

| column              | notes |
|---------------------|-------|
| `id` (text, PK)     | nanoid for osm/geoapify; `toilet_<timestamp>_<rand>` for user rows |
| `coordinates`       | JSON/JSONB: `{"lat":..,"lng":..}` — **the dedup key** |
| `type`              | app/source category: `toilet, public, restaurant, mall, cafe, EKOTOI, gas_station, gas-station, bus_station, train_station, other` (osm/user) and junk values `service, amenity, building, commercial, access, access_limited, internet_access` (geoapify) |
| `source`            | `osm` (7782), `geoapify` (806), `user` (127) |
| `tags`              | JSON. Populated for osm; **always `{}` for geoapify**; `{}` for user |
| `notes`, `title`, `accessibility`, `access_type`, `has_baby_changing` | enrichment fields |
| `is_removed` (bool) | **soft-delete flag — already used by the app**; confirm the frontend filters on `is_removed = false` |
| `removed_at`        | timestamp to stamp on soft-delete |
| `review_count`, `average_rating` | ⚠️ **STALE — do not trust.** Recompute from `reviews`. |

Table `public.reviews`: columns `id, toilet_id, user_id, user_name, rating, text, created_at, updated_at`.
`reviews.toilet_id` → `toilets.id`. 39 reviews across 35 distinct toilets.

**Verified facts that make this safe:**
- All 127 `source='user'` rows have **unique** coordinates (never in a duplicate group).
- Every reviewed toilet sits in a group where it is the **only** protected row → no protected-vs-protected conflicts.
- Expected outcome: **8715 → 3623 survivors**, **5092 soft-removed**, all `osm`/`geoapify`.

**FIRST ACTION for Claude Code:** confirm the real column types in Supabase, especially whether
`coordinates` and `tags` are `jsonb` or `text`. All SQL below assumes `jsonb`; adjust operators
(`->>`) accordingly if they are `text` (you may need `(coordinates::jsonb)->>'lat'`).

---

## 2. Backup (do this before anything else)

```sql
-- Full physical backup of both tables, timestamped.
CREATE TABLE toilets_backup_20260603 AS TABLE public.toilets;
CREATE TABLE reviews_backup_20260603 AS TABLE public.reviews;
```
Also export both tables to CSV from the Supabase dashboard as an off-database copy.
**Do not proceed until the backup tables exist and row counts match the originals.**

---

## 3. Investigate the frontend BEFORE choosing which `type` wins (this is the "correct tag" step)

The owner wants duplicates merged into **the type the frontend renders correctly**. You must derive
this from the actual app code, not guess. In the frontend repo, search for where `type` and `tags`
are consumed and build a definitive picture:

- Search for: `\.type`, `toilet.type`, `type ===`, `switch (`, `getIcon`, `markerIcon`, `iconFor`,
  `categoryFor`, `TYPE`, `TYPES`, `typeLabel`, `tags`, `amenity`.
- Identify:
  1. **The canonical set of `type` values the UI explicitly handles** (icon, color, label, filter list).
  2. **The fallback/default** rendering for any unrecognized `type`.
  3. Whether `tags` is read anywhere for display (e.g. the detail popup), so we know which fields matter.

From that, produce a concrete ordered **`type_priority`** ranking (most-correct/most-specific first,
fallback/junk last) and a **`type_normalization` map** (e.g. unify `gas-station`→`gas_station`; decide
whether `public` or `toilet` is the canonical category for `amenity:toilets`; map geoapify junk types
like `service`/`building`/`amenity` to the right real category or to the app's default).

**Write the finalized `type_priority` and `type_normalization` into the migration before running it.**
Until the frontend is checked, use this provisional ranking (toilet-amenity categories above
fuel/transport, with geoapify junk last):

```
toilet > public > EKOTOI > restaurant ≈ cafe > mall > gas_station(=gas-station)
       > bus_station ≈ train_station > other > [geoapify junk: service, amenity, building,
         commercial, access, access_limited, internet_access]
```

---

## 4. The de-duplication algorithm

**Duplicate key:** exact coordinate match — `(lat, lng)` from `coordinates`. Round both to 7 decimals
to avoid float noise. (Duplicates here come from re-imports of identical source data, so coordinates
match exactly; do **not** do fuzzy/proximity merging in this run — that risks merging genuinely
distinct toilets and needs human review.)

**Within each coordinate group, pick exactly ONE survivor** by this ordered priority (each tier breaks
ties for the next):

1. **Has a review** (`id` in `reviews.toilet_id`) — keep it.
2. **`source = 'user'`** — keep it.
3. **Non-empty `tags`** (`tags <> '{}'::jsonb` and not null) — real data beats empty.
4. **`type_priority`** (from Step 3) — most-correct rendering type wins.
5. **Source quality:** `osm` > `geoapify`.
6. **Oldest `created_at`** (stable tiebreak; preserves the earliest record/id).

All non-survivors in the group → soft-removed.

**Optional enrichment (recommended) before removing siblings:** if the survivor is missing data that a
sibling has, backfill the survivor so nothing useful is lost when the siblings disappear:
- `tags`: if survivor's is `{}`/null and a sibling has populated tags, copy the richest sibling's tags.
- `notes`, `title`, `accessibility`, `access_type`: fill survivor's nulls from siblings.
- `has_baby_changing`: `true` if any sibling in the group is `true`.
- `type`: set to the canonical value via `type_normalization`.

**Recompute review stats for survivors** (because `review_count` is stale):
- `review_count = COUNT(reviews)` for that `id`, `average_rating = AVG(rating)` (0 / null if none).

---

## 5. Implementation (preview → assert → commit)

Work on a clear coordinate key. Example using a CTE that ranks rows per coordinate:

```sql
BEGIN;

-- 5a. Rank rows within each exact coordinate group.
WITH ranked AS (
  SELECT
    t.id,
    t.source,
    (t.id IN (SELECT DISTINCT toilet_id FROM public.reviews)) AS has_review,
    round((t.coordinates->>'lat')::numeric, 7) AS lat,
    round((t.coordinates->>'lng')::numeric, 7) AS lng,
    ROW_NUMBER() OVER (
      PARTITION BY round((t.coordinates->>'lat')::numeric,7),
                   round((t.coordinates->>'lng')::numeric,7)
      ORDER BY
        (t.id IN (SELECT toilet_id FROM public.reviews)) DESC,        -- 1 reviews
        (t.source = 'user')                               DESC,        -- 2 user
        (t.tags IS NOT NULL AND t.tags <> '{}'::jsonb)     DESC,        -- 3 has tags
        CASE t.type                                                     -- 4 type priority
          WHEN 'toilet' THEN 100 WHEN 'public' THEN 90 WHEN 'EKOTOI' THEN 80
          WHEN 'restaurant' THEN 70 WHEN 'cafe' THEN 70 WHEN 'mall' THEN 60
          WHEN 'gas_station' THEN 50 WHEN 'gas-station' THEN 50
          WHEN 'bus_station' THEN 40 WHEN 'train_station' THEN 40
          WHEN 'other' THEN 30 ELSE 0 END                  DESC,        -- (junk geoapify = 0)
        CASE t.source WHEN 'osm' THEN 2 WHEN 'geoapify' THEN 1 ELSE 0 END DESC, -- 5 source
        t.created_at ASC                                                -- 6 oldest
    ) AS rn
  FROM public.toilets t
  WHERE t.is_removed = false               -- only consider live rows
)
-- 5b. PREVIEW: how many will be removed, and confirm none are protected.
SELECT
  COUNT(*) FILTER (WHERE rn > 1)                                   AS to_remove,
  COUNT(*) FILTER (WHERE rn > 1 AND source = 'user')               AS user_to_remove_MUST_BE_0,
  COUNT(*) FILTER (WHERE rn > 1 AND has_review)                    AS reviewed_to_remove_MUST_BE_0,
  COUNT(*) FILTER (WHERE rn = 1)                                   AS survivors
FROM ranked;
-- EXPECT roughly: to_remove≈5092, survivors≈3623, the two *_MUST_BE_0 = 0.
-- If either MUST_BE_0 is not 0  ->  ROLLBACK and investigate. Do NOT proceed.
```

If the preview is correct, apply the soft-delete in the same transaction:

```sql
WITH ranked AS ( /* ...exact same CTE as above... */ )
UPDATE public.toilets t
SET is_removed = true,
    removed_at = now()
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- Final assertion inside the transaction:
SELECT
  (SELECT count(*) FROM public.toilets WHERE is_removed = false AND source='user')                AS live_user_rows,   -- expect 127
  (SELECT count(*) FROM public.toilets WHERE is_removed = false)                                  AS live_total,       -- expect ~3623
  (SELECT count(*) FROM public.toilets t WHERE t.is_removed = true
       AND (t.source='user' OR t.id IN (SELECT toilet_id FROM public.reviews)))                   AS protected_removed; -- MUST be 0
```

If `protected_removed = 0` and counts look right → `COMMIT;` else → `ROLLBACK;`.

**Run the optional enrichment (Step 4) and the review_count recompute as separate UPDATE statements
on the surviving rows** (also inside a transaction, after the dedup commit). Recompute example:

```sql
UPDATE public.toilets t SET
  review_count   = COALESCE(s.cnt, 0),
  average_rating = COALESCE(s.avg, 0)
FROM (SELECT toilet_id, count(*) cnt, avg(rating)::numeric(3,2) avg
      FROM public.reviews GROUP BY toilet_id) s
WHERE t.id = s.toilet_id AND t.is_removed = false;
```

---

## 6. Post-run verification

- Total live rows ≈ **3623**; live `source='user'` = **127**; distinct live coordinates = live total (no dup coords remain):
  ```sql
  SELECT count(*) AS rows,
         count(DISTINCT (round((coordinates->>'lat')::numeric,7),
                         round((coordinates->>'lng')::numeric,7))) AS distinct_coords
  FROM public.toilets WHERE is_removed = false;   -- the two numbers should be EQUAL
  ```
- Load the map in staging: confirm no stacked markers, all user pins present, all reviewed pins present,
  and each surviving pin shows the expected icon/category (validates the Step 3 `type_priority`).

---

## 7. Rollback

- Quick undo of this migration only:
  ```sql
  UPDATE public.toilets SET is_removed = false, removed_at = NULL
  WHERE removed_at IS NOT NULL AND removed_at::date = CURRENT_DATE;  -- or match the exact timestamp used
  ```
  (Safer: record the exact `now()` timestamp used and match on it.)Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.Follow the plan in docs/dedup-brief.md. Connect to Supabase, verify the counts against the live DB, and do not paste table data — query it directly.
- Full restore from backup:
  ```sql
  -- e.g. swap tables, or:
  TRUNCATE public.toilets;
  INSERT INTO public.toilets SELECT * FROM toilets_backup_20260603;
  ```

---

## 8. Optional later phase (NOT in this run)

- **Hard delete** the soft-removed rows once the map has been verified live for a while:
  `DELETE FROM public.toilets WHERE is_removed = true AND removed_at < now() - interval '30 days';`
- **Fuzzy/near-duplicate** cleanup (points a few meters apart, not exactly equal) — needs manual review;
  do **not** automate alongside this run.
- Add a DB **unique constraint / partial index** on rounded `(lat,lng)` going forward to prevent new
  duplicate imports, and de-duplicate at import time.