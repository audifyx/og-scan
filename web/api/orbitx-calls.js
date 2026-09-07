/**
 * Admin Calls desk HTTP.
 * GET  /api/orbitx-calls              admin snapshot
 * GET  /api/orbitx-calls?path=tick    Vercel cron / CRON_SECRET
 * POST /api/orbitx-calls              connect | channel | settings | tick | disconnect
 * POST /api/orbitx-calls?path=hook    Telegram membership webhook (alert-only)
 */
import { adminCredentialOk } from "../shared/desk-unlock.js";
import {
  connectCallsBot,
  disconnectCallsBot,
  ingestCallsHook,
  linkCallsChannel,
  unlinkCallsChannel,
  saveCallsSettings,
  snapshotCallsDesk,
  tickCallsDesk,
  applyCallsSql,
} from "./orbitx/calls-engine.js";

export const config = { maxDuration: 90 };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token",
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

function pathOf(req) {
  const q = req.query?.path;
  if (q) return String(q).replace(/^\/+/, "");
  const url = String(req.url || "");
  const after = url.split("/api/orbitx-calls")[1] || "";
  return after.split("?")[0].replace(/^\/+/, "");
}

function cronAuthorized(req) {
  if (req.headers?.["x-vercel-cron"]) return true;
  if (req.headers?.["user-agent"]?.includes("vercel-cron")) return true;
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  return String(req.headers?.authorization || "") === `Bearer ${secret}`;
}

function adminFrom(req) {
  const body = bodyOf(req);
  const h = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  return adminCredentialOk(h) || adminCredentialOk(body.admin) || adminCredentialOk(req.query?.admin);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.end();
  }
  const path = pathOf(req);
  try {
    if (req.method === "POST" && path === "hook") {
      const secret = String(req.headers["x-telegram-bot-api-secret-token"] || "");
      const out = await ingestCallsHook({ body: bodyOf(req), secret });
      return json(res, 200, out);
    }
    if (req.method === "GET" && (path === "tick" || req.query?.tick === "1")) {
      if (!cronAuthorized(req) && !adminFrom(req)) {
        return json(res, 401, { ok: false, error: "cron_or_admin_required" });
      }
      const out = await tickCallsDesk({ force: adminFrom(req) });
      return json(res, 200, { ok: true, ...out });
    }
    if (req.method === "GET") {
      if (!adminFrom(req)) return json(res, 401, { ok: false, error: "admin_required" });
      const snap = await snapshotCallsDesk();
      return json(res, 200, snap);
    }
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "GET or POST" });
    if (!adminFrom(req)) return json(res, 401, { ok: false, error: "admin_required" });
    const body = bodyOf(req);
    const action = String(body.action || path || "").toLowerCase();
    if (action === "connect") {
      const out = await connectCallsBot({ token: body.botToken || body.token });
      return json(res, out.ok ? 200 : 400, out);
    }
    if (action === "disconnect") {
      const out = await disconnectCallsBot();
      return json(res, out.ok ? 200 : 400, out);
    }
    if (action === "channel" || action === "link_channel") {
      const out = await linkCallsChannel({ raw: body.channel || body.chat || body.raw });
      return json(res, out.ok ? 200 : 400, out);
    }
    if (action === "unlink_channel") {
      const out = await unlinkCallsChannel();
      return json(res, out.ok ? 200 : 400, out);
    }
    if (action === "settings") {
      const out = await saveCallsSettings({
        patch: {
          armed: body.armed,
          broadcast_groups: body.broadcast_groups,
          max_calls_per_tick: body.max_calls_per_tick,
          cooldown_hours: body.cooldown_hours,
          win_multiple: body.win_multiple,
        },
      });
      return json(res, out.ok ? 200 : 400, out);
    }
    if (action === "apply_schema") {
      const out = await applyCallsSql();
      const snap = await snapshotCallsDesk();
      return json(res, 200, { ...snap, applied: out });
    }
    if (action === "tick") {
      const out = await tickCallsDesk({ force: true });
      return json(res, 200, { ok: true, ...out });
    }
    return json(res, 400, { ok: false, error: "unknown_action" });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || String(e) });
  }
}
