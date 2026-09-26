/**
 * GET /api/orbitx/copy-admin?action=status|provision — Helius webhook admin.
 *
 * Authed via ADMIN_AUTH exactly like web/api/ogdex.js (deskSecrets/safeEq
 * pattern): header x-ogdex-key (or x-admin-auth, or an Authorization bearer
 * token) must timing-safe match one of OXW_WORKER_SECRET | ADMIN_AUTH |
 * OWNER_DESK_CODE | ADMIN_PASS.
 *
 * Uses the SERVER-SIDE Helius key. It is NEVER exposed in any response, and
 * the webhook secret is masked — only booleans / "***set***" markers leave
 * this endpoint.
 *
 * The provision/status implementation is shared verbatim with the
 * orbitx_app_copy_provision MCP tool (_mcp-copy-engine.js).
 */
import { timingSafeEqual } from "crypto";
import { copyWebhookStatus, copyWebhookProvision } from "./_handlers/_mcp-copy-engine.js";

function deskSecrets() {
  const out = [];
  for (const key of ["OXW_WORKER_SECRET", "ADMIN_AUTH", "OWNER_DESK_CODE", "ADMIN_PASS"]) {
    const s = String(process.env[key] || "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function safeEq(a, b) {
  const L = Buffer.from(String(a));
  const R = Buffer.from(String(b));
  if (L.length === 0 || L.length !== R.length) return false;
  return timingSafeEqual(L, R);
}

function providedKey(req) {
  const h = req.headers || {};
  const direct = String(h["x-ogdex-key"] || h["x-admin-auth"] || "").trim();
  if (direct) return direct;
  const m = String(h.authorization || h.Authorization || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method" }));
  }

  const secrets = deskSecrets();
  if (!secrets.length) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
  }
  const key = providedKey(req);
  if (!key || !secrets.some((s) => safeEq(key, s))) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "denied" }));
  }

  let u;
  try {
    u = new URL(req.url, "http://x");
  } catch {
    u = new URL("http://x");
  }
  const action = String(u.searchParams.get("action") || "status").trim().toLowerCase();

  try {
    const out = action === "provision" ? await copyWebhookProvision() : await copyWebhookStatus();
    if (out.ok) {
      res.statusCode = 200;
    } else if (out.error === "secret_missing" || out.error === "no_active_follows" || out.error === "helius_key_missing") {
      res.statusCode = 400;
    } else {
      res.statusCode = 502;
    }
    return res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "admin_threw", message: String(e?.message || e) }));
  }
}

export const config = { maxDuration: 30 };
