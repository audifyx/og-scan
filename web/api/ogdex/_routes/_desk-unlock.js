/**
 * Desk PIN check hosted on the live ogdex function (hub/web are crashing).
 * Accepts ADMIN_AUTH / OWNER_DESK_CODE / ADMIN_PASS / OXW_WORKER_SECRET.
 */
import {
  deskUnlockConfigured,
  isRevokedDeskCode,
  issueDeskSession,
  verifyDeskUnlockCode,
} from "../../shared/desk-unlock.js";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.end();
  }
  if (req.method === "GET") {
    return send(res, 200, { ok: true, configured: deskUnlockConfigured() });
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== "object") body = {};
  const code = String(body.code || "").trim();
  const purpose = String(body.purpose || "desk");

  if (!deskUnlockConfigured()) return send(res, 503, { ok: false, error: "not_configured" });
  if (isRevokedDeskCode(code)) return send(res, 401, { ok: false, error: "revoked" });
  if (!verifyDeskUnlockCode(code)) return send(res, 401, { ok: false, error: "denied" });

  if (purpose === "maintenance") return send(res, 200, { ok: true, purpose: "maintenance" });
  const token = issueDeskSession();
  if (!token) return send(res, 503, { ok: false, error: "unavailable" });
  return send(res, 200, { ok: true, token });
}
