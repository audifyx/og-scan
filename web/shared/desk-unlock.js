/**
 * Owner desk PIN — server only.
 * Set Vercel env OWNER_DESK_CODE (preferred) and/or ADMIN_PASS.
 * Never ship a default PIN. The old client value 0129 is revoked forever.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DESK_SESSION_PREFIX = "oxdesk1";
export const DESK_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const REVOKED_DESK_CODES = Object.freeze(["0129"]);

function trim(v) {
  return String(v || "").trim();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isRevokedDeskCode(code) {
  const c = trim(code);
  return REVOKED_DESK_CODES.some((revoked) => safeEqual(c, revoked));
}

/** Secrets that may unlock the desk. Empty unless Vercel env is set. */
export function deskUnlockSecrets(env = process.env) {
  const out = [];
  for (const key of ["OWNER_DESK_CODE", "ADMIN_PASS"]) {
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
