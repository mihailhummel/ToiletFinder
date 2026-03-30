import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ArrowRight, User } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { getPosts, BlogPost } from "../store";
import { Ad1, Ad2 } from "../components/Ads";

export default function Home() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [recommended, setRecommended] = useState<BlogPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(6);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts().then((allPosts) => {
      setPosts(allPosts);
      setRecommended(allPosts.filter((p) => p.is_recommended));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (recommended.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % recommended.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [recommended.length]);

  const displayedPosts = posts.slice(0, visibleCount);

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full pb-16">
      <div className="w-full px-4 xl:px-8 mt-8 flex items-start justify-between gap-8">
        
        {/* Left Ad Banner */}
        <aside className="hidden lg:block w-[160px] xl:w-[10%] sticky top-24 shrink-0">
          <Ad1 className="h-[calc(100vh-9rem)]" />
        </aside>

        {/* Main Content */}
        <main className="w-full max-w-5xl">
          {/* Hero Carousel */}
          {recommended.length > 0 && (
            <section className="relative bg-gray-900 rounded-3xl overflow-hidden shadow-xl mb-16">
              <div className="absolute inset-0 bg-black/40 z-10" />
              
              <div className="relative h-[75vh] md:h-[450px] w-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <Link to={`/post/${recommended[currentIndex].id}`} className="block w-full h-full">
                      <img src={recommended[currentIndex].thumbnail} alt={recommended[currentIndex].title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent z-20" />
                      
                      <div className="absolute bottom-0 left-0 right-0 z-30 p-6 pb-16 md:p-12 md:pb-16 max-w-7xl mx-auto">
                        <div className="inline-block bg-blue-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full mb-4 shadow-lg">
                          Топ Статия
                        </div>
                        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight max-w-4xl drop-shadow-2xl">
                          {recommended[currentIndex].title}
                        </h1>
                        <p className="text-lg md:text-xl text-gray-200 mb-6 max-w-2xl line-clamp-2 drop-shadow-lg">
                          {recommended[currentIndex].subtitle}
                        </p>
                        <div className="inline-flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-full font-semibold transition-colors shadow-xl hover:shadow-2xl">
                          Прочети повече
                          <ArrowRight size={18} />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Indicators */}
              {recommended.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 z-40 flex justify-center gap-2">
                  {recommended.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        idx === currentIndex ? "bg-blue-500 w-8" : "bg-white/50 hover:bg-white/80"
                      }`}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recent Posts */}
          <section className="pt-4">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-bold text-gray-900">Последни Публикации</h2>
              <div className="h-1 flex-1 bg-gray-200 ml-6 rounded-full hidden sm:block">
                <div className="h-full w-24 bg-blue-600 rounded-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedPosts.map((post, index) => (
                <React.Fragment key={post.id}>
                  <motion.article
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group flex flex-col md:hover:-translate-y-2"
                  >
                    <Link to={`/post/${post.id}`} className="flex flex-col h-full w-full">
                      <div className="block relative aspect-[16/10] overflow-hidden">
                        <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
                      </div>
                      
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <time dateTime={post.date}>
                              {format(new Date(post.date), "d MMM yyyy", { locale: bg })}
                            </time>
                          </div>
                          <span className="text-gray-300">&bull;</span>
                          <div className="flex items-center gap-1">
                            <User size={14} />
                            <span>{post.author}</span>
                          </div>
                        </div>
                        
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                          {post.title}
                        </h3>
                        
                        <p className="text-gray-600 mb-6 line-clamp-3 flex-1">
                          {post.subtitle}
                        </p>
                        
                        <div className="mt-auto pt-4 border-t border-gray-100">
                          <div className="w-full flex items-center justify-center gap-2 bg-gray-50 group-hover:bg-blue-50 text-blue-600 px-4 py-3 rounded-xl font-semibold transition-colors">
                            Прочети статията <ArrowRight size={18} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.article>
                  
                  {/* Mobile Ad after 3rd post */}
                  {index === 2 && (
                    <div className="block lg:hidden w-full col-span-1 md:col-span-2 my-2">
                      <Ad1 className="w-full h-[250px]" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {visibleCount < posts.length && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 6)}
                  className="bg-white border-2 border-gray-200 hover:border-blue-600 hover:text-blue-600 text-gray-700 font-semibold py-3 px-8 rounded-full transition-colors flex items-center gap-2"
                >
                  Зареди още публикации
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* Mobile Ad before footer */}
            <div className="block lg:hidden w-full mt-12">
              <Ad2 className="w-full h-[250px]" />
            </div>
          </section>
        </main>

        {/* Right Ad Banner */}
        <aside className="hidden lg:block w-[160px] xl:w-[10%] sticky top-24 shrink-0">
          <Ad2 className="h-[calc(100vh-9rem)]" />
        </aside>
        
      </div>
    </div>
  );
}
