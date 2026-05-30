/**
 * xAuth — Twitter OAuth 2.0 PKCE helpers for OG Scan.
 * Used for connecting X account with tweet.write scope so users can cross-post.
 *
 * Flow:
 *  1. xStartLogin()  — generates PKCE verifier, redirects user to Twitter OAuth
 *  2. /x-callback    — Twitter redirects back with code; XCallbackPage calls xExchangeCode()
 *  3. xExchangeCode() — exchanges code for access_token; saves via Supabase edge function
 */

const TWITTER_OAUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

const LS_VERIFIER = "x_pkce_verifier";
const LS_STATE = "x_pkce_state";

// Public OAuth 2.0 Client ID (safe to expose — only used for PKCE redirect, not secret operations)
export const X_CLIENT_ID = import.meta.env.VITE_TWITTER_CLIENT_ID || "VEttdDM5YUtpMGJsbURCSmhBMEg6MTpjaQ";
export const X_CALLBACK_URL = `${window.location.origin}/x-callback`;
export const X_SCOPES = "tweet.write tweet.read like.read users.read follows.read space.read offline.access";

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function randomString(len = 64): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr.buffer).slice(0, len);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Starts the Twitter OAuth 2.0 PKCE flow.
 * Redirects the user to Twitter — call from Settings → Connections tab.
 */
export async function xStartLogin(): Promise<void> {
  if (!X_CLIENT_ID) {
    console.warn("[xAuth] VITE_TWITTER_CLIENT_ID not set");
    return;
  }
  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = base64urlEncode(await sha256(verifier));

  localStorage.setItem(LS_VERIFIER, verifier);
  localStorage.setItem(LS_STATE, state);
  sessionStorage.setItem("x_return_to", window.location.pathname + window.location.search);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: X_CLIENT_ID,
    redirect_uri: X_CALLBACK_URL,
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${TWITTER_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges the authorization code for tokens.
 * Call this from XCallbackPage after Twitter redirects back.
 * Returns { access_token, refresh_token, expires_in } or throws on error.
 */
export async function xExchangeCode(code: string, returnedState: string, authToken?: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  twitter_id?: string;
  twitter_username?: string;
  twitter_name?: string;
  twitter_avatar?: string;
}> {
  const verifier = localStorage.getItem(LS_VERIFIER);
  const savedState = localStorage.getItem(LS_STATE);

  if (!verifier) throw new Error("PKCE verifier missing — please try connecting again.");
  if (returnedState !== savedState) throw new Error("State mismatch — possible CSRF. Please try again.");

  // Token exchange happens via Supabase edge function (server-side, hides client_secret)
  // Must include user's JWT so the function can save tokens to the right profile row
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-oauth-callback`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code, verifier, redirectUri: X_CALLBACK_URL }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Token exchange failed (${res.status})`);
  }

  const data = await res.json();
  localStorage.removeItem(LS_VERIFIER);
  localStorage.removeItem(LS_STATE);
  return data;
}

/** Returns stored X connection info from localStorage (set after successful auth). */
export interface XUser {
  twitterId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
}

export function xGetStoredUser(): XUser | null {
  try {
    const raw = localStorage.getItem("x_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function xSetStoredUser(user: XUser | null): void {
  try {
    if (user) localStorage.setItem("x_user", JSON.stringify(user));
    else localStorage.removeItem("x_user");
  } catch {}
}

export function xIsConnected(): boolean {
  return !!localStorage.getItem("x_user");
}
