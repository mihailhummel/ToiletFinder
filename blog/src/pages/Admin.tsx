import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import {
  Plus,
  Edit2,
  Trash2,
  LogOut,
  Star,
  StarOff,
  Image as ImageIcon,
  Eye,
  X,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  Heading,
} from "lucide-react";
import Markdown from "react-markdown";
import {
  getAllPostsAdmin,
  savePost,
  deletePost,
  checkAdminSession,
  logoutAdmin,
  BlogPost,
} from "../store";

export default function Admin() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [currentPost, setCurrentPost] = useState<Partial<BlogPost>>({});
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = currentPost.content || "";
    const selectedText = text.substring(start, end);

    const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
    setCurrentPost({ ...currentPost, content: newText });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const refreshPosts = async () => {
    const data = await getAllPostsAdmin();
    setPosts(data);
  };

  useEffect(() => {
    checkAdminSession().then((loggedIn) => {
      if (!loggedIn) {
        navigate("/login");
      } else {
        refreshPosts().then(() => setLoading(false));
      }
    });
  }, [navigate]);

  const handleLogout = async () => {
    await logoutAdmin();
    navigate("/");
  };

  const handleEdit = (post: BlogPost) => {
    setCurrentPost(post);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Сигурни ли сте, че искате да изтриете тази статия?")) {
      await deletePost(id);
      await refreshPosts();
    }
  };

  const handleToggleRecommended = async (post: BlogPost) => {
    await savePost({ ...post, is_recommended: !post.is_recommended });
    await refreshPosts();
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentPost({ ...currentPost, thumbnail: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPost.title || !currentPost.content || !currentPost.author) {
      alert("Моля, попълнете всички задължителни полета.");
      return;
    }

    await savePost({
      id: currentPost.id,
      title: currentPost.title,
      slug: currentPost.slug,
      subtitle: currentPost.subtitle || "",
      thumbnail: currentPost.thumbnail || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=1000",
      content: currentPost.content,
      meta_description: currentPost.meta_description || currentPost.subtitle || "",
      author: currentPost.author,
      is_recommended: currentPost.is_recommended || false,
      is_published: currentPost.is_published ?? true,
    });

    await refreshPosts();
    setIsEditing(false);
    setIsPreview(false);
    setCurrentPost({});
  };

  const renderPreviewContentWithAds = (content: string) => {
    const parts = content.split(/(\{insert_ad_1\}|\{insert_ad_2\})/g);
    return parts.map((part, index) => {
      if (part === "{insert_ad_1}") {
        return (
          <div key={index} className="my-8 p-8 bg-gray-100 border-2 border-dashed border-gray-300 text-center text-gray-500 rounded-xl font-medium">
            Рекламен банер 1 (Позиция)
          </div>
        );
      }
      if (part === "{insert_ad_2}") {
        return (
          <div key={index} className="my-8 p-8 bg-gray-100 border-2 border-dashed border-gray-300 text-center text-gray-500 rounded-xl font-medium">
            Рекламен банер 2 (Позиция)
          </div>
        );
      }
      return <Markdown key={index}>{part}</Markdown>;
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isPreview) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200 sticky top-20 z-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Eye className="text-blue-600" /> Режим на преглед
          </h2>
          <div className="flex gap-4">
            <button
              onClick={() => setIsPreview(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Назад към редактора
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-sm"
            >
              Запази Статията
            </button>
          </div>
        </div>

        <article className="w-full max-w-4xl mx-auto bg-white shadow-sm md:border md:border-gray-100">
          <header className="relative h-[300px] md:h-[400px] w-full bg-gray-900 overflow-hidden shadow-xl">
            {currentPost.thumbnail && (
              <img src={currentPost.thumbnail} alt={currentPost.title} className="w-full h-full object-cover opacity-80" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-2xl">
                {currentPost.title || "Заглавие на статията"}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-gray-200 drop-shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{currentPost.author || "Автор"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{format(new Date(), "d MMM yyyy", { locale: bg })}</span>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 pt-8 pb-8 md:px-12 md:py-10">
            {currentPost.subtitle && (
              <h2 className="text-2xl md:text-3xl font-medium text-gray-600 mb-10 leading-relaxed border-b border-gray-100 pb-8">
                {currentPost.subtitle}
              </h2>
            )}
            <div className="prose prose-lg md:prose-xl prose-blue max-w-none prose-headings:font-bold prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-img:rounded-2xl prose-img:shadow-md">
              {renderPreviewContentWithAds(currentPost.content || "")}
            </div>
          </div>
        </article>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentPost.id ? "Редактиране на статия" : "Нова статия"}
          </h1>
          <button
            onClick={() => setIsEditing(false)}
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            Отказ
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Заглавие *</label>
              <input
                type="text"
                value={currentPost.title || ""}
                onChange={(e) => setCurrentPost({ ...currentPost, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Подзаглавие</label>
              <input
                type="text"
                value={currentPost.subtitle || ""}
                onChange={(e) => setCurrentPost({ ...currentPost, subtitle: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Автор *</label>
              <input
                type="text"
                value={currentPost.author || ""}
                onChange={(e) => setCurrentPost({ ...currentPost, author: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Meta Description (SEO)</label>
              <input
                type="text"
                value={currentPost.meta_description || ""}
                onChange={(e) => setCurrentPost({ ...currentPost, meta_description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Описание за търсачки (до 160 символа)"
                maxLength={160}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Снимка (Thumbnail) *</label>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={currentPost.thumbnail || ""}
                    onChange={(e) => setCurrentPost({ ...currentPost, thumbnail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Въведете URL адрес на снимка..."
                  />
                  <label className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-colors border border-gray-300">
                    <ImageIcon size={18} />
                    <span>Качи</span>
                    <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" />
                  </label>
                </div>
                {currentPost.thumbnail && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={currentPost.thumbnail} alt="Preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setCurrentPost({ ...currentPost, thumbnail: "" })}
                      className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-red-500 hover:bg-red-50"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 flex justify-between">
              <span>Съдържание (Markdown) *</span>
              <span className="text-gray-500 text-xs">
                Можете да добавяте реклами чрез въвеждане на {"{insert_ad_1}"} или {"{insert_ad_2}"}
              </span>
            </label>
            <div className="bg-white rounded-lg overflow-hidden border border-gray-300">
              <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
                <button type="button" onClick={() => insertMarkdown("**", "**")} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="Bold">
                  <Bold size={18} />
                </button>
                <button type="button" onClick={() => insertMarkdown("*", "*")} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="Italic">
                  <Italic size={18} />
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <button type="button" onClick={() => insertMarkdown("### ")} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="Heading">
                  <Heading size={18} />
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <button type="button" onClick={() => insertMarkdown("[", "](url)")} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="Link">
                  <LinkIcon size={18} />
                </button>
                <button type="button" onClick={() => insertMarkdown("- ")} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="List">
                  <List size={18} />
                </button>
              </div>
              <textarea
                ref={textareaRef}
                value={currentPost.content || ""}
                onChange={(e) => setCurrentPost({ ...currentPost, content: e.target.value })}
                className="w-full min-h-[400px] p-4 outline-none resize-y font-mono text-sm"
                placeholder="Напишете вашата статия тук използвайки Markdown формат..."
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3 py-4 border-t border-gray-100">
            <input
              type="checkbox"
              id="isRecommended"
              checked={currentPost.is_recommended || false}
              onChange={(e) => setCurrentPost({ ...currentPost, is_recommended: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isRecommended" className="text-gray-700 font-medium cursor-pointer flex items-center gap-2">
              <Star size={18} className={currentPost.is_recommended ? "text-yellow-500 fill-yellow-500" : "text-gray-400"} />
              Добави в Топ Статии (Карусел)
            </label>
          </div>

          <div className="flex items-center gap-3 pb-4">
            <input
              type="checkbox"
              id="isPublished"
              checked={currentPost.is_published ?? true}
              onChange={(e) => setCurrentPost({ ...currentPost, is_published: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isPublished" className="text-gray-700 font-medium cursor-pointer">
              Публикувана (видима за всички)
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Отказ
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center gap-2"
            >
              <Eye size={18} />
              Преглед
            </button>
            <button
              type="submit"
              className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-sm"
            >
              Запази Статията
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Админ Панел</h1>
          <p className="text-gray-500 mt-1">Управление на публикациите в блога</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setCurrentPost({ author: "Екипът на Toaletna.com", is_published: true });
              setIsEditing(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Нова Статия
          </button>
          <button
            onClick={handleLogout}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors"
          >
            <LogOut size={18} />
            Изход
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Статия</th>
                <th className="px-6 py-4 font-medium">Автор</th>
                <th className="px-6 py-4 font-medium">Дата</th>
                <th className="px-6 py-4 font-medium text-center">Статус</th>
                <th className="px-6 py-4 font-medium text-center">Топ</th>
                <th className="px-6 py-4 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Няма намерени публикации. Създайте първата си статия!
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={post.thumbnail}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
                        />
                        <div>
                          <p className="font-bold text-gray-900 line-clamp-1">{post.title}</p>
                          <p className="text-sm text-gray-500 line-clamp-1">{post.subtitle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{post.author}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {format(new Date(post.date), "dd.MM.yyyy", { locale: bg })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${post.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {post.is_published ? "Публикувана" : "Чернова"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleRecommended(post)}
                        className={`p-2 rounded-full transition-colors ${post.is_recommended ? "bg-yellow-50 text-yellow-500 hover:bg-yellow-100" : "text-gray-400 hover:bg-gray-100"}`}
                        title={post.is_recommended ? "Премахни от Топ" : "Добави в Топ"}
                      >
                        {post.is_recommended ? <Star size={20} className="fill-yellow-500" /> : <StarOff size={20} />}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(post)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Редактирай"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Изтрий"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
