/**
 * Mirror Agent / X MCP tool results into the official Telegram bot
 * (@theorbitxmcpbot) for the linked user. Telegram-originated calls skip
 * this so the bot does not echo itself.
 */
import { formatMcpResultForTelegram } from "./telegram-mcp-allowlist.js";
import { isHoldGatedTool } from "./token-hold.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BOT_TOKEN = process.env.TELEGRAM_ORBITX_BOT_TOKEN || "";
const TG_API = () => `https://api.telegram.org/bot${BOT_TOKEN}`;

const SKIP_PUSH = new Set([
  "search",
  "fetch",
  "orbitx_menu",
  "orbitx_auth_link",
  "orbitx_auth_status",
  "orbitx_tools_help",
  "orbitx_health",
  "orbitx_config",
  "orbitx_mcp_access_status",
  "x_menu",
  "x_help",
  "x_tools_help",
  "x_auth_link",
  "x_auth_status",
  "x_mcp_access_status",
]);

const TELEGRAM_SOURCES = new Set(["telegram", "telegram_public", "orbitx_telegram"]);
const lastPushAt = new Map();

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) return null;
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      Prefer: init.headers?.Prefer || "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) return null;
  if (r.status === 204) return null;
  return r.json().catch(() => null);
}

export function shouldPushMcpToTelegram(tool, source) {
  const src = String(source || "").trim();
  if (TELEGRAM_SOURCES.has(src)) return false;
  const n = String(tool || "").trim();
  if (!n) return false;
  if (SKIP_PUSH.has(n)) return false;
  if (n.startsWith("orbitx_telegram_")) return false;
  if (n.startsWith("orbitx_auth_")) return false;
  return true;
}

function isWriteTool(tool) {
  const n = String(tool || "");
  if (isHoldGatedTool(n)) return true;
  return /(?:generate_|grok_|social_post|x_post|execute_launch|mint_nft|credits_)/.test(n);
}

function allowPushNow(userId, tool, now = Date.now()) {
  const key = String(userId || "");
  if (!key) return false;
  const prev = lastPushAt.get(key) || 0;
  const wait = isWriteTool(tool) ? 2_000 : 8_000;
  if (now - prev < wait) return false;
  lastPushAt.set(key, now);
  return true;
}

export async function loadLinkedTelegram(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  try {
    const rows = await sb(
      `telegram_orbitx_links?user_id=eq.${encodeURIComponent(id)}&select=telegram_user_id,telegram_username,wallet_address,user_id&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return row?.telegram_user_id ? row : null;
  } catch {
    return null;
  }
}

export async function sendOfficialTelegram(chatId, text, extra = {}) {
  const id = String(chatId || "").trim();
  const body = String(text || "").trim();
  if (!id || !body || !BOT_TOKEN) return { ok: false, error: "telegram_not_configured" };
  try {
    const r = await fetch(`${TG_API()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: id,
        text: body.slice(0, 3500),
        disable_web_page_preview: extra.disablePreview !== false,
        ...extra,
      }),
    });
    const data = await r.json().catch(() => ({}));
    return data?.ok ? { ok: true, result: data.result } : { ok: false, error: data?.description || "telegram_send_failed" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "telegram_send_failed" };
  }
}

export function formatMcpPushText(tool, result) {
  const name = String(tool || "tool").trim();
  const body = formatMcpResultForTelegram(result);
  return [`MCP · ${name}`, body].filter(Boolean).join("\n").slice(0, 3500);
}

/**
 * Fire-and-forget: linked Telegram DM gets a copy of MCP tool output.
 */
export async function pushMcpResultToTelegram({ userId, tool, result, source } = {}) {
  if (!shouldPushMcpToTelegram(tool, source)) return { ok: false, skipped: "source_or_tool" };
  const uid = String(userId || "").trim();
  if (!uid) return { ok: false, skipped: "no_user" };
  if (!allowPushNow(uid, tool)) return { ok: false, skipped: "rate_limit" };
  const link = await loadLinkedTelegram(uid);
  if (!link?.telegram_user_id) return { ok: false, skipped: "not_linked" };
  const text = formatMcpPushText(tool, result);
  const sent = await sendOfficialTelegram(link.telegram_user_id, text);
  return { ...sent, telegramUserId: link.telegram_user_id, tool };
}

export async function telegramStatusForUser(userId) {
  const link = await loadLinkedTelegram(userId);
  return {
    ok: true,
    linked: Boolean(link?.telegram_user_id),
    telegramUserId: link?.telegram_user_id || null,
    telegramUsername: link?.telegram_username || null,
    bot: "theorbitxmcpbot",
    botUrl: "https://t.me/theorbitxmcpbot",
    page: "https://www.orbitx.world/telegram",
    message: link?.telegram_user_id
      ? "This MCP session is linked to @theorbitxmcpbot. Tool results push to that DM."
      : "Link Telegram at https://www.orbitx.world/telegram (DM @theorbitxmcpbot /login) to receive MCP results.",
  };
}

export async function telegramSendForUser(userId, text) {
  const link = await loadLinkedTelegram(userId);
  if (!link?.telegram_user_id) {
    return {
      ok: false,
      error: "telegram_not_linked",
      message: "Link Telegram first: DM @theorbitxmcpbot → /login → https://www.orbitx.world/telegram",
      botUrl: "https://t.me/theorbitxmcpbot",
    };
  }
  const sent = await sendOfficialTelegram(link.telegram_user_id, String(text || "").slice(0, 3500));
  return { ...sent, telegramUserId: link.telegram_user_id };
}

export function resetTelegramPushThrottleForTests() {
  lastPushAt.clear();
}
