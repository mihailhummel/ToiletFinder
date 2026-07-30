-- ============================================================
-- Blog images Storage bucket + RLS policies
-- Run this in the Supabase SQL Editor.
--
-- WHY: thumbnails were stored as base64 data: URIs inside
-- blog_posts.thumbnail (a text column). Every getPosts() therefore
-- dragged several MB of image bytes out of Postgres and over the
-- wire, on every single blog page view — and PostgREST responses are
-- never CDN-cacheable, so all of it counted as uncached egress.
--
-- Objects in a PUBLIC bucket are served from /storage/v1/object/public/...
-- which IS CDN-backed, so repeat views cost ~0 and the bytes land in
-- the (previously unused) "cached egress" allowance instead.
--
-- Mirrors the policy shape in 001_create_blog_posts.sql: public read,
-- authenticated write.
-- ============================================================

-- 1. Create the bucket (public read).
--    file_size_limit is a backstop: the admin UI already downscales to
--    ~1200px WebP, so anything near this ceiling means something regressed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS policies on storage.objects, scoped to this bucket.
--    DROP first so this migration is safely re-runnable.

DROP POLICY IF EXISTS "blog_images_public_read"      ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_insert"     ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_update"     ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_delete"     ON storage.objects;

-- Anyone can READ (public blog thumbnails)
CREATE POLICY "blog_images_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'blog-images');

-- Only authenticated users (admin) can upload
CREATE POLICY "blog_images_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'blog-images');

-- Only authenticated users (admin) can overwrite (upsert on re-upload)
CREATE POLICY "blog_images_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'blog-images')
  WITH CHECK (bucket_id = 'blog-images');

-- Only authenticated users (admin) can delete
CREATE POLICY "blog_images_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'blog-images');
