/**
 * Server-side Supabase client (service key). READ-ONLY usage in this app.
 * The service key bypasses RLS and must never reach the browser — it lives only
 * here, on the server. Mirrors server/supabase-storage.ts in the main app.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) environment variable is required.');
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required (server-side only).');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  // We only ever use the REST API, but supabase-js still constructs a Realtime
  // client at startup. On Node < 22 (Railway runs nodejs_20) that throws unless
  // given an explicit WebSocket implementation — so hand it `ws`.
  realtime: { transport: ws },
  global: { headers: { 'x-app-context': 'domestos-admin' } },
});
