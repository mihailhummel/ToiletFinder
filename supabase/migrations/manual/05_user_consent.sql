-- ============================================================================
-- 05_user_consent.sql  —  Append-only consent audit log. Ctrl+A, copy, paste, Run.
-- ----------------------------------------------------------------------------
-- Records that a user accepted the terms/privacy of a given version. One row per
-- (firebase_uid, consent_version): insert-once, never overwritten — so a version
-- bump produces a new historical row. Written ONLY by the Express server using
-- the service_role key (keyed to the Firebase UID); there is no Firebase↔Supabase
-- auth bridge, so we do NOT use auth.uid() RLS — instead anon/authenticated are
-- denied entirely and service_role (which bypasses RLS) does the writes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_consent (
  firebase_uid     text        NOT NULL,
  consent_version  integer     NOT NULL,
  accepted_terms   boolean     NOT NULL DEFAULT false,
  accepted_privacy boolean     NOT NULL DEFAULT false,
  accepted_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (firebase_uid, consent_version)
);

ALTER TABLE public.user_consent ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated + revoke all privileges = fully denied to
-- the public roles. service_role bypasses RLS and keeps its grants, so the
-- server can still read/write.
REVOKE ALL ON public.user_consent FROM anon, authenticated;

-- ── Verify (optional) ──
-- SELECT relrowsecurity FROM pg_class WHERE relname='user_consent';     -- expect true
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name='user_consent' AND grantee IN ('anon','authenticated'); -- expect 0 rows
