import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side only — never import into a client component.
// Lazily instantiated so `next build` doesn't need the service-role env,
// and untyped because the generated Database types lag the live schema.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}

// Proxy keeps the `supabaseAdmin.from(...)` call sites unchanged while
// deferring the actual client creation until first use (request time).
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop: string) {
    const c = getClient() as any;
    const v = c[prop];
    return typeof v === 'function' ? v.bind(c) : v;
  },
});
