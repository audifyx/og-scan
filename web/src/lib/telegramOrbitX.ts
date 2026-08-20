/** Official OrbitX Telegram bot companion — /api/telegram-orbitx (not MCP OAuth). */

export const TELEGRAM_ORBITX_API = "/api/telegram-orbitx";
export const TELEGRAM_ORBITX_BOT = "theorbitxmcpbot";
export const TELEGRAM_ORBITX_TME = `https://t.me/${TELEGRAM_ORBITX_BOT}`;

export type TelegramOrbitXLink = {
  telegram_user_id: string;
  telegram_username?: string | null;
  wallet_address?: string | null;
  auto_buy?: boolean | null;
  created_at?: string;
};

export type TelegramOrbitXStatus = {
  ok: boolean;
  bot: { username: string; name: string; about: string };
  signedIn?: boolean;
  autoBuy?: boolean;
  autoWallet?: string | null;
  links: TelegramOrbitXLink[];
  tools: number;
};

export type TelegramOrbitXCallResult = {
  ok: boolean;
  tool: string;
  text?: string;
  imageUrls?: string[];
  result?: Record<string, unknown>;
  error?: string;
  message?: string;
};

async function optionalAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* public tools still work unsigned */
  }
  return headers;
}

async function requireAuthHeaders(): Promise<HeadersInit> {
  const headers = await optionalAuthHeaders();
  if (!("Authorization" in headers)) throw new Error("Not signed in");
  return headers;
}

async function readJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(r.ok ? "Invalid JSON from Telegram API" : `Server error (${r.status})`);
  }
}

async function post(
  body: Record<string, unknown>,
  headers: HeadersInit,
): Promise<Record<string, unknown>> {
  const r = await fetch(TELEGRAM_ORBITX_API, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await readJson(r);
  if (!r.ok) {
    throw new Error(String(json.message || json.error || `Request failed (${r.status})`));
  }
  return json;
}

export async function telegramOrbitXHealth(): Promise<{ ok: boolean; tools: number; tokenConfigured: boolean; bot: string }> {
  const r = await fetch(`${TELEGRAM_ORBITX_API}?action=health`);
  const json = await readJson(r);
  return {
    ok: Boolean(json.ok),
    tools: Number(json.tools || 0),
    tokenConfigured: Boolean(json.tokenConfigured),
    bot: String(json.bot || TELEGRAM_ORBITX_BOT),
  };
}

export async function telegramOrbitXStatus(): Promise<TelegramOrbitXStatus> {
  const json = await post({ action: "web.status" }, await optionalAuthHeaders());
  return json as unknown as TelegramOrbitXStatus;
}

export async function telegramOrbitXCmds(query = ""): Promise<{
  text: string;
  page: number;
  totalPages: number;
  count: number;
  tools: Array<{ name: string; description?: string }>;
}> {
  const json = await post({ action: "web.cmds", query }, await optionalAuthHeaders());
  return {
    text: String(json.text || ""),
    page: Number(json.page || 1),
    totalPages: Number(json.totalPages || 1),
    count: Number(json.count || 0),
    tools: Array.isArray(json.tools) ? (json.tools as Array<{ name: string; description?: string }>) : [],
  };
}

export async function telegramOrbitXLink(code: string): Promise<{ telegramUserId: string; wallet: string | null }> {
  const json = await post({ action: "web.link", code }, await requireAuthHeaders());
  const link = (json.link || {}) as Record<string, unknown>;
  return {
    telegramUserId: String(link.telegramUserId || ""),
    wallet: (link.wallet as string | null) || null,
  };
}

export async function telegramOrbitXCall(
  tool: string,
  args: Record<string, unknown> = {},
): Promise<TelegramOrbitXCallResult> {
  const json = await post({ action: "web.call", tool, args }, await optionalAuthHeaders());
  return json as unknown as TelegramOrbitXCallResult;
}

export async function telegramOrbitXSetAutoBuy(
  enabled: boolean,
): Promise<{ autoBuy: boolean; autoWallet?: string | null; message?: string }> {
  const json = await post({ action: "web.autobuy", enabled: Boolean(enabled) }, await requireAuthHeaders());
  return {
    autoBuy: Boolean(json.autoBuy),
    autoWallet: typeof json.autoWallet === "string" ? json.autoWallet : null,
    message: typeof json.message === "string" ? json.message : undefined,
  };
}
