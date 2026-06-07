-- ============================================================
-- DEDUP STEP 4 — Enrich survivors + recompute review stats
--
-- Run AFTER 03 has been committed. Two independent concerns:
--   A) Backfill each surviving row from its (now soft-removed) siblings
--      so no useful data is lost when the duplicates disappear.
--   B) Recompute review_count / average_rating, which were STALE.
--
-- Backfill only fills GAPS on the survivor (empty/unknown fields); it
-- never overwrites data the survivor already has. Aggregates are taken
-- over the whole coordinate group (live + soft-removed siblings).
--
-- Runs in one transaction. Run the whole file at once.
-- ============================================================

BEGIN;

-- 4A. Backfill survivor gaps from the richest values in their coord group.
WITH grp AS (
  SELECT
    round((coordinates->>'lat')::numeric, 7) AS lat,
    round((coordinates->>'lng')::numeric, 7) AS lng,
    -- richest non-empty tags (proxy: longest JSON text)
    (array_agg(tags ORDER BY length(tags::text) DESC)
       FILTER (WHERE tags IS NOT NULL AND tags <> '{}'::jsonb))[1]              AS best_tags,
    (array_agg(notes ORDER BY length(notes) DESC)
       FILTER (WHERE notes IS NOT NULL AND btrim(notes) <> ''))[1]             AS best_notes,
    (array_agg(title ORDER BY length(title) DESC)
       FILTER (WHERE title IS NOT NULL AND btrim(title) <> ''))[1]             AS best_title,
    (array_agg(accessibility)
       FILTER (WHERE accessibility IS NOT NULL AND accessibility <> 'unknown'))[1] AS best_accessibility,
    (array_agg(access_type)
       FILTER (WHERE access_type IS NOT NULL AND access_type <> 'unknown'))[1]    AS best_access_type,
    bool_or(COALESCE(has_baby_changing, false))                                AS any_baby_changing
  FROM public.toilets
  GROUP BY 1, 2
)
UPDATE public.toilets t SET
  tags = CASE
           WHEN (t.tags IS NULL OR t.tags = '{}'::jsonb) AND g.best_tags IS NOT NULL
           THEN g.best_tags ELSE t.tags END,
  notes = COALESCE(NULLIF(btrim(t.notes), ''), g.best_notes, t.notes),
  title = COALESCE(NULLIF(btrim(t.title), ''), g.best_title, t.title),
  accessibility = CASE
           WHEN (t.accessibility IS NULL OR t.accessibility = 'unknown') AND g.best_accessibility IS NOT NULL
           THEN g.best_accessibility ELSE t.accessibility END,
  access_type = CASE
           WHEN (t.access_type IS NULL OR t.access_type = 'unknown') AND g.best_access_type IS NOT NULL
           THEN g.best_access_type ELSE t.access_type END,
  has_baby_changing = COALESCE(t.has_baby_changing, false) OR g.any_baby_changing
FROM grp g
WHERE round((t.coordinates->>'lat')::numeric, 7) = g.lat
  AND round((t.coordinates->>'lng')::numeric, 7) = g.lng
  AND t.is_removed = false;

-- 4B. Recompute review stats for survivors that HAVE reviews.
UPDATE public.toilets t SET
  review_count   = s.cnt,
  average_rating = s.avg
FROM (
  SELECT toilet_id, count(*) AS cnt, avg(rating)::numeric(3,2) AS avg
  FROM public.reviews
  GROUP BY toilet_id
) s
WHERE t.id = s.toilet_id
  AND t.is_removed = false;

-- 4C. Zero out survivors with no reviews (clears stale non-zero values).
UPDATE public.toilets t SET
  review_count   = 0,
  average_rating = 0
WHERE t.is_removed = false
  AND t.id NOT IN (SELECT toilet_id FROM public.reviews);

COMMIT;
