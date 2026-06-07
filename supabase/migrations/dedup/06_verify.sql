-- ============================================================
-- DEDUP STEP 6 — Post-run verification (READ-ONLY)
--
-- Run after 03 (and optionally 04/05). Confirms the map data is clean.
-- ============================================================

-- 6a. No duplicate coordinates remain among live rows.
--     rows and distinct_coords should be EQUAL.
SELECT
  count(*) AS rows,
  count(DISTINCT (round((coordinates->>'lat')::numeric, 7),
                  round((coordinates->>'lng')::numeric, 7))) AS distinct_coords
FROM public.toilets
WHERE is_removed = false;

-- 6b. Headline counts. Expect live_total = 3620, live_user_rows = 124
--     (all 124 live user rows preserved; 3 other user rows were already
--     soft-removed before this migration and are intentionally untouched),
--     soft_removed_total = 5095 (5092 from this run + 3 pre-existing).
SELECT
  count(*) FILTER (WHERE is_removed = false)                       AS live_total,
  count(*) FILTER (WHERE is_removed = false AND source = 'user')   AS live_user_rows,
  count(*) FILTER (WHERE is_removed = true)                        AS soft_removed_total;

-- 6c. No protected row is soft-removed anywhere (MUST be 0).
SELECT count(*) AS protected_soft_removed_MUST_BE_0
FROM public.toilets t
WHERE t.is_removed = true
  AND (t.source = 'user' OR t.id IN (SELECT toilet_id FROM public.reviews));

-- 6d. Every reviewed toilet is still live (MUST be 0 missing).
SELECT count(*) AS reviewed_but_removed_MUST_BE_0
FROM (SELECT DISTINCT toilet_id FROM public.reviews) r
JOIN public.toilets t ON t.id = r.toilet_id
WHERE t.is_removed = true;

-- 6e. Live type distribution (sanity-check rendering categories).
SELECT type, count(*) AS n
FROM public.toilets
WHERE is_removed = false
GROUP BY type
ORDER BY n DESC;
