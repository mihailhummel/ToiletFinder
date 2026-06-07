-- ============================================================
-- DEDUP ROLLBACK — undo the migration
--
-- Two options. Pick ONE. Read before running.
-- ============================================================

-- ------------------------------------------------------------
-- OPTION A — Undo only the soft-delete from step 03 (today's run).
-- Re-shows every row this migration hid. Note: this also un-removes
-- any row that happened to be soft-removed earlier today by other
-- means; if that's a concern, match on the exact removed_at timestamp
-- that step 03 printed instead of CURRENT_DATE.
--
-- This does NOT revert the enrichment (04) or type normalization (05).
-- For a clean slate, use Option B.
-- ------------------------------------------------------------
-- UPDATE public.toilets
-- SET is_removed = false, removed_at = NULL
-- WHERE removed_at::date = CURRENT_DATE;


-- ------------------------------------------------------------
-- OPTION B — Full restore from the step 01 backup (reverts EVERYTHING:
-- soft-deletes, enrichment, and type normalization).
-- Wrapped in a transaction; review the count, then COMMIT.
-- ------------------------------------------------------------
-- BEGIN;
--   TRUNCATE public.toilets;
--   INSERT INTO public.toilets SELECT * FROM public.toilets_backup_20260603;
--   SELECT
--     (SELECT count(*) FROM public.toilets)                 AS restored,
--     (SELECT count(*) FROM public.toilets_backup_20260603) AS backup,
--     (SELECT count(*) FROM public.toilets)
--        = (SELECT count(*) FROM public.toilets_backup_20260603) AS match;
-- COMMIT;


-- ------------------------------------------------------------
-- CLEANUP (only once you are confident the dedup is correct and
-- permanent — this drops the safety net):
-- ------------------------------------------------------------
-- DROP TABLE IF EXISTS public.toilets_backup_20260603;
-- DROP TABLE IF EXISTS public.reviews_backup_20260603;
