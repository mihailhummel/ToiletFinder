import { Helmet } from "react-helmet-async";
import type { BlogPost } from "../store";

const siteUrl = import.meta.env.VITE_SITE_URL || "https://toaletna.com";
const basePath = import.meta.env.VITE_BASE_PATH || "/blog";
const defaultOgImage = `${siteUrl}${basePath}/og-default.jpg`;

interface PostSEOProps {
  post: BlogPost;
}

export default function PostSEO({ post }: PostSEOProps) {
  const canonicalUrl = `${siteUrl}${basePath}/${post.slug}`;
  const description = post.meta_description || post.subtitle || "";
  const dateModified = post.last_edit_date || post.date;

  const rawImage = post.thumbnail || defaultOgImage;
  const imageUrl = rawImage.startsWith("http")
    ? rawImage
    : `${siteUrl}${basePath}${rawImage}`;

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
