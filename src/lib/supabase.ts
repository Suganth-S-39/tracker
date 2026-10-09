// A lean Supabase client: only the parts this app uses (auth, database, Edge Functions).
//
// @supabase/supabase-js always constructs its realtime and storage clients too, which added about
// 82 KB of JavaScript to every page load for features this app doesn't use (Phase 5 Lighthouse
// pass). This wires the same building blocks the same way supabase-js does: same auth storage
// key (existing sessions keep working), and every database / function request carries the
// publishable key plus the signed-in user's token, so RLS sees the user.

import { AuthClient } from '@supabase/auth-js';
import { FunctionsClient } from '@supabase/functions-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.');
}

const base = new URL(url);

const auth = new AuthClient({
  url: new URL('auth/v1', base).href,
  headers: { Authorization: `Bearer ${publishableKey}`, apikey: publishableKey },
  // The key supabase-js uses, so a session saved by either client is found by the other.
  storageKey: `sb-${base.hostname.split('.')[0]}-auth-token`,
  // PKCE: OAuth-style redirects (email confirmation, password reset) return with ?code=, which
  // the client exchanges for a session automatically. The exchange must happen in the same browser.
  flowType: 'pkce',
  detectSessionInUrl: true,
  persistSession: true,
  autoRefreshToken: true,
});

/**
 * fetch that adds the API key and the user's session token (as supabase-js's fetchWithAuth does).
 * Without a session, database requests fall back to the key as the bearer; Edge Functions don't.
 */
function fetchWithAuth(keyAsBearerWithoutSession: boolean): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has('apikey')) headers.set('apikey', publishableKey);
    if (!headers.has('Authorization')) {
      const { data } = await auth.getSession();
      const bearer = data.session?.access_token ?? (keyAsBearerWithoutSession ? publishableKey : null);
      if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    }
    return fetch(input, { ...init, headers });
  };
}

const rest = new PostgrestClient<Database>(new URL('rest/v1', base).href, { fetch: fetchWithAuth(true) });
const functions = new FunctionsClient(new URL('functions/v1', base).href, { customFetch: fetchWithAuth(false) });

/** Same surface as the parts of supabase-js the app uses: auth, from, rpc, functions. */
export const supabase = {
  auth,
  functions,
  from: rest.from.bind(rest),
  rpc: rest.rpc.bind(rest),
};

export type { Database };
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
