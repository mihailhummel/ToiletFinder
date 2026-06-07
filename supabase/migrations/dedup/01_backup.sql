-- ============================================================
-- DEDUP STEP 1 — Full backup (run BEFORE any write)
--
-- Physical, timestamped copies of both tables. These are the
-- reversibility safety net — do NOT proceed to step 03 until the
-- backup tables exist and their row counts match the originals.
--
-- Also export both tables to CSV from the Supabase dashboard as an
-- off-database copy.
--
-- Run in the Supabase SQL Editor.
-- ============================================================

-- 1a. Create the backups (fails loudly if they already exist, which
--     prevents accidentally overwriting an earlier backup).
CREATE TABLE public.toilets_backup_20260603 AS TABLE public.toilets;
CREATE TABLE public.reviews_backup_20260603 AS TABLE public.reviews;

-- 1b. Verify row counts match the originals. The *_match columns MUST be true.
SELECT
  (SELECT count(*) FROM public.toilets)                  AS toilets_now,
  (SELECT count(*) FROM public.toilets_backup_20260603)  AS toilets_backup,
  (SELECT count(*) FROM public.toilets)
     = (SELECT count(*) FROM public.toilets_backup_20260603) AS toilets_match,
  (SELECT count(*) FROM public.reviews)                  AS reviews_now,
  (SELECT count(*) FROM public.reviews_backup_20260603)  AS reviews_backup,
  (SELECT count(*) FROM public.reviews)
     = (SELECT count(*) FROM public.reviews_backup_20260603) AS reviews_match;
