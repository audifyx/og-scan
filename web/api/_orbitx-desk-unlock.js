/**
 * POST /api/orbitx-desk-unlock
 * Owner JWT + ADMIN_AUTH on Vercel project rork-og-meme-coin-tracker
 * (legacy aliases: OWNER_DESK_CODE / ADMIN_PASS).
 * Never return the PIN. purpose=maintenance checks the same secret without issuing a desk token.
 * Fail closed when env or owner session is missing.
 * NOT under /api/orbitx/* — that rewrite hits orbitx-hub.
 */
import {
  adminCredentialOk,
  clearDeskUnlockFailures,
  deskUnlockConfigured,
  deskUnlockLimited,
  isRevokedDeskCode,
  issueDeskSession,
  maintenanceCodeOk,
  maintenanceConfigured,
  recordDeskUnlockFailure,
  verifyDeskUnlockCode,
} from "../shared/desk-unlock.js";
import { requireOwnerEmailUser } from "../shared/owner-identity.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const fwd = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}

function bodyOf(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === "object" ? req.body : {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});

  if (req.method === "GET") {
    return json(res, 404, { ok: false, error: "not_found" });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const body = bodyOf(req);
  const purpose = String(body.purpose || "desk").trim();
  const code = String(body.code || "").trim();

  // Brute-force limit (audit B11): 10 failed code attempts per
  // IP+purpose per 15 min. This branch had no limiting at all.
  const limitKey = `${purpose}:${clientIp(req)}`;
  if (deskUnlockLimited(limitKey)) {
    return json(res, 429, { ok: false, error: "rate_limited" });
  }

  if (purpose === "maintenance") {
    if (!maintenanceConfigured()) return json(res, 503, { ok: false, error: "not_configured" });
    if (!code) return json(res, 400, { ok: false, error: "denied" });
    if (isRevokedDeskCode(code)) {
      recordDeskUnlockFailure(limitKey);
      return json(res, 401, { ok: false, error: "revoked" });
    }
    // Dedicated MAINTENANCE_CODE when set; the desk PIN is only the
    // legacy fallback until the owner sets one (see desk-unlock.js).
    if (!maintenanceCodeOk(code)) {
      recordDeskUnlockFailure(limitKey);
      return json(res, 401, { ok: false, error: "denied" });
    }
    clearDeskUnlockFailures(limitKey);
    return json(res, 200, { ok: true, purpose: "maintenance" });
  }

  const owner = await requireOwnerEmailUser(req);
  if (!owner) return json(res, 403, { ok: false, error: "denied" });

  if (!deskUnlockConfigured()) {
    return json(res, 503, { ok: false, error: "not_configured" });
  }

  if (!code) return json(res, 400, { ok: false, error: "denied" });
  if (isRevokedDeskCode(code)) {
    recordDeskUnlockFailure(limitKey);
    return json(res, 401, { ok: false, error: "revoked" });
  }
  if (!verifyDeskUnlockCode(code)) {
    recordDeskUnlockFailure(limitKey);
    return json(res, 401, { ok: false, error: "denied" });
  }
  clearDeskUnlockFailures(limitKey);

  const token = issueDeskSession();
  if (!token || !adminCredentialOk(token)) {
    return json(res, 503, { ok: false, error: "not_configured" });
  }

  return json(res, 200, { ok: true, token, ttlMs: 12 * 60 * 60 * 1000 });
}
