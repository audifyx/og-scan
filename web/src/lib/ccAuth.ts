/**
 * CoinCommunities X/Twitter auth helpers.
 *
 * Auth flow:
 *  1. ccStartXLogin(redirectUrl)  → opens the CC Twitter OAuth URL in a popup
 *  2. Twitter redirects back to redirectUrl (must be whitelisted in CC dashboard)
 *  3. CCCallbackPage exchanges code + codeVerifier → accessToken + user
 *  4. Popup posts CC_AUTH_SUCCESS to the opener; tokens stored in localStorage
 *  5. Any postMessage call uses ccConfigureWithToken(accessToken)
 *
 * Whitelist:  https://www.ogscan.fun/cc-callback
 * Dashboard:  https://coincommunities.org/dashboard/developer → Allowed Callback URLs
 */
import { configureApi, api } from "@coin-communities/sdk";

// ─── Constants ────────────────────────────────────────────────────────────────
const CC_API_KEY = import.meta.env.VITE_CC_API_KEY ?? "";
const BASE_URL = "https://api.coin-communities.xyz";

const LS_ACCESS   = "cc_access_token";
const LS_REFRESH  = "cc_refresh_token";
const LS_USER     = "cc_user";
const LS_VERIFIER = "cc_pkce_verifier";

// ─── SDK config ────────────────────────────────────────────────────────────────
export const ccConfigureAnon = () =>
  configureApi({ apiKey: CC_API_KEY, baseUrl: BASE_URL });

export const ccConfigureWithToken = (accessToken: string) =>
  configureApi({ apiKey: CC_API_KEY, baseUrl: BASE_URL, accessToken });

