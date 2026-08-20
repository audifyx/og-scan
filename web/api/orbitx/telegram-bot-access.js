/**
 * Official-bot early access: redeem a code or verify an $ORBITX burn via Solscan.
 */
import {
  formatRemaining,
  isAccessActive,
  parseSolanaTxSignature,
  remainingMs,
  resolvePackage,
} from "./mcp-burn-access.js";

export function normalizeEarlyAccessCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

export function looksLikeEarlyAccessCode(raw) {
  const code = normalizeEarlyAccessCode(raw);
  return code.length >= 4 && code.length <= 24 && /^[A-Z0-9]+$/.test(code);
}

export function resolveBurnPackageFromText(text) {
  const compact = String(text || "")
    .toLowerCase()
    .replace(/[@/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/\b(month|1\s*mo|30\s*d|1000k|1,?000,?000)\b/.test(compact)) return resolvePackage("month");
  if (/\b(week|1w|7\s*d|10k|10,?000)\b/.test(compact)) return resolvePackage("week");
  if (/\b(day|1d|24h|1k|1,?000)\b/.test(compact) && !/\bhour\b/.test(compact)) return resolvePackage("day");
  if (/\b(hour|1h|1\s*hr|100)\b/.test(compact)) return resolvePackage("hour");
  const rest = compact.replace(/^(?:burn|shop|access)\s+/, "").trim();
  return resolvePackage(compact) || resolvePackage(rest);
}

export function looksLikeSolanaTxRef(text) {
  const raw = String(text || "").trim();
  const sig = parseSolanaTxSignature(raw);
  if (!sig) return false;
  if (/(?:solscan\.io|explorer\.solana\.com|solana\.fm)\/tx\//i.test(raw)) return true;
  const compact = raw.replace(/\s+/g, "");
  return compact.length >= 64 && compact.length <= 120 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(compact);
}

function envCodes() {
  const raw = String(process.env.TELEGRAM_EARLY_ACCESS_CODES || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((c) => normalizeEarlyAccessCode(c))
    .filter((c) => c.length >= 4);
}

function envCodeDurationSeconds() {
  const n = Number(process.env.TELEGRAM_EARLY_ACCESS_SECONDS || 7 * 24 * 60 * 60);
  return Number.isFinite(n) && n > 0 ? n : 7 * 24 * 60 * 60;
}

export async function loadTelegramBotAccess(sb, telegramUserId) {
  const id = String(telegramUserId || "").trim();
  if (!id || typeof sb !== "function") return null;
  try {
    const rows = await sb(
      `telegram_bot_access?telegram_user_id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return row || null;
  } catch {
    return null;
  }
}

export function accessStatusFromRow(row, now = Date.now()) {
  if (!row) {
    return { active: false, remainingLabel: "No access", remainingMs: 0, expiresAt: null, source: null };
  }
  const expiresAt = row.expires_at || null;
  const active = isAccessActive(expiresAt, now);
  const left = remainingMs(expiresAt, now);
  return {
    active,
    remainingMs: left,
    remainingLabel: active ? formatRemaining(left) : "Expired",
    expiresAt,
    source: row.source || null,
    packageId: row.package_id || null,
    txSignature: row.tx_signature || null,
  };
}

export async function upsertTelegramBotAccess(sb, row) {
  if (typeof sb !== "function" || !row?.telegram_user_id || !row?.expires_at) {
    return { ok: false, error: "invalid_access_row" };
  }
  const payload = {
    telegram_user_id: String(row.telegram_user_id),
    user_id: row.user_id || null,
    wallet_address: row.wallet_address || null,
    source: row.source,
    code: row.code || null,
    package_id: row.package_id || null,
    tx_signature: row.tx_signature || null,
    expires_at: row.expires_at,
    updated_at: new Date().toISOString(),
  };
  try {
    const existing = await loadTelegramBotAccess(sb, payload.telegram_user_id);
    if (existing) {
      await sb(`telegram_bot_access?telegram_user_id=eq.${encodeURIComponent(payload.telegram_user_id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await sb("telegram_bot_access", {
        method: "POST",
        body: JSON.stringify({ ...payload, created_at: payload.updated_at }),
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "access_write_failed", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function redeemEarlyAccessCode(sb, { telegramUserId, userId, wallet, code } = {}) {
  const normalized = normalizeEarlyAccessCode(code);
  if (!looksLikeEarlyAccessCode(normalized)) {
    return { ok: false, error: "invalid_code", message: "Send /code YOURCODE — letters and numbers, 4–24 characters." };
  }
  const now = Date.now();
  let durationSeconds = envCodeDurationSeconds();
  let fromTable = false;

  try {
    const rows = await sb(
      `telegram_early_access_codes?code=eq.${encodeURIComponent(normalized)}&select=*&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row) {
      fromTable = true;
      if (row.expires_at && Date.parse(row.expires_at) <= now) {
        return { ok: false, error: "code_expired", message: "That early access code has expired." };
      }
      const max = row.max_uses == null ? null : Number(row.max_uses);
      const uses = Number(row.uses || 0);
      if (max != null && Number.isFinite(max) && uses >= max) {
        return { ok: false, error: "code_exhausted", message: "That early access code has no uses left." };
      }
      durationSeconds = Number(row.duration_seconds) || durationSeconds;
      await sb(`telegram_early_access_codes?code=eq.${encodeURIComponent(normalized)}`, {
        method: "PATCH",
        body: JSON.stringify({ uses: uses + 1 }),
      }).catch(() => null);
    }
  } catch {
    /* table may be missing — fall through to env codes */
  }

  if (!fromTable) {
    if (!envCodes().includes(normalized)) {
      return { ok: false, error: "unknown_code", message: "Unknown early access code. Check it and send /code again, or burn $ORBITX." };
    }
  }

  const current = await loadTelegramBotAccess(sb, telegramUserId);
  const currentMs = current?.expires_at && Date.parse(current.expires_at);
  const base = Number.isFinite(currentMs) && currentMs > now ? currentMs : now;
  const expiresAt = new Date(base + durationSeconds * 1000).toISOString();
  const saved = await upsertTelegramBotAccess(sb, {
    telegram_user_id: telegramUserId,
    user_id: userId || null,
    wallet_address: wallet || null,
    source: "code",
    code: normalized,
    package_id: "code",
    expires_at: expiresAt,
  });
  if (!saved.ok && saved.error === "access_write_failed") {
    return {
      ok: false,
      error: "schema_missing",
      message: saved.message || "Apply telegram_bot_access migration, then send the code again.",
    };
  }
  const status = accessStatusFromRow({ expires_at: expiresAt, source: "code", package_id: "code" }, now);
  return {
    ok: true,
    source: "code",
    code: normalized,
    expiresAt,
    ...status,
    message: `Early access unlocked. ${status.remainingLabel}.`,
  };
}

export { parseSolanaTxSignature };
