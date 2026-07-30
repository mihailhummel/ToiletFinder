import { supabase } from './supabase';

/**
 * Thumbnail upload — downscale in the browser, then store in Supabase Storage.
 *
 * Thumbnails used to be read with FileReader.readAsDataURL() and written into
 * blog_posts.thumbnail as a base64 data: URI. That put multi-MB images inside a
 * Postgres text column, so every getPosts() shipped all of them over PostgREST —
 * which is never CDN-cacheable, and was the single largest source of Supabase
 * egress on this project.
 *
 * Storage objects in a public bucket are served from the CDN instead, so repeat
 * views cost ~0. Downscaling first keeps the originals (2-3 MB) from being served
 * to readers at all.
 */

export const BLOG_IMAGES_BUCKET = 'blog-images';

const MAX_WIDTH = 1200;
const QUALITY = 0.82;

/** Draw the file into a canvas at most MAX_WIDTH wide and re-encode it. */
async function downscale(file: File): Promise<{ blob: Blob; ext: string }> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

  // Every browser that supports createImageBitmap also encodes WebP, but fall
  // back to JPEG rather than failing the upload outright.
  const webp = await encode('image/webp');
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };

  const jpeg = await encode('image/jpeg');
  if (jpeg) return { blob: jpeg, ext: 'jpg' };

  throw new Error('Could not encode the image');
}

/**
 * Downscale `file`, upload it, and return its public URL.
 * Requires an authenticated Supabase session (see the bucket policies in
 * blog/supabase/migrations/005_blog_images_bucket.sql).
 */
export async function uploadThumbnail(file: File, slugHint?: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Файлът не е снимка.');
  }

  let blob: Blob;
  let ext: string;
  try {
    ({ blob, ext } = await downscale(file));
  } catch {
    // A format the canvas can't decode (e.g. some AVIF/HEIC) — upload as-is
    // rather than blocking the admin. Still far better than base64 in Postgres.
    blob = file;
    ext = (file.name.split('.').pop() || 'png').toLowerCase();
  }

  // Unique per upload: Storage objects are served with a long CDN cache, so
  // reusing a path would keep serving the previous image after a replacement.
  const base = (slugHint || 'post').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const objectPath = `${base || 'post'}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BLOG_IMAGES_BUCKET)
    .upload(objectPath, blob, {
      contentType: blob.type || `image/${ext}`,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw new Error(`Качването се провали: ${error.message}`);

  const { data } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}