// ─── PKCE ─────────────────────────────────────────────────────────────────────
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(arr.buffer);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CCUser {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  twitterId: string;
  followerCount: number;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
export const ccGetStoredAccessToken  = (): string | null => localStorage.getItem(LS_ACCESS);
export const ccGetStoredRefreshToken = (): string | null => localStorage.getItem(LS_REFRESH);
export const ccGetStoredUser         = (): CCUser | null => {
  const s = localStorage.getItem(LS_USER);
  return s ? (JSON.parse(s) as CCUser) : null;
};
export const ccGetStoredCodeVerifier = (): string | null => localStorage.getItem(LS_VERIFIER);
export const ccIsLoggedIn            = (): boolean => !!ccGetStoredAccessToken();

export function ccSaveSession(accessToken: string, refreshToken: string, user: CCUser) {
  localStorage.setItem(LS_ACCESS, accessToken);
  localStorage.setItem(LS_REFRESH, refreshToken);
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

export function ccClearAuth() {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_USER);
  localStorage.removeItem(LS_VERIFIER);
}

// ─── Auth flow ────────────────────────────────────────────────────────────────

/**
 * Step 1 — get the Twitter OAuth URL from CC and redirect in the same tab.
 * Same-tab redirect avoids popup blockers entirely.
 * After auth, CCCallbackPage navigates back to cc_return_to in sessionStorage.
 *
 * @param redirectUrl  Must be whitelisted in CC business dashboard.
 * @param onSuccess    Called if user is already logged in (should not happen here).
 * @param onError      Called with human-readable error if CC rejects the request.
 */
export async function ccStartXLogin(
  redirectUrl: string,
  onSuccess: (user: CCUser) => void,
  onError?: (msg: string) => void,
): Promise<void> {
  ccConfigureAnon();
  const { verifier } = await pkce();
  localStorage.setItem(LS_VERIFIER, verifier);
  sessionStorage.setItem("cc_return_to", window.location.pathname + window.location.search);

  // Use direct fetch — the SDK doesn't correctly forward the X-Api-Key header
  // for this endpoint (configureApi stores apiKey but the client reads options.auth).
  let authUrl: string;
  try {
    const resp = await fetch(
      `${BASE_URL}/api/v1/users/twitter/auth-url?redirectUrl=${encodeURIComponent(redirectUrl)}`,
      { headers: { "X-Api-Key": CC_API_KEY } },
    );
    const json = await resp.json() as { authUrl?: string; message?: string };
    if (!resp.ok || !json.authUrl) {
      onError?.(json.message ?? `Failed to get auth URL (${resp.status})`);
      return;
    }
    authUrl = json.authUrl;
  } catch (e) {
    onError?.("Network error — could not reach CoinCommunities API.");
    return;
  }

  // Full-page redirect — no popup, no browser block
  window.location.href = authUrl;
}

/**
 * Step 2a — Exchange Twitter OAuth code + PKCE verifier for CC tokens.
 * Called in CCCallbackPage after the Twitter redirect.
 */
export async function ccHandleTwitterCallback(
  code: string,
  codeVerifier: string,
): Promise<void> {
  ccConfigureAnon();
  const result = await api.twitterCallback({ body: { code, codeVerifier } });
  if (result.error) throw new Error((result.error as { message?: string }).message ?? "Auth failed");
  const d = result.data as { accessToken: string; refreshToken: string; user: CCUser };
  ccSaveSession(d.accessToken, d.refreshToken, d.user);
}

/**
 * Step 2b — Challenge exchange (deep-link / mobile flow).
 * CC native app deep-links to ogscan.fun?cc_challenge=CODE after login.
 */
export async function ccHandleChallengeExchange(challengeCode: string): Promise<void> {
  // Use direct fetch — SDK doesn't forward X-Api-Key header correctly
  const resp = await fetch(`${BASE_URL}/api/v1/users/twitter/challenge/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": CC_API_KEY },
    body: JSON.stringify({ challengeCode }),
  });
  const json = await resp.json() as { accessToken?: string; refreshToken?: string; user?: CCUser; message?: string };
  if (!resp.ok || !json.accessToken) throw new Error(json.message ?? "Auth failed");
  ccSaveSession(json.accessToken, json.refreshToken!, json.user!);
}

/** Refresh the access token silently */
export async function ccRefreshSession(): Promise<boolean> {
  const refreshToken = ccGetStoredRefreshToken();
  if (!refreshToken) return false;
  ccConfigureAnon();
  try {
    const result = await api.refreshToken({ body: { refreshToken } });
    if (result.error) return false;
    const d = result.data as { accessToken: string; refreshToken: string };
    localStorage.setItem(LS_ACCESS, d.accessToken);
    localStorage.setItem(LS_REFRESH, d.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ─── Community actions (require auth) ────────────────────────────────────────

/** Post a message to a token community. User must hold the token. */
export async function ccPostMessage(
  tokenAddress: string,
  content: string,
  walletAddress: string,
  chainId: "solana" | "ethereum" | "base" | "bsc" = "solana",
): Promise<void> {
  let accessToken = ccGetStoredAccessToken();
  if (!accessToken) throw new Error("Not authenticated — please sign in with X.");
  ccConfigureWithToken(accessToken);

  const result = await api.postMessage({
    path: { token_address: tokenAddress },
    body: { content, walletAddress, chainId },
  });

  // If 401, try refreshing once
  if ((result.error as { status?: number })?.status === 401) {
    const refreshed = await ccRefreshSession();
    if (!refreshed) { ccClearAuth(); throw new Error("Session expired — please sign in again."); }
    accessToken = ccGetStoredAccessToken()!;
    ccConfigureWithToken(accessToken);
    const retry = await api.postMessage({
      path: { token_address: tokenAddress },
      body: { content, walletAddress, chainId },
    });
    if (retry.error) throw new Error((retry.error as { message?: string }).message ?? "Post failed");
    return;
  }

  if (result.error) throw new Error((result.error as { message?: string }).message ?? "Post failed");
}

// ─── Like / unlike (no token-hold required, CC auth only) ────────────────────

/** Like a message. Requires CC auth; does NOT require token holding. */
export async function ccLikeMessage(
  tokenAddress: string,
  messageId: string,
): Promise<void> {
  let accessToken = ccGetStoredAccessToken();
  if (!accessToken) throw new Error("Not authenticated — please sign in with X.");
  ccConfigureWithToken(accessToken);

  const result = await api.likeMessage({
    path: { token_address: tokenAddress, message_id: messageId },
  });

  if ((result.error as { status?: number })?.status === 401) {
    const refreshed = await ccRefreshSession();
    if (!refreshed) { ccClearAuth(); throw new Error("Session expired — please sign in again."); }
    accessToken = ccGetStoredAccessToken()!;
    ccConfigureWithToken(accessToken);
    await api.likeMessage({ path: { token_address: tokenAddress, message_id: messageId } });
  }
}

/** Unlike a message. Requires CC auth. */
export async function ccUnlikeMessage(
  tokenAddress: string,
  messageId: string,
): Promise<void> {
  let accessToken = ccGetStoredAccessToken();
  if (!accessToken) throw new Error("Not authenticated — please sign in with X.");
  ccConfigureWithToken(accessToken);

  const result = await api.unlikeMessage({
    path: { token_address: tokenAddress, message_id: messageId },
  });

  if ((result.error as { status?: number })?.status === 401) {
    const refreshed = await ccRefreshSession();
    if (!refreshed) { ccClearAuth(); throw new Error("Session expired — please sign in again."); }
    accessToken = ccGetStoredAccessToken()!;
    ccConfigureWithToken(accessToken);
    await api.unlikeMessage({ path: { token_address: tokenAddress, message_id: messageId } });
  }
}

// ─── Reply (requires token holding) ─────────────────────────────────────────

/** Post a reply to a message. Requires CC auth AND token holding. */
export async function ccPostReply(
  tokenAddress: string,
  messageId: string,
  content: string,
  walletAddress: string,
  chainId: "solana" | "ethereum" | "base" | "bsc" = "solana",
): Promise<void> {
  let accessToken = ccGetStoredAccessToken();
  if (!accessToken) throw new Error("Not authenticated — please sign in with X.");
  ccConfigureWithToken(accessToken);

  const result = await api.postReply({
    path: { token_address: tokenAddress, message_id: messageId },
    body: { content, walletAddress, chainId },
  });

  if ((result.error as { status?: number })?.status === 401) {
    const refreshed = await ccRefreshSession();
    if (!refreshed) { ccClearAuth(); throw new Error("Session expired — please sign in again."); }
    accessToken = ccGetStoredAccessToken()!;
    ccConfigureWithToken(accessToken);
    const retry = await api.postReply({
      path: { token_address: tokenAddress, message_id: messageId },
      body: { content, walletAddress, chainId },
    });
    if (retry.error) throw new Error((retry.error as { message?: string }).message ?? "Reply failed");
    return;
  }

  if (result.error) throw new Error((result.error as { message?: string }).message ?? "Reply failed");
}

/** Get community members */
export async function ccGetCommunityMembers(
  tokenAddress: string,
  limit = 50,
): Promise<{ displayName: string; username: string; profileImageUrl?: string | null; followerCount: number; messageCount: number; twitterUrl: string }[]> {
  ccConfigureAnon();
  const result = await api.getCommunityMembers({
    path: { token_address: tokenAddress },
    query: { limit, offset: 0 },
  });
  if (result.error) return [];
  return ((result.data as { members?: unknown[] })?.members ?? []) as ReturnType<typeof ccGetCommunityMembers> extends Promise<infer T> ? T : never;
}
