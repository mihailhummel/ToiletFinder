-- ============================================================================
-- 02_security_lockdown.sql  —  THE MAIN FIX. Ctrl+A, copy, paste, Run.
-- ----------------------------------------------------------------------------
-- Makes the public/anon roles READ-ONLY on the core tables. All writes continue
-- to flow through the Express server (service_role, which bypasses RLS). Blog
-- writes are restricted to the admin email below. Runs as ONE transaction — if
-- anything errors it rolls back and nothing changes.
--
-- Admin email is already set to: mihail.hummel@toaletna.com
-- (All lines here are active SQL — nothing to uncomment.)
-- ============================================================================

BEGIN;

-- 1) TOILETS: drop legacy permissive policies; revoke public writes ----------
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.toilets;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.toilets;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.toilets;
DROP POLICY IF EXISTS "Allow public read access"   ON public.toilets;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.toilets FROM anon, authenticated;
-- KEEP: toilets_public_read (is_removed=false) + toilets_service_* (service_role)

-- 2) REVIEWS: drop public write + duplicate read; revoke public writes -------
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Reviews are viewable by everyone"   ON public.reviews;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.reviews FROM anon, authenticated;
-- KEEP: reviews_public_read (true) + reviews_service_* (service_role)

-- 3) TOILET_REPORTS + REPORTS: server-only (no public access at all) ---------
DROP POLICY IF EXISTS "Users can insert their own toilet reports" ON public.toilet_reports;
DROP POLICY IF EXISTS "Toilet reports are viewable by everyone"   ON public.toilet_reports;
REVOKE ALL ON public.toilet_reports FROM anon, authenticated;
REVOKE ALL ON public.reports        FROM anon, authenticated;
-- KEEP: *_service_* policies (service_role)

-- 4) BLOG_POSTS: public reads published; ONLY the admin email writes ---------
DROP POLICY IF EXISTS blog_posts_admin_insert   ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_admin_update   ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_admin_delete   ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_admin_read_all ON public.blog_posts;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.blog_posts FROM anon, authenticated;
GRANT  INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;  -- gated by policy below

CREATE POLICY blog_admin_all ON public.blog_posts
  FOR ALL TO authenticated
  USING      ( (auth.jwt() ->> 'email') = 'mihail.hummel@toaletna.com' )
  WITH CHECK ( (auth.jwt() ->> 'email') = 'mihail.hummel@toaletna.com' );

CREATE POLICY blog_admin_read_all ON public.blog_posts
  FOR SELECT TO authenticated
  USING ( (auth.jwt() ->> 'email') = 'mihail.hummel@toaletna.com' );
-- KEEP: blog_posts_public_read (is_published = true)

-- 5) DROP stale backup tables (June 2026 dedup snapshots) --------------------
DROP TABLE IF EXISTS public.reviews_backup_20260603;
DROP TABLE IF EXISTS public.toilets_backup_20260603;

-- 6) FUNCTION HARDENING ------------------------------------------------------
ALTER FUNCTION public.update_toilet_rating()               SET search_path = public, pg_catalog;
ALTER FUNCTION public.has_user_reviewed_toilet(text, text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.has_user_reported_toilet(text, text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_toilet_report_count(text)        SET search_path = public, pg_catalog;

-- Recreate the bounds query with a bbox-size guard + hard LIMIT (prevents a
-- planet-sized envelope from scanning/returning the whole table).
CREATE OR REPLACE FUNCTION public.get_toilets_in_bounds(
  west double precision, south double precision,
  east double precision, north double precision
)
RETURNS TABLE(id text, coordinates jsonb, type text, source text, notes text,
              tags jsonb, is_removed boolean,
              created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF west IS NULL OR south IS NULL OR east IS NULL OR north IS NULL
     OR east < west OR north < south
     OR (east - west) > 8.0 OR (north - south) > 6.0 THEN
    RAISE EXCEPTION 'Invalid or too-large bounding box';
  END IF;

  RETURN QUERY
  SELECT t.id, t.coordinates, t.type, t.source, t.notes,
         t.tags, t.is_removed, t.created_at, t.updated_at
  FROM public.toilets t
  WHERE t.is_removed = FALSE
    AND ST_Within(
      ST_SetSRID(ST_MakePoint((t.coordinates->>'lng')::float,
                              (t.coordinates->>'lat')::float), 4326),
      ST_MakeEnvelope(west, south, east, north, 4326)
    )
  LIMIT 5000;
END;
$function$;

-- Lock the unused PostGIS SECURITY DEFINER function from the public roles.
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text)               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text)         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM anon, authenticated;

-- 7) UNIQUENESS: one review / one report per user per toilet -----------------
-- Dedupe first (keep the earliest row), else ADD CONSTRAINT would fail.
DELETE FROM public.reviews a USING public.reviews b
  WHERE a.toilet_id = b.toilet_id AND a.user_id = b.user_id AND a.created_at > b.created_at;
DELETE FROM public.toilet_reports a USING public.toilet_reports b
  WHERE a.toilet_id = b.toilet_id AND a.user_id = b.user_id AND a.created_at > b.created_at;

ALTER TABLE public.toilet_reports
  ADD CONSTRAINT uq_toilet_report_per_user UNIQUE (toilet_id, user_id);
ALTER TABLE public.reviews
  ADD CONSTRAINT uq_review_per_user        UNIQUE (toilet_id, user_id);

-- 8) Stop FUTURE tables from being auto-writable by the public roles ---------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

COMMIT;
