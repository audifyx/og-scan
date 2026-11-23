/**
 * Owner desk PIN — server only.
 * Set ADMIN_AUTH on Vercel, or the alias you actually created: OXW_WORKER_SECRET.
 * OWNER_DESK_CODE / ADMIN_PASS are legacy aliases. Never ship a default PIN.
 * Retired codes are stored as SHA-256 digests only.
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const DESK_SESSION_PREFIX = "oxdesk1";
export const DESK_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** SHA-256 hex of retired client PINs. Plaintext is not kept in this repo. */
export const REVOKED_DESK_CODE_DIGESTS = Object.freeze([
  "2d907c75aab224850b6b76d15e2fd471248edf715de8f79dc84c2d411f663f88",
]);

function trim(v) {
  return String(v || "").trim();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function digestDeskCode(code) {
  return createHash("sha256").update(trim(code), "utf8").digest("hex");
}

export function isRevokedDeskCode(code) {
  const digest = digestDeskCode(code);
  if (!digest) return false;
  return REVOKED_DESK_CODE_DIGESTS.some((revoked) => safeEqual(digest, revoked));
}

/** Secrets that may unlock the desk. Empty unless Vercel env is set. */
export function deskUnlockSecrets(env = process.env) {
  const out = [];
  for (const key of ["ADMIN_AUTH", "OWNER_DESK_CODE", "ADMIN_PASS", "OXW_WORKER_SECRET"]) {
    const s = trim(env[key]);
    if (!s || isRevokedDeskCode(s)) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export function deskUnlockConfigured(env = process.env) {
  return deskUnlockSecrets(env).length > 0;
}

export function verifyDeskUnlockCode(code, env = process.env) {
  const c = trim(code);
  if (!c || isRevokedDeskCode(c)) return false;
  return deskUnlockSecrets(env).some((secret) => safeEqual(c, secret));
}

export function issueDeskSession(now = Date.now(), env = process.env) {
  const key = deskUnlockSecrets(env)[0];
  if (!key) return null;
  const exp = now + DESK_SESSION_TTL_MS;
  const mac = createHmac("sha256", key).update(String(exp)).digest("hex");
  return `${DESK_SESSION_PREFIX}.${exp}.${mac}`;
}

export function verifyDeskSession(token, now = Date.now(), env = process.env) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== DESK_SESSION_PREFIX) return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || now > exp) return false;
  const expectedPayload = String(exp);
  return deskUnlockSecrets(env).some((key) => {
    const mac = createHmac("sha256", key).update(expectedPayload).digest("hex");
    return safeEqual(mac, parts[2]);
  });
}

/** True if `provided` is the env PIN or a live session token. */
export function adminCredentialOk(provided, env = process.env) {
  const p = trim(provided);
  if (!p || isRevokedDeskCode(p)) return false;
  if (verifyDeskUnlockCode(p, env)) return true;
  if (verifyDeskSession(p, Date.now(), env)) return true;
  return false;
}

/**
 * Maintenance unlock (audit B11): the maintenance branch historically
 * accepted the DESK PIN itself with no session at all, so the one
 * shared secret was both the owner's desk credential and a public-
 * facing unlock code. When MAINTENANCE_CODE is set in the server env,
 * maintenance accepts ONLY that dedicated code. When it is unset the
 * legacy desk-secret behaviour is kept so the live MaintenanceLock
 * flow doesn't break before the owner sets one — set MAINTENANCE_CODE
 * to a long random value to close this properly.
 */
export function maintenanceConfigured(env = process.env) {
  return deskUnlockConfigured(env) || Boolean(trim(env.MAINTENANCE_CODE));
}

export function maintenanceCodeOk(code, env = process.env) {
  const c = trim(code);
  if (!c || isRevokedDeskCode(c)) return false;
  const dedicated = trim(env.MAINTENANCE_CODE);
  if (dedicated) return safeEqual(c, dedicated);
  return verifyDeskUnlockCode(c, env);
}

/* ── Brute-force limiter (audit B11) ─────────────────────────────────
 * The unlock endpoint had NO attempt limiting: the shared code could
 * be guessed online forever. In-memory failure counting per key
 * (ip+purpose), 10 failures per 15 minutes, cleared on success.
 * In-memory is per-instance (same model as _authLimit) — it removes
 * unlimited online guessing, which is the audited hole. */
export const DESK_UNLOCK_MAX_FAILURES = 10;
export const DESK_UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const deskUnlockFailures = new Map();

export function deskUnlockLimited(key, now = Date.now()) {
  const arr = (deskUnlockFailures.get(key) || []).filter((t) => now - t < DESK_UNLOCK_WINDOW_MS);
  if (arr.length) deskUnlockFailures.set(key, arr);
  else deskUnlockFailures.delete(key);
  return arr.length >= DESK_UNLOCK_MAX_FAILURES;
}

export function recordDeskUnlockFailure(key, now = Date.now()) {
  const arr = (deskUnlockFailures.get(key) || []).filter((t) => now - t < DESK_UNLOCK_WINDOW_MS);
  arr.push(now);
  deskUnlockFailures.set(key, arr);
  if (deskUnlockFailures.size > 5000) deskUnlockFailures.clear();
}

export function clearDeskUnlockFailures(key) {
  deskUnlockFailures.delete(key);
}
