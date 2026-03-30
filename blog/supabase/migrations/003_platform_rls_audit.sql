-- ============================================================
-- PLATFORM RLS AUDIT — Run in the SAME Supabase project
--
-- This script enables RLS on all existing platform tables
-- and creates restrictive policies. This is critical because
-- the blog shares the same Supabase project and uses the
-- same anon key.
--
-- Without these policies, the blog's anon key could read
-- toilets, reviews, reports, and toilet_reports.
-- ============================================================

-- ── toilets table ──

ALTER TABLE toilets ENABLE ROW LEVEL SECURITY;

-- Public can read non-removed toilets (the map is public)
CREATE POLICY "toilets_public_read" ON toilets
  FOR SELECT
  USING (is_removed = false);

-- Only the server (service_role) can insert
CREATE POLICY "toilets_service_insert" ON toilets
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only the server (service_role) can update
CREATE POLICY "toilets_service_update" ON toilets
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only the server (service_role) can delete
CREATE POLICY "toilets_service_delete" ON toilets
  FOR DELETE
  TO service_role
  USING (true);


-- ── reviews table ──

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public can read reviews
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT
  USING (true);

-- Only the server can insert/update/delete reviews
CREATE POLICY "reviews_service_insert" ON reviews
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "reviews_service_update" ON reviews
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "reviews_service_delete" ON reviews
  FOR DELETE
  TO service_role
  USING (true);


-- ── reports table ──

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Reports should NOT be publicly readable
-- Only the server can interact with reports
CREATE POLICY "reports_service_select" ON reports
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "reports_service_insert" ON reports
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "reports_service_update" ON reports
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "reports_service_delete" ON reports
  FOR DELETE
  TO service_role
  USING (true);


-- ── toilet_reports table ──

ALTER TABLE toilet_reports ENABLE ROW LEVEL SECURITY;

-- toilet_reports should NOT be publicly readable
-- Only the server can interact
CREATE POLICY "toilet_reports_service_select" ON toilet_reports
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "toilet_reports_service_insert" ON toilet_reports
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "toilet_reports_service_delete" ON toilet_reports
  FOR DELETE
  TO service_role
  USING (true);
