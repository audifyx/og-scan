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

/** Secret supporter code. Never print this (or the spaced display form) in Telegram copy. */
export const ORBITX_BETA_CODE = "ORBITXBETA";
export const ORBITX_BETA_CODE_DISPLAY = "ORBITX BETA";
export const ORBITX_BETA_MAX_USES = 25;
export const TELEGRAM_CODE_PROMPT_HTML =
  "Type the access code you received from us. Send it as a message, or <code>/code YOURCODE</code>.";
/** ~100 years — telegram_bot_access.expires_at is NOT NULL, so lifetime is a far-future grant. */
export const LIFETIME_SECONDS = Math.round(100 * 365.25 * 24 * 60 * 60);
const LIFETIME_LABEL_MS = 50 * 365.25 * 24 * 60 * 60 * 1000;

export function normalizeEarlyAccessCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

export function isOrbitXBetaCode(raw) {
  return normalizeEarlyAccessCode(raw) === ORBITX_BETA_CODE;
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

export function isLifetimeGrant(row, leftMs = 0) {
  if (String(row?.package_id || "") === "lifetime") return true;
  return Number(leftMs) >= LIFETIME_LABEL_MS;
}

export function remainingAccessLabel(row, leftMs) {
  if (isLifetimeGrant(row, leftMs)) return "lifetime";
  return formatRemaining(leftMs);
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
    remainingLabel: active ? remainingAccessLabel(row, left) : "Expired",
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
      const existingMs = Date.parse(existing.expires_at);
      const nextMs = Date.parse(payload.expires_at);
      if (Number.isFinite(existingMs) && Number.isFinite(nextMs) && existingMs > nextMs) {
        payload.expires_at = existing.expires_at;
        if (existing.package_id === "lifetime") {
          payload.package_id = "lifetime";
          payload.source = existing.source || payload.source;
          payload.code = existing.code || payload.code;
        }
      }
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

function lifetimeUnlockMessage(already) {
  return already
    ? "You already have lifetime MCP access."
    : "Lifetime MCP unlocked. Welcome in — you are one of the first 25 supporters.";
}

function codeExhaustedMessage(normalized) {
  if (normalized === ORBITX_BETA_CODE) {
    return "The first 25 lifetime codes are gone. Burn $ORBITX on /start for timed access.";
  }
  return "That early access code has no uses left.";
}

export async function redeemEarlyAccessCode(sb, { telegramUserId, userId, wallet, code } = {}) {
  const normalized = normalizeEarlyAccessCode(code);
  if (!looksLikeEarlyAccessCode(normalized)) {
    return { ok: false, error: "invalid_code", message: "Send /code YOURCODE — letters and numbers, 4–24 characters." };
  }
  const now = Date.now();
  const current = await loadTelegramBotAccess(sb, telegramUserId);
  const alreadyThisCode = Boolean(
    current?.code === normalized && isAccessActive(current.expires_at, now),
  );
  let durationSeconds = envCodeDurationSeconds();
  let fromTable = false;
  let packageId = "code";

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
      if (!alreadyThisCode && max != null && Number.isFinite(max) && uses >= max) {
        return { ok: false, error: "code_exhausted", message: codeExhaustedMessage(normalized) };
      }
      durationSeconds = Number(row.duration_seconds) || durationSeconds;
      if (!alreadyThisCode) {
        await sb(`telegram_early_access_codes?code=eq.${encodeURIComponent(normalized)}`, {
          method: "PATCH",
          body: JSON.stringify({ uses: uses + 1 }),
        }).catch(() => null);
      }
    }
  } catch {
    /* table may be missing — fall through to env codes */
  }

  if (alreadyThisCode) {
    const lifetime =
      normalized === ORBITX_BETA_CODE ||
      current.package_id === "lifetime" ||
      isLifetimeGrant(current, remainingMs(current.expires_at, now));
    if (lifetime) {
      const status = accessStatusFromRow({ ...current, package_id: "lifetime" }, now);
      return {
        ok: true,
        source: "code",
        code: normalized,
        expiresAt: current.expires_at,
        already: true,
        ...status,
        remainingLabel: "lifetime",
        packageId: "lifetime",
        message: lifetimeUnlockMessage(true),
      };
    }
  }

  if (!fromTable) {
    if (!envCodes().includes(normalized)) {
      return { ok: false, error: "unknown_code", message: "Unknown early access code. Check it and send /code again, or burn $ORBITX." };
    }
  }

  if (normalized === ORBITX_BETA_CODE || durationSeconds >= LIFETIME_SECONDS / 2) {
    durationSeconds = LIFETIME_SECONDS;
    packageId = "lifetime";
  }

  const currentMs = current?.expires_at && Date.parse(current.expires_at);
  const base = packageId === "lifetime" ? now : Number.isFinite(currentMs) && currentMs > now ? currentMs : now;
  const expiresAt = new Date(base + durationSeconds * 1000).toISOString();
  const saved = await upsertTelegramBotAccess(sb, {
    telegram_user_id: telegramUserId,
    user_id: userId || null,
    wallet_address: wallet || null,
    source: "code",
    code: normalized,
    package_id: packageId,
    expires_at: expiresAt,
  });
  if (!saved.ok && saved.error === "access_write_failed") {
    return {
      ok: false,
      error: "schema_missing",
      message: saved.message || "Apply telegram_bot_access migration, then send the code again.",
    };
  }
  const status = accessStatusFromRow(
    { expires_at: expiresAt, source: "code", package_id: packageId },
    now,
  );
  return {
    ok: true,
    source: "code",
    code: normalized,
    expiresAt,
    ...status,
    message:
      packageId === "lifetime"
        ? lifetimeUnlockMessage(false)
        : `Early access unlocked. ${status.remainingLabel}.`,
  };
}

