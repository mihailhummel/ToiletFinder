-- ============================================================================
-- 04_clear_postgis_rpc.sql  —  OPTIONAL, cosmetic. Ctrl+A, copy, paste, Run.
-- Silences the "st_estimatedextent callable by anon/authenticated" advisor.
-- This PostGIS SECURITY DEFINER function grants EXECUTE to PUBLIC, so revoking
-- only from anon/authenticated didn't clear it. Revoke from PUBLIC too.
-- Risk is negligible (the function reads geometry-column statistics; this app
-- has no geometry columns), so this is purely to clean the advisor report.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
