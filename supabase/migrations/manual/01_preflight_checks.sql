-- ============================================================================
-- 01_preflight_checks.sql  —  RUN FIRST (read-only, changes nothing)
-- Ctrl+A, copy, paste into the Supabase SQL Editor, Run. Eyeball the 3 results,
-- then run 02_security_lockdown.sql.
-- ============================================================================

-- (a) service_role write policies MUST exist before we revoke the public roles.
--     Expect 4 rows (toilets, reviews, reports, toilet_reports), each >= 1.
SELECT tablename, count(*) AS service_policies
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('toilets','reviews','reports','toilet_reports')
   AND roles @> '{service_role}'
 GROUP BY tablename
 ORDER BY tablename;

-- (b) The review-count trigger MUST exist (02 removes the app's manual count
--     update and relies on this). Expect: trigger_update_toilet_rating
SELECT tgname
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
 WHERE c.relname = 'reviews' AND NOT t.tgisinternal;

-- (c) Duplicate (toilet_id, user_id) rows that 02 will delete before adding the
--     UNIQUE constraints. Informational — 02 handles the cleanup automatically.
SELECT 'reviews' AS source_table, toilet_id, user_id, count(*) AS copies
  FROM public.reviews
 GROUP BY toilet_id, user_id HAVING count(*) > 1
UNION ALL
SELECT 'toilet_reports', toilet_id, user_id, count(*)
  FROM public.toilet_reports
 GROUP BY toilet_id, user_id HAVING count(*) > 1
 ORDER BY source_table, copies DESC;
