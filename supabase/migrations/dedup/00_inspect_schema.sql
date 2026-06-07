-- ============================================================
-- DEDUP STEP 0 — Inspect schema (READ-ONLY, run this FIRST)
--
-- Confirms the real column types before any other migration runs.
-- The Drizzle schema (shared/schema.ts) only models a subset of the
-- toilets table, so we verify the columns the dedup relies on:
--   coordinates, tags, source, is_removed, removed_at, created_at,
--   review_count, average_rating.
--
-- ALL dedup SQL assumes `coordinates` and `tags` are JSONB.
--   * If `tags` comes back as `text` below, then in every later file
--     replace:   t.tags <> '{}'::jsonb
--     with:      t.tags <> '{}'
--     and        (t.coordinates::jsonb)->>'lat'   if coordinates is text.
--
-- Run in the Supabase SQL Editor. Nothing is modified.
-- ============================================================

-- 0a. Column types of public.toilets
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'toilets'
ORDER BY ordinal_position;

-- 0b. Column types of public.reviews
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reviews'
ORDER BY ordinal_position;

-- 0c. Row totals and the source breakdown (expect osm 7782 / geoapify 806 / user 127)
SELECT
  count(*)                                            AS total_rows,
  count(*) FILTER (WHERE is_removed = false)          AS live_rows,
  count(*) FILTER (WHERE source = 'osm')              AS osm,
  count(*) FILTER (WHERE source = 'geoapify')         AS geoapify,
  count(*) FILTER (WHERE source = 'user')             AS users
FROM public.toilets;

-- 0d. Distinct raw `type` values actually present (so normalization covers them all)
SELECT type, count(*) AS n
FROM public.toilets
WHERE is_removed = false
GROUP BY type
ORDER BY n DESC;

-- 0e. Sanity: reviews coverage (expect ~39 reviews across ~35 toilets)
SELECT count(*) AS reviews, count(DISTINCT toilet_id) AS reviewed_toilets
FROM public.reviews;
