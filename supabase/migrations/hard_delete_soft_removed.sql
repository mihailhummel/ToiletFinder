-- ============================================================
-- STANDALONE — Permanently HARD-DELETE all soft-removed toilets
--
-- This is NOT part of the dedup 00–07 sequence. Run it on its own,
-- and only AFTER:
--   * 01_backup.sql has been run (toilets_backup_20260603 exists), and
--   * the live map has been verified and you are sure you want the
--     soft-removed rows gone for good.
--
-- It permanently deletes every row where is_removed = true. After the
-- dedup that is 5095 rows (5092 dedup duplicates + 3 user test rows
-- — "TESTVAM", "EKOTOI", and one garbled-title cafe — that were already
-- soft-removed before the dedup). If you run this BEFORE the dedup it
-- will only delete those 3 currently-removed rows.
--
-- IRREVERSIBLE except by restoring from toilets_backup_20260603
-- (see dedup/07_rollback.sql, Option B).
--
-- Verified against the 2026-06-03 export: none of the soft-removed rows
-- have reviews (0) or reports (0), so the delete is FK-safe. The guards
-- below re-check at run time regardless.
--
-- Run the whole file at once in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- GUARD: never hard-delete a toilet that has reviews. Aborts (and rolls
-- back) the whole transaction if any soft-removed row is reviewed.
DO $$
DECLARE
  v_reviewed int;
BEGIN
  SELECT count(*) INTO v_reviewed
  FROM public.toilets t
  WHERE t.is_removed = true
    AND t.id IN (SELECT toilet_id FROM public.reviews);
  IF v_reviewed > 0 THEN
    RAISE EXCEPTION 'ABORT: % soft-removed toilet(s) have reviews; refusing to hard-delete', v_reviewed;
  END IF;
END $$;

-- Preview exactly what will be deleted (expect ~5095 after dedup;
-- user_rows_to_delete = 3, the pre-existing test rows).
SELECT
  count(*)                                  AS toilets_to_delete,
  count(*) FILTER (WHERE source = 'user')   AS user_rows_to_delete,
  count(*) FILTER (WHERE source = 'osm')    AS osm_to_delete,
  count(*) FILTER (WHERE source = 'geoapify') AS geoapify_to_delete
FROM public.toilets
WHERE is_removed = true;

-- Clear dependent rows first so foreign keys don't block the delete.
-- (Both reference toilets.id; for the soft-removed set these are 0 rows,
--  but this keeps the migration correct if that ever changes.)
DELETE FROM public.reports
WHERE toilet_id IN (SELECT id FROM public.toilets WHERE is_removed = true);

DELETE FROM public.toilet_reports
WHERE toilet_id IN (SELECT id FROM public.toilets WHERE is_removed = true);

-- The permanent delete.
DELETE FROM public.toilets
WHERE is_removed = true;

-- Confirm. soft_removed_remaining MUST be 0; toilets_remaining ~3620.
SELECT
  (SELECT count(*) FROM public.toilets)                          AS toilets_remaining,
  (SELECT count(*) FROM public.toilets WHERE is_removed = true)  AS soft_removed_remaining_MUST_BE_0;

-- If the numbers look right, COMMIT. Otherwise run ROLLBACK; instead.
COMMIT;


-- ------------------------------------------------------------
-- OPTIONAL VARIANT — only purge rows removed more than 30 days ago
-- (the brief's safer "let it sit, then clean up" approach). Use INSTEAD
-- of the DELETE above if you'd rather age-gate the purge. Note: the 3
-- pre-existing test rows have a NULL removed_at, so this variant would
-- NOT catch them — delete those explicitly by id if needed.
-- ------------------------------------------------------------
-- DELETE FROM public.reports
-- WHERE toilet_id IN (SELECT id FROM public.toilets
--                     WHERE is_removed = true AND removed_at < now() - interval '30 days');
-- DELETE FROM public.toilet_reports
-- WHERE toilet_id IN (SELECT id FROM public.toilets
--                     WHERE is_removed = true AND removed_at < now() - interval '30 days');
-- DELETE FROM public.toilets
-- WHERE is_removed = true AND removed_at < now() - interval '30 days';
