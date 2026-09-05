import { supabase, SUPABASE_URL } from "@/lib/supabase";
import { canonicalAuthUrl } from "@/lib/web3Auth";
import { tokensFromAuthPayload, type SessionTokens } from "@/lib/authSession";
import { normalizeUsernameForPolicy } from "@/lib/usernamePolicy";

export const AUTH_NEXT_KEY = "og_auth_next";

/** Short redirect so X's 500-char `state` limit is not blown. */
export function oauthRedirectTo(href?: string): string {
  const url = canonicalAuthUrl(href);
  return `${url.origin}/auth`;
}

export function stashAuthNext(next?: string | null) {
  try {
    if (next && next.startsWith("/") && next !== "/app") sessionStorage.setItem(AUTH_NEXT_KEY, next);
    else sessionStorage.removeItem(AUTH_NEXT_KEY);
  } catch { /* noop */ }
}

export function takeAuthNext(fallback = "/app"): string {
  try {
    const next = sessionStorage.getItem(AUTH_NEXT_KEY);
    sessionStorage.removeItem(AUTH_NEXT_KEY);
    if (next && next.startsWith("/")) return next;
  } catch { /* noop */ }
  return fallback;
}

export function oauthErrorFromLocation(search = typeof window !== "undefined" ? window.location.search : ""): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const desc = params.get("error_description") || params.get("error");
  return desc ? desc.replace(/\+/g, " ") : null;
}

export function consumeOAuthHash(hash = typeof window !== "undefined" ? window.location.hash : ""): SessionTokens | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  return tokensFromAuthPayload(Object.fromEntries(new URLSearchParams(raw)));
}

/** X provider tokens from GoTrue implicit hash — used to post from MCP. */
export function consumeOAuthProviderTokens(hash = typeof window !== "undefined" ? window.location.hash : ""): {
  provider_token: string;
  provider_refresh_token?: string;
  expires_in?: number;
  scope?: string;
} | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const provider_token = params.get("provider_token") || "";
  if (!provider_token) return null;
  const provider_refresh_token = params.get("provider_refresh_token") || undefined;
  const expiresRaw = params.get("provider_expires_in") || params.get("expires_in");
  const expires_in = expiresRaw ? Number(expiresRaw) : undefined;
  const scope = params.get("provider_scope") || params.get("scope") || undefined;
  return { provider_token, provider_refresh_token, expires_in, scope };
}

export function usernameFromSocialMeta(meta?: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const raw = [meta.user_name, meta.preferred_username, meta.full_name, meta.name, meta.username]
    .find((v) => typeof v === "string" && v.trim()) as string | undefined;
  if (!raw) return null;
  const clean = normalizeUsernameForPolicy(raw).replace(/[^a-z0-9_]/g, "");
  return clean.length >= 3 ? clean.slice(0, 20) : null;
}

/** Redirects to X via GoTrue authorize (no hung /token call). */
export async function startSignInWithX(next?: string): Promise<void> {
  if (!SUPABASE_URL) throw new Error("Auth is not configured");
  stashAuthNext(next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "x",
    options: {
      redirectTo: oauthRedirectTo(),
      skipBrowserRedirect: true,
      scopes: "tweet.write tweet.read users.read offline.access",
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("X sign-in did not start");
  window.location.assign(data.url);
}
