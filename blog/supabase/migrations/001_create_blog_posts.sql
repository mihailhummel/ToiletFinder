-- ============================================================
-- Blog Posts table + RLS policies
-- Run this in the Supabase SQL Editor.
--
-- This migration is self-contained: if you later split the blog
-- into its own Supabase project, just run this file there.
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS blog_posts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  slug          text        NOT NULL UNIQUE,
  subtitle      text        NOT NULL DEFAULT '',
  thumbnail     text        NOT NULL DEFAULT '',
  content       text        NOT NULL,
  meta_description text     NOT NULL DEFAULT '',
  date          timestamptz NOT NULL DEFAULT now(),
  last_edit_date timestamptz,
  author        text        NOT NULL,
  is_recommended boolean    NOT NULL DEFAULT false,
  is_published  boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Index for slug lookups (SEO URLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);

-- 3. Index for listing queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_date
  ON blog_posts (is_published, date DESC);

-- 4. Enable Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Anyone can READ published posts (public blog)
CREATE POLICY "blog_posts_public_read"
  ON blog_posts
  FOR SELECT
  USING (is_published = true);

-- Only authenticated users (admin) can INSERT
CREATE POLICY "blog_posts_admin_insert"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only authenticated users (admin) can UPDATE
CREATE POLICY "blog_posts_admin_update"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only authenticated users (admin) can DELETE
CREATE POLICY "blog_posts_admin_delete"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (true);

-- Authenticated users can also read ALL posts (including drafts) for admin panel
CREATE POLICY "blog_posts_admin_read_all"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (true);
