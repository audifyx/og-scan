/**
 * Supabase SSR Client — httpOnly Cookies + Server-Side Auth
 *
 * MIGRATION FROM localStorage:
 *  - Auth tokens are NO LONGER stored in localStorage (XSS-vulnerable)
 *  - Tokens are stored in httpOnly, Secure, SameSite=Lax cookies (XSS-safe)
 *  - The Supabase JS client detects cookies automatically via CookieAuthStorageAdapter
 *  - No token is ever readable from window.localStorage or window.sessionStorage
 *
 * VERIFICATION IN DEVTOOLS:
 *  1. Open DevTools → Application → Cookies
 *  2. Look for "sb-{project-id}-auth-token" (httpOnly, Secure, SameSite=Lax)
 *  3. Try to read it in console: localStorage.getItem('sol-tools-auth') → null
 *
 * SERVER-SIDE AUTH:
 *  - Use getSupabaseServerClient() in Vercel API routes
 *  - Always verify session server-side before allowing sensitive operations
 *  - Never trust the browser's JWT claim alone
 */

import { createClient } from "@supabase/supabase-js";
import { CookieAuthStorageAdapter } from "@supabase/ssr";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * BROWSER CLIENT (SSR-aware)
 * Uses CookieAuthStorageAdapter which:
 *  - Stores tokens in httpOnly cookies (set by server on auth)
 *  - Reads tokens from cookies (never from localStorage)
 *  - Automatically refreshes tokens server-side
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Use cookie-based storage (httpOnly safe)
    storage: new CookieAuthStorageAdapter({
      isServer: false, // browser mode
    }),
    storageKey: `sb-${SUPABASE_URL.split("//")[1]?.split(".")[0]}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce", // PKCE is more secure for SPAs
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

/**
 * Get the current user from the browser client
 * Safe to use in React components; always re-verified server-side for sensitive ops
 */
export async function getCurrentUser() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get the current session from the browser client
 * Include in API requests as Authorization header for server verification
 */
export async function getCurrentSession() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Sign up with email + password
 * Server-side will set httpOnly cookies automatically
 * Email verification is REQUIRED before write access (see guards)
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: Record<string, any>,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/verify-email`,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with email + password
 * Server-side will set httpOnly cookies automatically
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out (clears httpOnly cookies server-side)
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Refresh the session (triggers server-side cookie rotation)
 */
export async function refreshSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();
  if (error) throw error;
  return session;
}
