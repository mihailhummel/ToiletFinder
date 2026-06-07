-- ============================================================
-- DEDUP STEP 2 — Preview (READ-ONLY, no writes)
--
-- Ranks rows within each exact-coordinate group (lat/lng rounded to
-- 7 decimals) and shows how many rows would be removed, confirming
-- that ZERO protected rows (source='user' or any reviewed row) are
-- in the removal set.
--
-- Survivor selection priority (each tier breaks ties for the next):
--   1. has a review            -> keep
--   2. source = 'user'         -> keep
--   3. non-empty tags          -> real data beats {}
--   4. type_priority           -> best-rendered category wins
--   5. source quality          -> osm > geoapify
--   6. oldest created_at        -> stable tiebreak
--
-- type_priority is derived from the frontend (getToiletMarkerColor /
-- translateToiletType): public renders best (blue), then the other
-- correctly-coloured categories; bus_station/train_station keep their
-- own type (purple pin + proper badge); generic 'other' and the
-- untranslated 'toilet' fallback rank low; geoapify junk last.
--
-- EXPECT (verified against the 2026-06-03 export): to_remove = 5092,
-- survivors = 3620, both *_MUST_BE_0 = 0.
-- If either MUST_BE_0 is not 0 -> STOP and investigate. Do not run 03.
--
-- Run in the Supabase SQL Editor.
-- ============================================================

WITH ranked AS (
  SELECT
    t.id,
    t.source,
    (t.id IN (SELECT toilet_id FROM public.reviews)) AS has_review,
    ROW_NUMBER() OVER (
      PARTITION BY round((t.coordinates->>'lat')::numeric, 7),
                   round((t.coordinates->>'lng')::numeric, 7)
      ORDER BY
        (t.id IN (SELECT toilet_id FROM public.reviews))   DESC,  -- 1 reviews
        (t.source = 'user')                                DESC,  -- 2 user
        (t.tags IS NOT NULL AND t.tags <> '{}'::jsonb)     DESC,  -- 3 has tags
        CASE lower(t.type)                                        -- 4 type priority
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
          ELSE 0                                                  -- geoapify junk
        END                                                DESC,
        CASE t.source WHEN 'osm' THEN 2 WHEN 'geoapify' THEN 1 ELSE 0 END DESC, -- 5 source
        t.created_at ASC NULLS LAST                               -- 6 oldest
    ) AS rn
  FROM public.toilets t
  WHERE t.is_removed = false
)
SELECT
  count(*) FILTER (WHERE rn > 1)                                  AS to_remove,
  count(*) FILTER (WHERE rn > 1 AND source = 'user')              AS user_to_remove_MUST_BE_0,
  count(*) FILTER (WHERE rn > 1 AND has_review)                   AS reviewed_to_remove_MUST_BE_0,
  count(*) FILTER (WHERE rn = 1)                                  AS survivors
FROM ranked;


-- ------------------------------------------------------------
-- 2b. REVIEW-INTEGRITY PRE-FLIGHT (READ-ONLY)
--
-- The reviews export shows 39 reviews across 35 distinct toilets,
-- and 15 of those 35 are osm/geoapify rows (nanoid ids), not user
-- rows — which is exactly why protection is by `id IN reviews`, not
-- by source. These checks confirm the toilets table agrees and that
-- step 03 won't be blocked by a protected-vs-protected coordinate clash.
-- ------------------------------------------------------------

-- 2b-i. Reviewed-toilet headline. Expect (verified against the export):
--   total_reviews = 39, distinct_reviewed_toilets = 35,
--   reviewed_live = 35, reviewed_already_removed = 0.
SELECT
  (SELECT count(*) FROM public.reviews)                                AS total_reviews,
  (SELECT count(DISTINCT toilet_id) FROM public.reviews)               AS distinct_reviewed_toilets,
  (SELECT count(*) FROM public.toilets
     WHERE is_removed = false AND id IN (SELECT toilet_id FROM public.reviews)) AS reviewed_live,
  (SELECT count(*) FROM public.toilets
     WHERE is_removed = true  AND id IN (SELECT toilet_id FROM public.reviews)) AS reviewed_already_removed;

-- 2b-ii. Orphan reviews — toilet_id with no matching toilets row.
--   Expect 0. (Anything >0 means a review points at a non-existent toilet.)
SELECT count(DISTINCT r.toilet_id) AS orphan_review_toilet_ids_EXPECT_0
FROM public.reviews r
LEFT JOIN public.toilets t ON t.id = r.toilet_id
WHERE t.id IS NULL;

-- 2b-iii. THE conflict check: coordinate groups holding 2+ DISTINCT
--   reviewed live toilets. MUST be 0. If >0, step 03 will abort; resolve
--   the listed coordinates by hand (decide which reviewed row wins and
--   re-point or merge the other's reviews) before running 03.
WITH reviewed AS (
  SELECT t.id,
         round((t.coordinates->>'lat')::numeric, 7) AS lat,
         round((t.coordinates->>'lng')::numeric, 7) AS lng
  FROM public.toilets t
  WHERE t.is_removed = false
    AND t.id IN (SELECT toilet_id FROM public.reviews)
)
SELECT count(*) AS coord_groups_with_multiple_reviewed_MUST_BE_0
FROM (SELECT lat, lng FROM reviewed GROUP BY lat, lng HAVING count(*) > 1) x;

-- 2b-iv. If 2b-iii is not 0, this lists the offending coordinates + ids.
WITH reviewed AS (
  SELECT t.id,
         round((t.coordinates->>'lat')::numeric, 7) AS lat,
         round((t.coordinates->>'lng')::numeric, 7) AS lng
  FROM public.toilets t
  WHERE t.is_removed = false
    AND t.id IN (SELECT toilet_id FROM public.reviews)
)
SELECT lat, lng, count(*) AS reviewed_rows, array_agg(id) AS reviewed_ids
FROM reviewed
GROUP BY lat, lng
HAVING count(*) > 1
ORDER BY reviewed_rows DESC;
