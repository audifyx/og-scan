export const AUTH_STORAGE_KEY = "sol-tools-auth";
export const AUTH_BACKUP_KEY = "orbitx-auth-backup";

export type SessionTokens = { access_token: string; refresh_token: string };

export type PersistedAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: Record<string, unknown> | null;
};

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
    const b64 = part.replace(/-/g, "+").replace(/\//g, "_");
    const pad = b64.length % 4 === 0 ? b64 : `${b64}${"=".repeat(4 - (b64.length % 4))}`;
    return JSON.parse(atob(pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isExpired(session: PersistedAuthSession): boolean {
  const exp = session.expires_at
    ?? (typeof jwtPayload(session.access_token)?.exp === "number" ? jwtPayload(session.access_token)!.exp as number : 0);
  if (!exp) return false;
  return exp * 1000 < Date.now() + 15_000;
}

function parseStored(raw: string | null): PersistedAuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedAuthSession;
    if (!parsed?.access_token || typeof parsed.access_token !== "string") return null;
    if (isExpired(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Read a still-valid session without calling hung GoTrue. */
export function readPersistedSession(): PersistedAuthSession | null {
  if (typeof localStorage === "undefined") return null;
  return parseStored(localStorage.getItem(AUTH_STORAGE_KEY))
    ?? parseStored(localStorage.getItem(AUTH_BACKUP_KEY));
}

export function clearPersistedSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_BACKUP_KEY);
}

/** Write the same blob supabase-js reads on boot. Do not call setSession — it hits hung GoTrue. */
export function persistSessionLocally(tokens: SessionTokens, user?: Record<string, unknown> | null): void {
  if (typeof localStorage === "undefined") return;
  const payload = jwtPayload(tokens.access_token);
  const exp = typeof payload?.exp === "number" ? payload.exp : Math.floor(Date.now() / 1000) + 3600;
  const session: PersistedAuthSession = {
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
  const blob = JSON.stringify(session);
  localStorage.setItem(AUTH_STORAGE_KEY, blob);
  localStorage.setItem(AUTH_BACKUP_KEY, blob);
}

/** Persist tokens and reload so boot hydrates from storage instead of waiting on GoTrue. */
export async function installSupabaseSession(
  tokens: SessionTokens,
  user?: Record<string, unknown> | null,
): Promise<void> {
  persistSessionLocally(tokens, user);
  if (typeof window !== "undefined") window.location.reload();
}
