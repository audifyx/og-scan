/** Native Supabase Web3 (SIWS) helpers. Do not call public GoTrue /token from the browser. */

export const WEB3_STATEMENT =
  "Sign in to OrbitX. This request will not trigger a transaction or cost any fees.";

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function canonicalAuthUrl(href?: string): URL {
  const raw = href || (typeof window !== "undefined" ? window.location.href : "https://www.orbitx.world/auth");
  const url = new URL(raw);
  if (url.hostname === "orbitx.world") url.hostname = "www.orbitx.world";
  if (url.hostname === "ogscan.fun") url.hostname = "www.ogscan.fun";
  url.hash = "";
  url.search = "";
  if (!url.pathname || url.pathname === "/") url.pathname = "/auth";
  return url;
}

/** EIP-4361 / Sign-in-with-Solana message matching supabase-js signInWithWeb3. */
export function buildSolanaSiwsMessage(pubkey: string, href?: string, issuedAt?: string): string {
  const url = canonicalAuthUrl(href);
  return [
    `${url.host} wants you to sign in with your Solana account:`,
    pubkey,
    "",
    WEB3_STATEMENT,
    "",
    "Version: 1",
    `URI: ${url.href}`,
    `Issued At: ${issuedAt || new Date().toISOString()}`,
  ].join("\n");
}

export function isLikelyNewAuthUser(user: Record<string, unknown> | null | undefined): boolean {
  if (!user) return true;
  const created = typeof user.created_at === "string" ? Date.parse(user.created_at) : NaN;
  if (Number.isFinite(created) && Date.now() - created < 120_000) return true;
  const last = typeof user.last_sign_in_at === "string" ? Date.parse(user.last_sign_in_at) : NaN;
  if (Number.isFinite(created) && Number.isFinite(last) && Math.abs(last - created) < 5_000) return true;
  return false;
}

function looksLikePlatformCrash(res: Response, json: Record<string, unknown>): boolean {
  if (res.status >= 500) return true;
  const ct = res.headers?.get?.("content-type") || "";
  return !ct.includes("application/json") && Object.keys(json).length === 0;
}

export function web3AuthErrorMessage(raw: unknown): string {
  const text = typeof raw === "string"
    ? raw
    : raw && typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string"
      ? (raw as { error: string }).error
      : raw && typeof raw === "object" && "message" in raw && typeof (raw as { message: unknown }).message === "string"
        ? (raw as { message: string }).message
        : "Wallet sign-in failed";
  if (/reject|cancel|denied/i.test(text)) return text;
  if (/timed out|timeout|503|FUNCTION_INVOCATION_FAILED/i.test(text)) {
    return "Wallet login timed out. Please try again.";
  }
  if (/redirect|uri|domain/i.test(text)) {
    return "This site is not allowed for Web3 login. Use www.orbitx.world.";
  }
  return text;
}

/** Exchange a signed SIWS message via same-origin /api/auth-web3. */
export async function exchangeWeb3Session(
  message: string,
  signature: Uint8Array,
): Promise<{ access_token: string; refresh_token: string; user: Record<string, unknown> | null }> {
  const res = await fetch("/api/auth-web3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chain: "solana",
      message,
      signature: bytesToBase64Url(signature),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (looksLikePlatformCrash(res, json) || !res.ok) {
    throw new Error(web3AuthErrorMessage(json.error || json.msg || json.message || `Wallet sign-in failed (${res.status})`));
  }
  const session = json.session && typeof json.session === "object" ? json.session as Record<string, unknown> : json;
  const access = session.access_token;
  const refresh = session.refresh_token;
  if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
    throw new Error("Wallet sign-in failed — no session returned");
  }
  const user = (json.user || session.user) && typeof (json.user || session.user) === "object"
    ? (json.user || session.user) as Record<string, unknown>
    : null;
  return { access_token: access, refresh_token: refresh, user };
}
