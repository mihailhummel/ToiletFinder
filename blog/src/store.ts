import { supabase } from './lib/supabase';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  thumbnail: string;
  content: string;
  meta_description: string;
  date: string;
  last_edit_date?: string;
  author: string;
  is_recommended: boolean;
  is_published: boolean;
}

const AUTH_KEY = 'toaletna_blog_admin_auth';

// ── Public read operations (use anon key, governed by RLS) ──

export const getPosts = async (): Promise<BlogPost[]> => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('is_published', true)
    .order('date', { ascending: false });

  if (error) {
    console.error('Failed to fetch posts:', error.message);
    return [];
  }
  return data ?? [];
};

export const getPost = async (id: string): Promise<BlogPost | null> => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (error) return null;
  return data;
};

export const getPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error) return null;
  return data;
};

// ── Admin operations (require Supabase auth session) ──

export const getAllPostsAdmin = async (): Promise<BlogPost[]> => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Failed to fetch admin posts:', error.message);
    return [];
  }
  return data ?? [];
};

export const savePost = async (post: Partial<BlogPost> & { title: string; content: string; author: string }): Promise<BlogPost | null> => {
  const slug = post.slug || post.title
    .toLowerCase()
    .replace(/[^a-zа-яёіїєґ0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  if (post.id) {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        title: post.title,
        slug,
        subtitle: post.subtitle || '',
        thumbnail: post.thumbnail || '',
        content: post.content,
        meta_description: post.meta_description || post.subtitle || '',
        author: post.author,
        is_recommended: post.is_recommended ?? false,
        is_published: post.is_published ?? true,
        last_edit_date: new Date().toISOString(),
      })
      .eq('id', post.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update post:', error.message);
      return null;
    }
    return data;
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: post.title,
      slug,
      subtitle: post.subtitle || '',
      thumbnail: post.thumbnail || '',
      content: post.content,
      meta_description: post.meta_description || post.subtitle || '',
      author: post.author,
      is_recommended: post.is_recommended ?? false,
      is_published: post.is_published ?? true,
      date: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create post:', error.message);
    return null;
  }
  return data;
};

export const deletePost = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete post:', error.message);
    return false;
  }
  return true;
};

// ── Admin auth (Supabase email/password auth) ──

export const isAdminLoggedIn = (): boolean => {
  return localStorage.getItem(AUTH_KEY) === 'true';
};

export const checkAdminSession = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  const loggedIn = !!data.session;
  localStorage.setItem(AUTH_KEY, loggedIn ? 'true' : 'false');
  return loggedIn;
};

export const loginAdmin = async (email: string, password: string): Promise<boolean> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Login failed:', error.message);
    localStorage.setItem(AUTH_KEY, 'false');
    return false;
  }
  localStorage.setItem(AUTH_KEY, 'true');
  return true;
};

export const logoutAdmin = async (): Promise<void> => {
  await supabase.auth.signOut();
  localStorage.removeItem(AUTH_KEY);
};
