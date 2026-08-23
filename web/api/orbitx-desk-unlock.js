/**
 * POST /api/orbitx-desk-unlock
 * Compare the typed PIN to Vercel OWNER_DESK_CODE (or ADMIN_PASS).
 * Never return the PIN. Fail closed when neither env is set.
 * NOT under /api/orbitx/* — that rewrite hits orbitx-hub.
 */
import {
  adminCredentialOk,
  deskUnlockConfigured,
  isRevokedDeskCode,
  issueDeskSession,
  verifyDeskUnlockCode,
} from "../shared/desk-unlock.js";

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
    return json(res, 200, { ok: true, configured: deskUnlockConfigured() });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  if (!deskUnlockConfigured()) {
    return json(res, 503, { ok: false, error: "not_configured" });
  }

  const code = String(bodyOf(req).code || "").trim();
  if (!code) return json(res, 400, { ok: false, error: "denied" });
  if (isRevokedDeskCode(code)) return json(res, 401, { ok: false, error: "revoked" });
  if (!verifyDeskUnlockCode(code)) return json(res, 401, { ok: false, error: "denied" });

  const token = issueDeskSession();
  if (!token || !adminCredentialOk(token)) {
    return json(res, 503, { ok: false, error: "not_configured" });
  }

  return json(res, 200, { ok: true, token, ttlMs: 12 * 60 * 60 * 1000 });
}
