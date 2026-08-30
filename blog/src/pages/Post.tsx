import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import DOMPurify from "dompurify";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { ArrowLeft, Calendar, User, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { getPostBySlug, getPosts, BlogPost } from "../store";
import { Ad1, Ad2 } from "../components/Ads";
import PostSEO from "../components/PostSEO";

export default function Post() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [similarPosts, setSimilarPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      // Both come from the cached /api/posts routes, and the list response has no
      // `content` — this used to be two full `select('*')` round trips to Supabase,
      // the second one downloading every article just to pick six cards.
      // Run them together so the page isn't gated on a sequential pair.
      const [foundPost, allPosts] = await Promise.all([getPostBySlug(slug), getPosts()]);

      if (foundPost) {
        setPost(foundPost);
        setSimilarPosts(allPosts.filter((p) => p.id !== foundPost.id).slice(0, 6));
      } else {
        navigate("/");
      }
      setLoading(false);
    };
    load();
  }, [slug, navigate]);

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -carouselRef.current.offsetWidth : carouselRef.current.offsetWidth;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (loading || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // One chunk of post body — admin-authored HTML or markdown.
  const renderBody = (part: string, key: React.Key) => {
    const isHtml = /<[a-z][\s\S]*>/i.test(part);
    if (isHtml) {
      // Sanitize before injecting: blog HTML is admin-authored, but defense in
      // depth means we never render raw HTML straight from the DB.
      const clean = DOMPurify.sanitize(part);
      return <div key={key} dangerouslySetInnerHTML={{ __html: clean }} />;
    }
    return <Markdown key={key}>{part}</Markdown>;
  };

  // ADSENSE: in-article units render at every breakpoint (in-content is the
  // strongest AdSense placement). The wrapper reserves its height so neither the
  // ad filling in nor a fallback swap moves the surrounding text.
  const inArticleAd = (key: React.Key, n: number) => (
    <div key={key} className="my-8 block not-prose">
      {n % 2 === 0 ? <Ad2 placement="in-article" /> : <Ad1 placement="in-article" />}
    </div>
  );

  // ADSENSE: where to drop ads in a post whose author never added {insert_ad_N}.
  // Returns block indices to insert *before*. Prefers the break just above a
  // markdown heading — the most natural pause in an article — and falls back to
  // a plain paragraph boundary when a post has no headings.
  const autoAdBoundaries = (blocks: string[]): number[] => {
    const n = blocks.length;
    if (n < 6) return []; // too short to interrupt
    const first = 3; // never right under the intro
    const last = n - 2; // nor among the closing lines
    if (last <= first) return [];

    const headings = blocks
      .map((_, i) => i)
      .filter((i) => i >= first && i <= last && /^#{1,6}\s/.test(blocks[i].trim()));

    // Long reads get two units, shorter ones a single mid-article slot.
    const targets =
      n >= 30 ? [Math.round(n * 0.33), Math.round(n * 0.66)] : [Math.round(n * 0.5)];

    const chosen: number[] = [];
    for (const target of targets) {
      const clamped = Math.min(Math.max(target, first), last);
      const nearestHeading = headings
        .filter((i) => !chosen.some((c) => Math.abs(c - i) < 4))
        .sort((a, b) => Math.abs(a - clamped) - Math.abs(b - clamped))[0];
      const pick = nearestHeading ?? clamped;
      // Keep ads well apart so two never land in the same screenful.
      if (!chosen.some((c) => Math.abs(c - pick) < 4)) chosen.push(pick);
    }
    return chosen.sort((a, b) => a - b);
  };

  const renderContentWithAds = (content: string) => {
    // Authored slots win: if the writer placed {insert_ad_N} themselves, respect
    // exactly where they put them and add nothing else.
    if (/\{insert_ad_[12]\}/.test(content)) {
      return content.split(/(\{insert_ad_1\}|\{insert_ad_2\})/g).map((part, index) => {
        if (part === "{insert_ad_1}") return inArticleAd(index, 1);
        if (part === "{insert_ad_2}") return inArticleAd(index, 2);
        return renderBody(part, index);
      });
    }

    // No authored slots — place them automatically so every article carries ads.
    const blocks = content.split(/\n\s*\n/);
    const boundaries = autoAdBoundaries(blocks);
    if (boundaries.length === 0) return [renderBody(content, "body")];

    const out: React.ReactNode[] = [];
    let cursor = 0;
    boundaries.forEach((boundary, i) => {
      out.push(renderBody(blocks.slice(cursor, boundary).join("\n\n"), `chunk-${i}`));
      out.push(inArticleAd(`auto-ad-${i}`, i + 1));
      cursor = boundary;
    });
    out.push(renderBody(blocks.slice(cursor).join("\n\n"), "chunk-last"));
    return out;
  };

  return (
    <div className="w-full min-h-screen pb-20">
      <PostSEO post={post} />
      <div className="w-full px-4 xl:px-8 mt-8 flex items-start justify-center gap-8">
        
        {/* ADSENSE: Left Ad Banner (.tlt-rail sets the height) */}
        <aside className="hidden lg:block w-[160px] 2xl:w-[300px] sticky top-24 shrink-0">
          <Ad1 placement="sidebar" />
        </aside>

        {/* Article Content */}
        <article className="w-full max-w-4xl">
          <div className="bg-white shadow-sm md:border md:border-gray-100 w-[calc(100%+2rem)] -mx-4 md:w-full md:mx-0">
            {/* Hero Header */}
            <header className="relative h-[300px] md:h-[400px] w-full -mt-8 md:mt-0 bg-gray-900 overflow-hidden shadow-xl">
              <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent" />
              
              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
                <Link to="/" className="inline-flex items-center gap-2 text-gray-200 hover:text-white mb-6 transition-colors w-fit drop-shadow-md">
                  <ArrowLeft size={20} />
                  Назад към блога
                </Link>
                
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-2xl">
                  {post.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-gray-200 drop-shadow-lg">
                  <div className="flex items-center gap-2">
                    <User size={18} />
                    <span className="font-medium text-white">{post.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={18} />
                    <time dateTime={post.date}>
                      {format(new Date(post.date), "d MMM yyyy", { locale: bg })}
                    </time>
                  </div>
                  {post.last_edit_date && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock size={18} />
                      <span>Обновена: {format(new Date(post.last_edit_date), "d MMM yyyy", { locale: bg })}</span>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="px-4 pt-8 pb-8 md:px-12 md:py-10">
              <h2 className="text-2xl md:text-3xl font-medium text-gray-600 mb-10 leading-relaxed border-b border-gray-100 pb-8">
                {post.subtitle}
              </h2>
              
              <div className="prose prose-lg md:prose-xl prose-blue max-w-none prose-headings:font-bold prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-img:rounded-2xl prose-img:shadow-md">
                {renderContentWithAds(post.content)}
              </div>
              
              <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl shrink-0">
                    {post.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Написано от</p>
                    <p className="font-bold text-gray-900">{post.author}</p>
                  </div>
                </div>
                
                <a href="https://toaletna.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-6 py-3 rounded-full w-full sm:w-auto justify-center">
                  <MapPin size={20} />
                  Към Toaletna.com
                </a>
              </div>
            </div>
          </div>

          {/* Similar Posts Carousel */}
          {similarPosts.length > 0 && (
            <div className="mt-12 md:mt-16">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Подобни публикации</h3>
              <div className="relative group">
                <div
                  ref={carouselRef}
                  className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {similarPosts.map((sp) => (
                    <div key={sp.id} className="w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.66rem)] shrink-0 snap-start">
                      <Link to={`/${sp.slug}`} className="block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-md hover:shadow-xl transition-all h-full flex flex-col group/card">
                        <div className="aspect-[16/10] overflow-hidden relative">
                          <img src={sp.thumbnail} alt={sp.title} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/10 group-hover/card:bg-transparent transition-colors" />
                        </div>
                        <div className="p-3 md:p-5 flex flex-col flex-1">
                          <h4 className="text-sm md:text-lg font-bold text-gray-900 mb-1 md:mb-2 group-hover/card:text-blue-600 transition-colors line-clamp-2">{sp.title}</h4>
                          <p className="text-xs md:text-sm text-gray-600 line-clamp-2 mt-auto">{sp.subtitle}</p>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
                
                {similarPosts.length > 2 && (
                  <>
                    <button
                      onClick={() => scrollCarousel("left")}
                      className="absolute left-0 top-[40%] -translate-y-1/2 translate-x-2 md:-translate-x-4 p-2 md:p-3 rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-blue-600 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                    <button
                      onClick={() => scrollCarousel("right")}
                      className="absolute right-0 top-[40%] -translate-y-1/2 -translate-x-2 md:translate-x-4 p-2 md:p-3 rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-blue-600 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </article>

        {/* ADSENSE: Right Ad Banner (.tlt-rail sets the height) */}
        <aside className="hidden lg:block w-[160px] 2xl:w-[300px] sticky top-24 shrink-0">
          <Ad2 placement="sidebar" />
        </aside>
        
      </div>
    </div>
  );
}
