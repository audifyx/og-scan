/**
 * Owner desk PIN — server only.
 * Set Vercel env ADMIN_AUTH. OWNER_DESK_CODE / ADMIN_PASS are legacy aliases.
 * Never ship a default PIN. Retired codes are stored as SHA-256 digests only.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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
  for (const key of ["ADMIN_AUTH", "OWNER_DESK_CODE", "ADMIN_PASS"]) {
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
