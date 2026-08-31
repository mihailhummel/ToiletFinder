/**
 * blog/seo.mjs — the blog's SEO head/body/sitemap builders.
 *
 * Shared deliberately by BOTH:
 *   - prerender.mjs, at build time
 *   - server.mjs, at request time
 *
 * The runtime path is what makes a newly published post indexable straight
 * away. Before it existed these builders only ran at build time, so a post
 * published between deploys was served the blog HOMEPAGE's head — including
 * `<link rel="canonical" href="/blog">`, which tells Google the URL is a
 * duplicate of the index and should not be indexed on its own. That is why new
 * posts could not be found even by their exact title.
 *
 * Keeping one copy of these functions is the point: if the two paths emitted
 * different tags for the same post, the page would change identity depending on
 * when it was crawled.
 */

export function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripMarkupAndAds(text = '') {
  return text
    .replace(/\{insert_ad_\d+\}/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerpt(content = '', maxLen = 400) {
  const plain = stripMarkupAndAds(content);
  return plain.length > maxLen ? plain.slice(0, maxLen) + '…' : plain;
}

/**
 * og:image must be a real crawlable URL. http(s) thumbnails (Supabase Storage)
 * pass through, site-relative ones are absolutised. A base64 data: URI cannot be
 * used by crawlers; the build writes those out to a file, and at runtime — where
 * we cannot — we fall back to the site logo.
 */
export function resolveImage(thumbnail, { siteUrl, basePath }) {
  const fallback = `${siteUrl}${basePath}/blog-logo.png`;
  if (!thumbnail) return fallback;
  if (thumbnail.startsWith('http')) return thumbnail;
  if (thumbnail.startsWith('/')) return `${siteUrl}${basePath}${thumbnail}`;
  return fallback;
}

const CLOSE_SCRIPT = '<' + '/script>';

export function postHeadTags(post, image, { siteUrl, basePath }) {
  // Slugs may contain non-ASCII (one existing post ends in a Cyrillic "а"), and
  // canonical/<loc> must be a valid URL, so encode the path segment.
  const canonical = `${siteUrl}${basePath}/${encodeURIComponent(post.slug)}`;
  const title = esc(`${post.title} | Toaletna.com Блог`);
  const desc = esc(post.meta_description || post.subtitle || '');
  const dateModified = post.last_edit_date || post.date;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description || post.subtitle || '',
    author: { '@type': 'Person', name: post.author },
    datePublished: post.date,
    dateModified,
    image,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    publisher: { '@type': 'Organization', name: 'Toaletna.com', url: siteUrl },
  });

  return `<title>${title}</title>
    <meta name="description" content="${desc}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${esc(post.title)}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:type" content="article">
    <meta property="og:locale" content="bg_BG">
    <meta property="og:site_name" content="Toaletna.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(post.title)}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">
    <meta name="robots" content="index, follow">
    <script type="application/ld+json">${jsonLd}${CLOSE_SCRIPT}`;
}

export function homepageHeadTags({ siteUrl, basePath }) {
  const canonical = `${siteUrl}${basePath}`;
  const title = 'Toaletna.com | Блог за Обществени Тоалетни в България';
  const desc =
    'Статии, съвети и новини за обществените тоалетни в България. Официалният блог на Toaletna.com.';
  const image = `${siteUrl}${basePath}/og-default.jpg`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Toaletna.com Блог',
    url: canonical,
    description: desc,
    publisher: { '@type': 'Organization', name: 'Toaletna.com', url: siteUrl },
  });

  return `<title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="keywords" content="блог тоалетни, обществени тоалетни България, Toaletna.com блог, публични тоалетни">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Toaletna.com">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${image}">
    <meta property="og:locale" content="bg_BG">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${image}">
    <meta name="robots" content="index, follow">
    <script type="application/ld+json">${jsonLd}${CLOSE_SCRIPT}`;
}

/** Head for a URL that matches no published post: keep it out of the index. */
export function notFoundHeadTags({ siteUrl, basePath }) {
  return `<title>Страницата не е намерена | Toaletna.com Блог</title>
    <meta name="description" content="Тази страница не съществува.">
    <link rel="canonical" href="${siteUrl}${basePath}/">
    <meta name="robots" content="noindex, follow">`;
}

/** Crawlable preview of the article, so the page has content before JS runs. */
export function postRootContent(post) {
  const dateStr = (() => {
    try {
      return new Date(post.date).toLocaleDateString('bg-BG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return post.date || '';
    }
  })();

  return `<article style="max-width:860px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;">
    <h1 style="font-size:2rem;font-weight:800;margin-bottom:.5rem;line-height:1.2">${esc(post.title)}</h1>
    <p style="color:#555;font-size:1.1rem;margin-bottom:1rem">${esc(post.subtitle || '')}</p>
    <p style="color:#888;font-size:.85rem;margin-bottom:2rem">Автор: ${esc(post.author)} &bull; ${dateStr}</p>
    <p style="line-height:1.8;color:#333;font-size:1rem">${esc(excerpt(post.content))}</p>
  </article>`;
}

export function buildSitemap(posts, { siteUrl, basePath }) {
  const now = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url>\n    <loc>${siteUrl}${basePath}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ...posts.map((p) => {
      const lastmod = String(p.last_edit_date || p.date || now).slice(0, 10);
      const loc = `${siteUrl}${basePath}/${encodeURIComponent(p.slug)}`;
      return `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function patchShell(shell, headTags, rootContent = null) {
  // The shell carries a single <!-- SEO_HEAD --> marker (blog/index.html); we
  // swap it wholesale, so each page ends up with exactly one <title>, one
  // canonical and one JSON-LD block.
  let html = shell.replace('<!-- SEO_HEAD -->', headTags);

  if (rootContent !== null) {
    if (html.includes('<!-- SSR_PLACEHOLDER -->')) {
      html = html.replace('<!-- SSR_PLACEHOLDER -->', rootContent);
    } else {
      html = html.replace(/<div id="root"><\/div>/, `<div id="root">${rootContent}</div>`);
    }
  }
  return html;
}
