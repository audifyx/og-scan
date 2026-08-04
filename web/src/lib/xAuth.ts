/**
 * xAuth — Twitter OAuth 2.0 PKCE helpers for OrbitX.
 *
 * Authorize URL is built on the server (/api/x/agent/oauth/start) so
 * Vercel TWITTER_CLIENT_ID is used — no VITE_ client id required.
 */

const LS_VERIFIER = "x_pkce_verifier";
const LS_STATE = "x_pkce_state";
const LS_REDIRECT = "x_pkce_redirect";

/** @deprecated — server oauth/start uses TWITTER_CLIENT_ID from Vercel */
export const X_CLIENT_ID = import.meta.env.VITE_TWITTER_CLIENT_ID || "";

/** Always www in prod — apex vs www mismatch breaks X OAuth. */
export function xCallbackUrl(): string {
  if (typeof window === "undefined") return "https://www.orbitx.world/x-callback";
  const host = window.location.hostname;
  if (host === "orbitx.world" || host === "www.orbitx.world") {
    return "https://www.orbitx.world/x-callback";
  }
  if (host === "ogscan.fun" || host === "www.ogscan.fun") {
    return "https://www.ogscan.fun/x-callback";
  }
  return `${window.location.origin}/x-callback`;
}

/** @deprecated use xCallbackUrl() */
export const X_CALLBACK_URL =
  typeof window !== "undefined" ? xCallbackUrl() : "https://www.orbitx.world/x-callback";

export const X_SCOPES = "tweet.write tweet.read users.read offline.access";

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}

function randomString(len = 64): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr.buffer).slice(0, len);
}

/** Starts X OAuth — server builds authorize URL with Vercel TWITTER_CLIENT_ID. */
export async function xStartLogin(): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = base64urlEncode(await sha256(verifier));
  const redirectUri = xCallbackUrl();

  localStorage.setItem(LS_VERIFIER, verifier);
  localStorage.setItem(LS_STATE, state);
  localStorage.setItem(LS_REDIRECT, redirectUri);
  sessionStorage.setItem("x_return_to", window.location.pathname + window.location.search);

  const res = await fetch("/api/x/agent/oauth/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirectUri,
      codeChallenge: challenge,
      state,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.authorizeUrl) {
    throw new Error(
      String(
        data.error ||
          data.message ||
          `Could not start X login (${res.status}). Add TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET on Vercel and redeploy.`,
      ),
    );
  }

  window.location.href = String(data.authorizeUrl);
}

export async function xExchangeCode(
  code: string,
  returnedState: string,
  authToken?: string,
): Promise<{
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
  const redirectUri = localStorage.getItem(LS_REDIRECT) || xCallbackUrl();

  if (!verifier) throw new Error("PKCE verifier missing — please try connecting again.");
  if (returnedState !== savedState) throw new Error("State mismatch — possible CSRF. Please try again.");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res = await fetch("/api/x/agent/oauth/callback", {
    method: "POST",
    headers,
    body: JSON.stringify({ code, verifier, redirectUri }),
  });

  if (res.status === 404 || res.status === 405) {
    const supa = import.meta.env.VITE_SUPABASE_URL;
    if (supa) {
      res = await fetch(`${supa}/functions/v1/x-oauth-callback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ code, verifier, redirectUri }),
      });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail =
      typeof err.details === "object"
        ? JSON.stringify(err.details)
        : err.details || err.hint || "";
    throw new Error(
      [err.error || `Token exchange failed (${res.status})`, detail].filter(Boolean).join(" — "),
    );
  }

  const data = await res.json();
  localStorage.removeItem(LS_VERIFIER);
  localStorage.removeItem(LS_STATE);
  localStorage.removeItem(LS_REDIRECT);
  return data;
}

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
  } catch {
    return null;
  }
}

export function xSetStoredUser(user: XUser | null): void {
  try {
    if (user) localStorage.setItem("x_user", JSON.stringify(user));
    else localStorage.removeItem("x_user");
  } catch {
    /* ignore */
  }
}

export function xIsConnected(): boolean {
  return !!localStorage.getItem("x_user");
}