export { parseSolanaTxSignature };

export const BETA_ACCESS_BADGE = "beta access";

/** Wipe link + access + unused login codes so this Telegram user is a fresh DM. */
export async function resetTelegramBotSession(sb, telegramUserId) {
  const id = String(telegramUserId || "").trim();
  if (!id || typeof sb !== "function") return { ok: false, error: "invalid_user" };
  const paths = [
    `telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(id)}`,
    `telegram_bot_access?telegram_user_id=eq.${encodeURIComponent(id)}`,
    `telegram_orbitx_login_codes?telegram_user_id=eq.${encodeURIComponent(id)}`,
  ];
  const errors = [];
  for (const path of paths) {
    try {
      await sb(path, { method: "DELETE" });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { ok: errors.length === 0, errors };
}

export function telegramDmUnlockState(accessRow, link, now = Date.now()) {
  const access = accessStatusFromRow(accessRow, now);
  const linked = Boolean(link?.user_id);
  return {
    accessActive: access.active,
    linked,
    unlocked: Boolean(access.active && linked),
    remainingLabel: access.remainingLabel,
    needsCode: !access.active,
    needsLogin: Boolean(access.active && !linked),
    packageId: access.packageId || null,
  };
}

export function isAllowedGatedDmCommand(bare, text = "") {
  const cmd = String(bare || "")
    .replace(/^\//, "")
    .toLowerCase()
    .replace(/@.*$/, "");
  if (["start", "code", "burn", "verify", "login", "auth", "access", "logout", "reset"].includes(cmd)) return true;
  if (cmd === "shop" && resolveBurnPackageFromText(text)) return true;
  return false;
}

function isBetaAccessBadgeValue(raw) {
  const v = String(raw || "").trim().toLowerCase();
  return v === BETA_ACCESS_BADGE || v === "beta";
}

export async function grantMcpBetaAccessBadge(sb, userId) {
  const id = String(userId || "").trim();
  if (!id || typeof sb !== "function") return { ok: false, error: "invalid_user" };
  try {
    const rows = await sb(
      `profiles?user_id=eq.${encodeURIComponent(id)}&select=user_id,badge,mcp_beta_access&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.user_id) return { ok: false, error: "profile_missing" };
    const patch = { mcp_beta_access: true };
    if (!row.badge || isBetaAccessBadgeValue(row.badge)) {
      patch.badge = BETA_ACCESS_BADGE;
    }
    try {
      await sb(`profiles?user_id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    } catch {
      const fallback = { badge: patch.badge || BETA_ACCESS_BADGE };
      await sb(`profiles?user_id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(fallback),
      });
    }
    return { ok: true, badge: patch.badge || row.badge || BETA_ACCESS_BADGE };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "badge_failed" };
  }
}
