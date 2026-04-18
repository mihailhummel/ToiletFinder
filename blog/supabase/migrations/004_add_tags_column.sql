-- ============================================================
-- Add `tags` column to blog_posts
--
-- The admin UI and store.ts expect a `tags` column (text[]), but
-- the initial migration (001) did not include it. When saving a
-- new post PostgREST fails with:
--   "Could not find the 'tags' column of 'blog_posts' in the schema cache"
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Optional: GIN index for tag filtering (cheap, useful if we later
-- add tag-based queries from the public site).
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags
  ON blog_posts USING GIN (tags);

-- Refresh PostgREST's schema cache so the column is visible
-- immediately without needing a project restart.
NOTIFY pgrst, 'reload schema';
