import { supabase } from "@/lib/supabase";

export const AUTH_STORAGE_KEY = "sol-tools-auth";
export const SET_SESSION_TIMEOUT_MS = 8_000;

export type SessionTokens = { access_token: string; refresh_token: string };

export function tokensFromAuthPayload(json: Record<string, unknown>): SessionTokens | null {
  const session = json.session && typeof json.session === "object" ? json.session as Record<string, unknown> : null;
  const access = json.access_token || session?.access_token;
  const refresh = json.refresh_token || session?.refresh_token;
  if (typeof access === "string" && access && typeof refresh === "string" && refresh) {
    return { access_token: access, refresh_token: refresh };
  }
  return null;
}

function jwtPayload(access: string): Record<string, unknown> | null {
  try {
    const part = access.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? b64 : `${b64}${"=".repeat(4 - (b64.length % 4))}`;
    return JSON.parse(atob(pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Write the same shape supabase-js persists, then reload so a hung auth lock cannot block login. */
export function persistSessionLocally(tokens: SessionTokens, user?: Record<string, unknown> | null): void {
  if (typeof localStorage === "undefined") return;
  const payload = jwtPayload(tokens.access_token);
  const exp = typeof payload?.exp === "number" ? payload.exp : Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: exp,
    expires_in: Math.max(0, exp - Math.floor(Date.now() / 1000)),
    token_type: "bearer",
    user: user || {
      id: payload?.sub,
      email: payload?.email,
      aud: payload?.aud,
      role: payload?.role,
      app_metadata: payload?.app_metadata,
      user_metadata: payload?.user_metadata,
    },
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function installSupabaseSession(
  tokens: SessionTokens,
  user?: Record<string, unknown> | null,
): Promise<void> {
  const attempt = supabase.auth.setSession(tokens);
  const timed = await Promise.race([
    attempt.then((r) => ({ timedOut: false as const, r })),
    new Promise<{ timedOut: true }>((resolve) => {
      globalThis.setTimeout(() => resolve({ timedOut: true }), SET_SESSION_TIMEOUT_MS);
    }),
  ]);
  if (!timed.timedOut && !timed.r.error) return;
  persistSessionLocally(tokens, user);
  if (typeof window !== "undefined") window.location.reload();
}
