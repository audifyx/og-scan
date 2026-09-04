/**
 * Classify pasted OrbitX auth material.
 *
 * Telegram /login URLs (`/telegram?code=`) are NOT Grok/Claude MCP authCodes
 * (`/agent/link-auth?code=oxlink_…` or dashboard `authCode:` paste).
 */

export const TELEGRAM_LOGIN_CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
export const ORBITX_WWW = "https://www.orbitx.world";

export const TELEGRAM_LOGIN_NOT_MCP_MESSAGE =
  "That's the Telegram bot login link, not a Grok/Claude authCode. Open it in Chrome or Edge on your computer — do not paste it into this chat. Sign in with Phantom / Solflare / Jupiter, then tap Confirm Telegram link. For this chat, call orbitx_auth_link or paste a dashboard authCode message.";

export function normalizeTelegramLoginCode(raw) {
  const code = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return TELEGRAM_LOGIN_CODE_RE.test(code) ? code : "";
}

export function telegramLoginUrl(code, base = ORBITX_WWW) {
  const origin = String(base || ORBITX_WWW)
    .replace(/\/$/, "")
    .replace("://orbitx.world", "://www.orbitx.world");
  const normalized = normalizeTelegramLoginCode(code) || String(code || "").trim().toUpperCase();
  return `${origin}/telegram?code=${encodeURIComponent(normalized)}`;
}

function decodeHtmlAmp(value) {
  return String(value || "").replace(/&amp;/gi, "&");
}

function tryUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    if (/^https?:\/\//i.test(s)) return new URL(s);
    if (/^(?:www\.)?orbitx\.world\//i.test(s)) return new URL(`https://${s.replace(/^\/+/, "")}`);
  } catch {
    return null;
  }
  return null;
}

function codeFromTelegramUrl(raw) {
  const u = tryUrl(decodeHtmlAmp(raw));
  if (!u) return "";
  const nested = u.searchParams.get("url") || u.searchParams.get("u");
  if (nested) {
    try {
      const inner = codeFromTelegramUrl(decodeURIComponent(nested));
      if (inner) return inner;
    } catch {
      /* ignore */
    }
  }
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "").toLowerCase();
  const isOrbitX =
    host === "orbitx.world" ||
    host.endsWith(".orbitx.world") ||
    host === "localhost" ||
    host === "127.0.0.1";
  if (!isOrbitX) return "";
  if (path !== "/telegram" && !path.endsWith("/telegram")) return "";
  const fromSearch = u.searchParams.get("code");
  if (fromSearch) return normalizeTelegramLoginCode(fromSearch);
  const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
  if (hash) {
    const hp = new URLSearchParams(hash.startsWith("/") ? hash.replace(/^\/telegram\/?/, "") : hash);
    const fromHash = hp.get("code") || (hash.startsWith("code=") ? hash.slice(5) : "");
    if (fromHash) return normalizeTelegramLoginCode(fromHash.split("&")[0]);
  }
  return "";
}

export function extractTelegramLoginCode(raw) {
  const text = decodeHtmlAmp(String(raw || "").trim());
  if (!text) return "";
  const direct = normalizeTelegramLoginCode(text);
  if (direct) return direct;
  const fromWhole = codeFromTelegramUrl(text);
  if (fromWhole) return fromWhole;
  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch) {
    const fromHttp = codeFromTelegramUrl(urlMatch[0].replace(/[),.;]+$/, ""));
    if (fromHttp) return fromHttp;
  }
  const hostMatch = text.match(/(?:www\.)?orbitx\.world\/telegram[^\s<>"']*/i);
  if (hostMatch) {
    const fromHost = codeFromTelegramUrl(hostMatch[0]);
    if (fromHost) return fromHost;
  }
  const q = text.match(/[?&#]code=([A-HJ-NP-Za-z0-9]{6,12})/i);
  if (q && /\/telegram/i.test(text)) return normalizeTelegramLoginCode(q[1]);
  return "";
}

export function isTelegramLoginPaste(raw) {
  const text = String(raw || "");
  if (!/telegram/i.test(text)) return false;
  if (!/orbitx\.world|localhost|127\.0\.0\.1/i.test(text) && !/\/telegram\?/i.test(text)) return false;
  return Boolean(extractTelegramLoginCode(text));
}

export function extractAgentLinkAuthCode(raw) {
  const text = decodeHtmlAmp(String(raw || "").trim());
  if (!text) return "";
  const fromUrl = (s) => {
    const u = tryUrl(s);
    if (!u) return "";
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    if (path === "/agent/link-auth" || path.endsWith("/link-auth")) {
      return String(u.searchParams.get("code") || "").trim();
    }
    return "";
  };
  const whole = fromUrl(text);
  if (whole) return whole;
  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch) {
    const nested = fromUrl(urlMatch[0].replace(/[),.;]+$/, ""));
    if (nested) return nested;
  }
  const m = text.match(/authCode[:\s]+([A-Za-z0-9_-]{8,})/i);
  if (m) return m[1];
  return "";
}

/**
 * @returns {{ kind: "empty" | "telegram_login" | "agent_link" | "auth_code", code: string, url?: string }}
 */
export function classifyOrbitXAuthPaste(raw) {
  const text = String(raw || "").trim();
  if (!text) return { kind: "empty", code: "" };
  if (isTelegramLoginPaste(text)) {
    const code = extractTelegramLoginCode(text);
    return { kind: "telegram_login", code, url: telegramLoginUrl(code) };
  }
  const agent = extractAgentLinkAuthCode(text);
  if (agent) return { kind: "agent_link", code: agent };
  if (/^oxlink[_-]/i.test(text)) return { kind: "auth_code", code: text };
  return { kind: "auth_code", code: text };
}
