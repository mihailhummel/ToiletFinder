-- ============================================================
-- DEDUP STEP 3 — Soft-delete duplicates (THE destructive-by-intent step)
--
-- Soft-deletes (is_removed = true, removed_at = now()) every non-survivor
-- in each exact-coordinate group, using the same ranking as the preview.
-- NOTHING is hard-deleted. Fully reversible via 06_rollback.sql.
--
-- Safety: this whole script runs in ONE transaction and a hard guard
-- (DO block) RAISES an exception — aborting and rolling back the entire
-- transaction — if even one protected row (source='user' or reviewed)
-- would be removed. The COMMIT only runs if the guard passes.
--
-- Run AFTER 01_backup.sql, and after 02_preview_dedup.sql looks right.
-- Run the whole file at once in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- 3a. HARD GUARD: abort before mutating if the removal set contains any
--     protected row. (Re-runs the exact ranking used by the UPDATE.)
DO $$
DECLARE
  v_bad int;
BEGIN
  WITH ranked AS (
    SELECT
      t.id,
      t.source,
      (t.id IN (SELECT toilet_id FROM public.reviews)) AS has_review,
      ROW_NUMBER() OVER (
        PARTITION BY round((t.coordinates->>'lat')::numeric, 7),
                     round((t.coordinates->>'lng')::numeric, 7)
        ORDER BY
          (t.id IN (SELECT toilet_id FROM public.reviews))   DESC,
          (t.source = 'user')                                DESC,
          (t.tags IS NOT NULL AND t.tags <> '{}'::jsonb)     DESC,
          CASE lower(t.type)
            WHEN 'public'        THEN 100
            WHEN 'ekotoi'        THEN 90
            WHEN 'gas-station'   THEN 85
            WHEN 'gas_station'   THEN 85
            WHEN 'mall'          THEN 80
            WHEN 'restaurant'    THEN 70
            WHEN 'cafe'          THEN 70
            WHEN 'bus_station'   THEN 40
            WHEN 'train_station' THEN 40
            WHEN 'other'         THEN 30
            WHEN 'toilet'        THEN 20
            ELSE 0
          END                                                DESC,
          CASE t.source WHEN 'osm' THEN 2 WHEN 'geoapify' THEN 1 ELSE 0 END DESC,
          t.created_at ASC NULLS LAST
      ) AS rn
    FROM public.toilets t
    WHERE t.is_removed = false
  )
  SELECT count(*) INTO v_bad
  FROM ranked
  WHERE rn > 1 AND (source = 'user' OR has_review);

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ABORT: % protected row(s) (user/reviewed) are in the removal set; nothing changed', v_bad;
  END IF;
END $$;

-- 3b. Soft-delete every non-survivor.
WITH ranked AS (
  SELECT
    t.id,
    ROW_NUMBER() OVER (
      PARTITION BY round((t.coordinates->>'lat')::numeric, 7),
                   round((t.coordinates->>'lng')::numeric, 7)
      ORDER BY
        (t.id IN (SELECT toilet_id FROM public.reviews))   DESC,
        (t.source = 'user')                                DESC,
        (t.tags IS NOT NULL AND t.tags <> '{}'::jsonb)     DESC,
        CASE lower(t.type)
          WHEN 'public'        THEN 100
          WHEN 'ekotoi'        THEN 90
          WHEN 'gas-station'   THEN 85
          WHEN 'gas_station'   THEN 85
          WHEN 'mall'          THEN 80
          WHEN 'restaurant'    THEN 70
          WHEN 'cafe'          THEN 70
          WHEN 'bus_station'   THEN 40
          WHEN 'train_station' THEN 40
          WHEN 'other'         THEN 30
          WHEN 'toilet'        THEN 20
          ELSE 0
        END                                                DESC,
        CASE t.source WHEN 'osm' THEN 2 WHEN 'geoapify' THEN 1 ELSE 0 END DESC,
        t.created_at ASC NULLS LAST
    ) AS rn
  FROM public.toilets t
  WHERE t.is_removed = false
)
UPDATE public.toilets t
SET is_removed = true,
    removed_at = now()
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- 3c. Post-update assertion + counts. protected_removed_today MUST be 0.
SELECT
  (SELECT count(*) FROM public.toilets WHERE is_removed = false)                       AS live_total,        -- expect 3620
  (SELECT count(*) FROM public.toilets WHERE is_removed = false AND source = 'user')   AS live_user_rows,    -- expect 124 (3 user rows were already removed pre-migration)
  (SELECT count(*) FROM public.toilets WHERE removed_at::date = CURRENT_DATE)          AS removed_today,     -- expect 5092
  (SELECT count(*) FROM public.toilets t
     WHERE t.is_removed = true AND t.removed_at::date = CURRENT_DATE
       AND (t.source = 'user' OR t.id IN (SELECT toilet_id FROM public.reviews)))      AS protected_removed_today; -- MUST be 0

-- If the numbers above look right, COMMIT. Otherwise run ROLLBACK; instead.
COMMIT;
