/**
 * POST /api/orbitx-owner — owner command-center reads (service role).
 *
 * Authorization: Supabase JWT → Auth user email/wallet must match the
 * token-gate owner allowlist. Normal users always get 403. Desk code is
 * never accepted here.
 *
 * Actions: overview | search | user | presence | events | ledger | burns |
 * health | audit | daily
 */
import {
  TOKEN_GATE_EXEMPT_EMAILS_BASE,
  TOKEN_GATE_EXEMPT_WALLETS_BASE,
  isExemptEmailInList,
} from "../shared/token-gate-exempt.js";
import {
  buildHealth,
  buildOverview,
  getOwnerUserHub,
  searchOwnerUsers,
  writeOwnerAudit,
} from "./orbitx/owner-command.js";

export const config = { maxDuration: 30 };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

function ownerWallets() {
  const extras = String(process.env.OWNER_WALLETS || process.env.VITE_OWNER_WALLETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...TOKEN_GATE_EXEMPT_WALLETS_BASE, ...extras];
}

function isOwnerEmail(email) {
  return isExemptEmailInList(email, TOKEN_GATE_EXEMPT_EMAILS_BASE, ownerWallets());
}

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  return res.status(status).json(body);
}

async function emailFromToken(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function sb(path, init = {}) {
  if (!SERVICE_KEY) throw new Error("missing_service_role");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text.slice(0, 280) || `supabase ${r.status}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || String(req.headers["x-real-ip"] || "") || null;
}

function qstr(v) {
  return encodeURIComponent(String(v || "").trim());
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }
  try {
    if (!SERVICE_KEY) return json(res, 500, { error: "Server not configured (missing service role key)" });

    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json(res, 401, { error: "Missing auth token" });

    const user = await emailFromToken(token);
    const email = user?.email || null;
    if (!isOwnerEmail(email)) return json(res, 403, { error: "Not authorized" });

    const body = req.method === "GET" ? req.query || {} : typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = String(body.action || req.query?.action || "overview");
    const limit = Math.min(Math.max(Number(body.limit || req.query?.limit) || 50, 1), 200);
    const adminId = user?.id || null;

    if (action === "overview") {
      const data = await buildOverview(sb);
      return json(res, 200, { ok: true, action, data });
    }

    if (action === "health") {
      const data = await buildHealth(sb);
      return json(res, 200, { ok: true, action, data });
    }

    if (action === "search") {
      const q = String(body.q || req.query?.q || "");
      const rows = await searchOwnerUsers(sb, q, limit);
      if (q) {
        await writeOwnerAudit(sb, {
          admin_user_id: adminId,
          admin_email: email,
          action: "user_lookup",
          target_type: "search",
          target_id: q.slice(0, 80),
          ip: clientIp(req),
        });
      }
      return json(res, 200, { ok: true, action, rows });
    }

    if (action === "user") {
      const userId = String(body.userId || body.user_id || req.query?.userId || "");
      const data = await getOwnerUserHub(sb, userId);
      if (!data) return json(res, 404, { error: "User not found" });
      await writeOwnerAudit(sb, {
        admin_user_id: adminId,
        admin_email: email,
        action: "user_profile",
        target_type: "user",
        target_id: userId,
        ip: clientIp(req),
      });
      return json(res, 200, { ok: true, action, data });
    }

    if (action === "presence") {
      const rows = await searchOwnerUsers(sb, "", 80);
      return json(res, 200, { ok: true, action, rows });
    }

    if (action === "events") {
      const type = String(body.eventType || body.event_type || req.query?.eventType || "").trim();
      const typeQ = type ? `&event_type=eq.${qstr(type)}` : "";
      const rows = await sb(
        `ox_admin_events?select=id,event_type,user_id,wallet_address,application,title,metadata,tx_signature,created_at&order=created_at.desc&limit=${limit}${typeQ}`,
      ).catch(() => []);
      return json(res, 200, { ok: true, action, rows: Array.isArray(rows) ? rows : [] });
    }

    if (action === "ledger" || action === "jupiter") {
      const status = String(body.status || req.query?.status || "").trim();
      const app = String(body.application || req.query?.application || "").trim();
      const sig = String(body.signature || req.query?.signature || "").trim();
      const uid = String(body.userId || body.user_id || req.query?.userId || "").trim();
      const parts = [`select=*`, `order=created_at.desc`, `limit=${limit}`];
      if (status) parts.push(`status=eq.${qstr(status)}`);
      if (app) parts.push(`application=eq.${qstr(app)}`);
      if (sig) parts.push(`tx_signature=eq.${qstr(sig)}`);
      if (uid) parts.push(`user_id=eq.${qstr(uid)}`);
      if (action === "jupiter") parts.push(`tx_type=in.(swap,jupiter,buy,sell)`);
      const rows = await sb(`ox_admin_ledger?${parts.join("&")}`).catch(() => []);
      return json(res, 200, { ok: true, action, rows: Array.isArray(rows) ? rows : [] });
    }

    if (action === "burns") {
      const rows = await sb(
        `ox_admin_burns?select=*&order=created_at.desc&limit=${limit}`,
      ).catch(() => []);
      const mcp = await sb(
        `mcp_burn_ledger?select=id,user_id,wallet_address,tokens_burned,tx_signature,created_at,package_id&order=created_at.desc&limit=${limit}`,
      ).catch(() => []);
      return json(res, 200, {
        ok: true,
        action,
        rows: Array.isArray(rows) ? rows : [],
        mcp: Array.isArray(mcp) ? mcp : [],
      });
    }

    if (action === "audit") {
      const rows = await sb(
        `ox_admin_audit?select=*&order=created_at.desc&limit=${limit}`,
      ).catch(() => []);
      return json(res, 200, { ok: true, action, rows: Array.isArray(rows) ? rows : [] });
    }

    if (action === "daily") {
      const rows = await sb(`ox_admin_daily?select=*&order=day.desc&limit=${limit}`).catch(() => []);
      return json(res, 200, { ok: true, action, rows: Array.isArray(rows) ? rows : [] });
    }

    return json(res, 400, { error: "Unknown action" });
  } catch (e) {
    return json(res, 500, { error: e?.message || "Internal error" });
  }
}
