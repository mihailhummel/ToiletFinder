-- ============================================================
-- DEDUP STEP 5 — Normalize `type` to canonical values (OPTIONAL)
--
-- Canonicalises type strings so the frontend renders them correctly.
-- This only collapses variants/junk onto the value the app already
-- treats identically; it never invents a new rendering.
--
-- Mapping (everything not listed is left untouched):
--   toilet                         -> public        (amenity=toilets renders best as the blue "public" pin)
--   gas_station / gasStation       -> gas-station   (so getProperTitle's `=== 'gas-station'` matches -> proper title)
--   shop / shops                   -> mall
--   portable                       -> EKOTOI
--   service, amenity, building,    -> other         (geoapify junk; already renders purple "other")
--   commercial, access,
--   access_limited, internet_access
--
-- DELIBERATELY KEPT AS-IS (their type IS bus_station / train_station):
--   bus_station, train_station  — purple pin via the fallback colour,
--                                  badge already says "Bus Station" /
--                                  "Train Station" via translateToiletType.
--   public, EKOTOI, restaurant, cafe, gas-station, mall, other — already canonical.
--
-- Applies to live rows only. Run the whole file at once.
-- ============================================================

BEGIN;

-- 5a. Preview what would change (review before committing).
SELECT lower(type) AS raw_type, count(*) AS n
FROM public.toilets
WHERE is_removed = false
  AND lower(type) IN ('toilet','gas_station','gasstation','shop','shops','portable',
                      'service','amenity','building','commercial','access',
                      'access_limited','internet_access')
GROUP BY 1
ORDER BY n DESC;

-- 5b. Apply normalization.
UPDATE public.toilets SET type = CASE lower(type)
  WHEN 'toilet'          THEN 'public'
  WHEN 'gas_station'     THEN 'gas-station'
  WHEN 'gasstation'      THEN 'gas-station'
  WHEN 'shop'            THEN 'mall'
  WHEN 'shops'           THEN 'mall'
  WHEN 'portable'        THEN 'EKOTOI'
  WHEN 'ekotoi'          THEN 'EKOTOI'      -- normalise casing to the canonical form
  WHEN 'service'         THEN 'other'
  WHEN 'amenity'         THEN 'other'
  WHEN 'building'        THEN 'other'
  WHEN 'commercial'      THEN 'other'
  WHEN 'access'          THEN 'other'
  WHEN 'access_limited'  THEN 'other'
  WHEN 'internet_access' THEN 'other'
  ELSE type   -- bus_station, train_station, and already-canonical values untouched
END
WHERE is_removed = false;

-- 5c. Confirm the resulting type distribution.
SELECT type, count(*) AS n
FROM public.toilets
WHERE is_removed = false
GROUP BY type
ORDER BY n DESC;

COMMIT;
