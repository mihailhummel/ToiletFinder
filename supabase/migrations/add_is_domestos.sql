-- Domestos campaign: flag a toilet as a participating "Domestos location".
-- Mirrors the existing has_baby_changing boolean: additive, defaults false,
-- so existing rows are unaffected and the column is safe to add on a live DB.
--
-- Only admins can set this flag (enforced server-side in server/routes.ts);
-- the client renders a branded pin + special popup for rows where it is true.
--
-- Run this once against the Supabase project (SQL editor or psql).

ALTER TABLE public.toilets
  ADD COLUMN IF NOT EXISTS is_domestos boolean NOT NULL DEFAULT false;

-- Optional: speed up "list all Domestos locations" / leaderboard queries.
CREATE INDEX IF NOT EXISTS toilets_is_domestos_idx
  ON public.toilets (is_domestos)
  WHERE is_domestos = true;
