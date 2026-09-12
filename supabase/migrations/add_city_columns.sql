-- Settlement attribution: record WHICH town/village each location sits in, so the
-- admin tooling can answer "how many locations have we got in Plovdiv / in Bansko /
-- in this village". Mirrors add_is_domestos.sql: additive, nullable, safe on a live DB.
--
-- Filled in by reverse geocoding (Nominatim) at creation time — see
-- server/geocoding.ts + the POST/PUT /api/toilets routes. Existing rows are
-- backfilled by scripts/backfill-toilet-cities.mjs.
--
--   city              settlement name in Bulgarian ("София", "Смолян", "с. Бяла черква")
--   region            oblast, disambiguates same-named villages ("Пловдив", "Варна")
--   city_resolved_at  when the lookup last ran. NOT NULL with a NULL city means
--                     "we asked and OSM had no settlement there" — the backfill
--                     script uses this to avoid re-asking forever.
--
-- Run this once against the Supabase project (SQL editor or psql).

ALTER TABLE public.toilets
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city_resolved_at timestamptz;

-- "All locations in city X" is the main query the Domestos admin Locations tab runs.
CREATE INDEX IF NOT EXISTS toilets_city_idx
  ON public.toilets (city)
  WHERE city IS NOT NULL;

-- The backfill script scans for not-yet-resolved rows; keep that cheap.
CREATE INDEX IF NOT EXISTS toilets_city_unresolved_idx
  ON public.toilets (created_at)
  WHERE city_resolved_at IS NULL;
