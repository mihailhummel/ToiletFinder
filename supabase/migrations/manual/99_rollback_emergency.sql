-- ============================================================================
-- 99_rollback_emergency.sql  —  EMERGENCY ONLY. Do NOT run unless 02 broke
-- something and you must revert. ⚠️ This RE-OPENS the security hole (public
-- writes). Prefer fixing forward. Ctrl+A, copy, paste, Run only if necessary.
-- ============================================================================

BEGIN;

-- Re-grant public writes
GRANT INSERT, UPDATE, DELETE ON public.toilets, public.reviews,
      public.toilet_reports, public.reports TO anon, authenticated;

-- Restore the old always-true policies
CREATE POLICY "Allow authenticated insert" ON public.toilets FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.toilets FOR UPDATE TO public USING (true);
CREATE POLICY "Allow authenticated delete" ON public.toilets FOR DELETE TO public USING (true);
CREATE POLICY "Users can insert their own reviews" ON public.reviews FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE TO public USING (true);
CREATE POLICY "Users can insert their own toilet reports" ON public.toilet_reports FOR INSERT TO public WITH CHECK (true);

-- Drop the uniqueness constraints added by 02
ALTER TABLE public.toilet_reports DROP CONSTRAINT IF EXISTS uq_toilet_report_per_user;
ALTER TABLE public.reviews        DROP CONSTRAINT IF EXISTS uq_review_per_user;

-- NOTE: dropped backup tables and removed blog policies are NOT restored here.

COMMIT;
