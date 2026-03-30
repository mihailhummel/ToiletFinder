import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Blog Supabase client — isolated configuration.
 *
 * Currently shares the same Supabase project as the platform.
 * To split into a separate project later:
 *   1. Create a new Supabase project
 *   2. Run the blog migration SQL (see /blog/supabase/migrations/)
 *   3. Update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the blog's .env
 *   4. Done — no code changes needed
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-app-context': 'toaletna-blog',
    },
  },
});
