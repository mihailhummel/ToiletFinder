import { Helmet } from "react-helmet-async";
import type { BlogPost } from "../store";

const siteUrl = import.meta.env.VITE_SITE_URL || "https://toaletna.com";
const basePath = import.meta.env.VITE_BASE_PATH || "/blog";
const defaultOgImage = `${siteUrl}${basePath}/blog-logo.png`;

interface PostSEOProps {
  post: BlogPost;
}

export default function PostSEO({ post }: PostSEOProps) {
  const canonicalUrl = `${siteUrl}${basePath}/${post.slug}`;
  const description = post.meta_description || post.subtitle || "";
  const dateModified = post.last_edit_date || post.date;

  // og:image must be a real URL. Thumbnails are stored as base64 data: URIs, which are
  // invalid for crawlers/social cards (and huge), so fall back to a real default for those.
  const thumb = post.thumbnail || "";
  const imageUrl = thumb.startsWith("http")
    ? thumb
    : thumb.startsWith("/")
    ? `${siteUrl}${basePath}${thumb}`
    : defaultOgImage;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    author: { "@type": "Person", name: post.author },
    datePublished: post.date,
    dateModified,
    image: imageUrl,
    url: canonicalUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  };

  return (
    <Helmet>
      <title>{post.title} | Toaletna.com Блог</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:title" content={post.title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="article" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={post.title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
