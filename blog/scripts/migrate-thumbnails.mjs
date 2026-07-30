/**
 * migrate-thumbnails.mjs — one-off: move blog thumbnails out of Postgres.
 *
 * Thumbnails were stored as base64 data: URIs in blog_posts.thumbnail (a text
 * column), so every getPosts() shipped several MB of image bytes over PostgREST
 * — which is never CDN-cacheable, hence 100% uncached egress. This decodes each
 * one, downscales it, uploads it to the public `blog-images` bucket, and
 * replaces the column value with the public URL.
 *
 * Prerequisites:
 *   1. Run blog/supabase/migrations/005_blog_images_bucket.sql first.
 *   2. Root .env must have SUPABASE_URL + SUPABASE_SERVICE_KEY.
 *
 * Usage (from the repo root or blog/):
 *   node blog/scripts/migrate-thumbnails.mjs --dry-run   # inspect, write nothing
 *   node blog/scripts/migrate-thumbnails.mjs             # actually migrate
 *
 * Idempotent: rows whose thumbnail is already an http(s) URL are skipped, so
 * re-running is safe.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'blog-images';
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 80;

// ── env ───────────────────────────────────────────────────────────────────────
// Minimal .env reader so this script needs no dotenv dependency.
function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const env = { ...loadEnv(path.join(REPO_ROOT, '.env')), ...process.env };
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✖ Need SUPABASE_URL and SUPABASE_SERVICE_KEY (checked root .env and process env).');
  process.exit(1);
}

// ── sharp is optional ─────────────────────────────────────────────────────────
// Without it we still migrate (the egress win comes from leaving Postgres), we
// just upload the original bytes instead of downscaling them.
let sharp = null;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.warn('⚠ sharp not installed — uploading original bytes without downscaling.');
  console.warn('  For ~20x smaller images: npm --prefix blog install -D sharp\n');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif',
};

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  console.log(`\n${DRY_RUN ? '🔍 DRY RUN — nothing will be written\n' : '🚀 Migrating thumbnails\n'}`);

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id, slug, thumbnail')
    .order('date', { ascending: false });

  if (error) {
    console.error('✖ Could not read blog_posts:', error.message);
    process.exit(1);
  }

  const pending = posts.filter((p) => /^data:image\//i.test((p.thumbnail || '').trim()));
  const already = posts.filter((p) => /^https?:\/\//i.test((p.thumbnail || '').trim()));

  console.log(`${posts.length} posts — ${pending.length} to migrate, ${already.length} already on URLs.\n`);
  if (!pending.length) {
    console.log('✓ Nothing to do.\n');
    return;
  }

  let beforeTotal = 0;
  let afterTotal = 0;
  let failures = 0;

  for (const post of pending) {
    const raw = post.thumbnail.trim();
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(raw);
    if (!m) {
      console.warn(`  ⚠ ${post.slug}: thumbnail looks like a data URI but did not parse — skipped.`);
      failures++;
      continue;
    }

    const srcMime = m[1].toLowerCase();
    const srcBuf = Buffer.from(m[2], 'base64');
    // What the column actually costs on the wire is the base64 text, not the
    // decoded bytes — that's the number we're trying to shrink.
    const wireBefore = Buffer.byteLength(raw, 'utf8');
    beforeTotal += wireBefore;

    let outBuf = srcBuf;
    let ext = MIME_EXT[srcMime] || 'png';
    let contentType = srcMime;

    if (sharp) {
      try {
        outBuf = await sharp(srcBuf)
          .rotate() // honour EXIF orientation before we drop the metadata
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
        ext = 'webp';
        contentType = 'image/webp';
      } catch (err) {
        console.warn(`  ⚠ ${post.slug}: could not re-encode (${err.message}) — uploading original.`);
      }
    }

    // Slugs can contain non-ASCII (one post's slug ends in a Cyrillic 'а'), which
    // would produce a percent-encoded Storage key. Keep object paths plain ASCII.
    const safeSlug =
      post.slug.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[^a-z0-9-]+/gi, '-')
        .replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || post.id;
    const objectPath = `${safeSlug}.${ext}`;
    afterTotal += outBuf.byteLength;

    console.log(
      `  ${post.slug}\n` +
      `      column ${kb(wireBefore)} (base64)  →  ${objectPath} ${kb(outBuf.byteLength)}`
    );

    if (DRY_RUN) continue;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, outBuf, { contentType, upsert: true, cacheControl: '31536000' });

    if (upErr) {
      console.error(`  ✖ ${post.slug}: upload failed — ${upErr.message}`);
      failures++;
      continue;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

    const { error: updErr } = await supabase
      .from('blog_posts')
      .update({ thumbnail: pub.publicUrl })
      .eq('id', post.id);

    if (updErr) {
      console.error(`  ✖ ${post.slug}: row update failed — ${updErr.message}`);
      console.error('    (object uploaded; re-running the script will retry the update)');
      failures++;
      continue;
    }

    console.log(`      → ${pub.publicUrl}`);
  }

  const saved = beforeTotal - afterTotal;
  console.log(
    `\n${DRY_RUN ? 'Would move' : 'Moved'} ${pending.length - failures}/${pending.length} thumbnails.\n` +
    `Per full getPosts(): ${kb(beforeTotal)} → ${kb(afterTotal)} ` +
    `(${saved > 0 ? '−' : '+'}${kb(Math.abs(saved))}, and the remainder is now CDN-cacheable).\n`
  );

  if (failures) {
    console.error(`⚠ ${failures} failure(s) — re-run to retry; the script is idempotent.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✖ Fatal:', err);
  process.exit(1);
});
