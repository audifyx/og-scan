/**
 * Live agent desk HTTP.
 * GET  /api/live-agents           public snapshot (no secret)
 * GET  /api/live-agents?path=tick Vercel cron / CRON_SECRET
 * POST /api/live-agents           admin arm | pause | tick
 */
import { adminCredentialOk } from "../shared/desk-unlock.js";
import { LIVE_WALLET_PUBKEY } from "../shared/orbitx-live-desk.js";
import { runTakeProfitOrders, setLiveArmed, setLiveHunt, snapshotLiveDesk, tickLiveDesk } from "./orbitx/live-agent-engine.js";
import { pushLiveDeskToTelegram } from "./orbitx/calls-engine.js";

export const config = { maxDuration: 90 };

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

function pathOf(req) {
  const q = req.query?.path;
  if (q) return String(q).replace(/^\/+/, "");
  const url = String(req.url || "");
  const after = url.split("/api/live-agents")[1] || "";
  return after.split("?")[0].replace(/^\/+/, "");
}

function cronAuthorized(req) {
  if (req.headers?.["x-vercel-cron"]) return true;
  if (req.headers?.["user-agent"]?.includes("vercel-cron")) return true;
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  return String(req.headers?.authorization || "") === `Bearer ${secret}`;
}

async function withTelegram(out) {
  try {
    const telegram = await pushLiveDeskToTelegram({ live: out, ensureArmed: true });
    return { ...out, telegram };
  } catch (e) {
    return { ...out, telegram: { ok: false, error: e.message || String(e) } };
  }
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
    if (req.method === "GET" && (path === "tick" || req.query?.tick === "1")) {
      if (!cronAuthorized(req) && !adminFrom(req)) {
        return json(res, 401, { ok: false, error: "cron_or_admin_required" });
      }
      const tp = await runTakeProfitOrders().catch((e) => ({ error: String(e?.message || e) }));
      const out = await tickLiveDesk({ force: adminFrom(req) });
      return json(res, 200, { ok: true, ...await withTelegram(out), takeProfit: tp, wallet: out.wallet || LIVE_WALLET_PUBKEY });
    }
    if (req.method === "GET") {
      const snap = await snapshotLiveDesk();
      return json(res, 200, snap);
    }
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "GET or POST" });
    if (!adminFrom(req)) return json(res, 401, { ok: false, error: "admin_required" });
    const body = bodyOf(req);
    const action = String(body.action || path || "tick").toLowerCase();
    if (action === "arm") {
      const snap = await setLiveArmed({ armed: true, paused: false });
      return json(res, 200, { ok: true, ...snap });
    }
    if (action === "pause" || action === "disarm") {
      const snap = await setLiveArmed({ armed: action !== "pause" ? false : undefined, paused: action === "pause" });
      return json(res, 200, { ok: true, ...snap });
    }
    if (action === "hunt" || action === "ape") {
      const out = await setLiveHunt(
        {
          mint: body.mint || body.ca,
          symbol: body.symbol,
          clipUsd: body.clipUsd ?? body.usd ?? 1,
          scaleMcap: body.scaleMcap ?? body.scale_mcap ?? 300_000,
          flattenMcap: body.flattenMcap ?? body.flatten_mcap ?? 600_000,
        },
        { tick: body.tick !== false, dryRun: body.dryRun === true },
      );
      const status = out.ok === false ? 400 : 200;
      return json(res, status, out.ok === false ? out : await withTelegram(out));
    }
    const out = await tickLiveDesk({ force: true, dryRun: body.dryRun === true });
    return json(res, 200, { ok: true, ...await withTelegram(out) });
  } catch (e) {
    return json(res, 500, { ok: false, error: e instanceof Error ? e.message : "live_desk_failed" });
  }
}
