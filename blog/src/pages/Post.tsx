import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
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
      const foundPost = await getPostBySlug(slug);
      if (foundPost) {
        setPost(foundPost);
        const allPosts = await getPosts();
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

  const renderContentWithAds = (content: string) => {
    const parts = content.split(/(\{insert_ad_1\}|\{insert_ad_2\})/g);

    return parts.map((part, index) => {
      if (part === "{insert_ad_1}") {
        return (
          <div key={index} className="my-8 lg:hidden block">
            <Ad1 className="w-full h-auto py-8" />
          </div>
        );
      }
      if (part === "{insert_ad_2}") {
        return (
          <div key={index} className="my-8 lg:hidden block">
            <Ad2 className="w-full h-auto py-8" />
          </div>
        );
      }

      const isHtml = /<[a-z][\s\S]*>/i.test(part);
      if (isHtml) {
        return <div key={index} dangerouslySetInnerHTML={{ __html: part }} />;
      }

      return <Markdown key={index}>{part}</Markdown>;
    });
  };

  return (
    <div className="w-full min-h-screen pb-20">
      <PostSEO post={post} />
      <div className="w-full px-4 xl:px-8 mt-8 flex items-start justify-between gap-8">
        
        {/* Left Ad Banner */}
        <aside className="hidden lg:block w-[160px] xl:w-[10%] sticky top-24 shrink-0">
          <Ad1 className="h-[calc(100vh-8rem)]" />
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

        {/* Right Ad Banner */}
        <aside className="hidden lg:block w-[160px] xl:w-[10%] sticky top-24 shrink-0">
          <Ad2 className="h-[calc(100vh-8rem)]" />
        </aside>
        
      </div>
    </div>
  );
}
