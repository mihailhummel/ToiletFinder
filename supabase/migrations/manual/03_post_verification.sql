-- ============================================================================
-- 03_post_verification.sql  —  RUN AFTER 02 (read-only). Ctrl+A, copy, paste, Run.
-- Confirms the lockdown took effect. Eyeball each result.
-- ============================================================================

-- 1) Core tables: there should be NO public/anon write policies left — only
--    *_public_read (SELECT) and *_service_* (service_role). For blog_posts you
--    should see blog_posts_public_read + blog_admin_all + blog_admin_read_all.
SELECT tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('toilets','reviews','toilet_reports','reports','blog_posts')
 ORDER BY tablename, cmd, policyname;

-- 2) anon / authenticated grants on these tables: expect SELECT only
--    (blog_posts: authenticated also shows INSERT/UPDATE/DELETE, but those are
--    gated by the admin-email RLS policy above).
SELECT table_name, grantee,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee IN ('anon','authenticated')
   AND table_name IN ('toilets','reviews','toilet_reports','reports','blog_posts')
 GROUP BY table_name, grantee
 ORDER BY table_name, grantee;

-- 3) UNIQUE constraints present (expect both rows)
SELECT conname, conrelid::regclass AS on_table
  FROM pg_constraint
 WHERE conname IN ('uq_review_per_user','uq_toilet_report_per_user');

-- 4) Backup tables dropped (expect 0 rows)
SELECT tablename FROM pg_tables
 WHERE schemaname = 'public' AND tablename LIKE '%\_backup\_%';

-- 5) Bounds function bbox guard in place (expect the RAISE EXCEPTION line)
SELECT pg_get_functiondef('public.get_toilets_in_bounds(double precision,double precision,double precision,double precision)'::regprocedure);
