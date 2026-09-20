/**
 * GET  /api/hunter-agent           public snapshot
 * GET  /api/hunter-agent?tick=1    run one loop (cron header, CRON_SECRET, or open dashboard)
 * POST /api/hunter-agent           { action: tick|arm|pause }
 *
 * 24/7 without Vercel Pro: point a free cron (cron-job.org) at
 *   https://www.orbitx.world/api/hunter-agent?tick=1
 * every 5 minutes. Dashboard also ticks while open.
 */
import { snapshotHunter, tickHunter, setHunterArmed, setHunterPaused } from "./orbitx/_handlers/_mcp-hunter-agent.js";

export const config = { maxDuration: 30 };

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function cronOk(req) {
  if (req.headers?.["x-vercel-cron"]) return true;
  if (String(req.headers?.["user-agent"] || "").includes("vercel-cron")) return true;
  const secret = process.env.CRON_SECRET || process.env.OXW_WORKER_SECRET || process.env.HUNTER_TICK_KEY || "";
  if (!secret) return true; // hobby: allow public tick so free pingers work
  const auth = String(req.headers?.authorization || "");
  const q = String(req.query?.k || req.query?.key || "");
  return auth === `Bearer ${secret}` || q === secret;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === "GET" && (req.query?.tick === "1" || req.query?.path === "tick")) {
      if (!cronOk(req)) return json(res, 401, { ok: false, error: "tick_auth" });
      const out = await tickHunter({ force: true });
      return json(res, 200, out);
    }
    if (req.method === "GET") {
      return json(res, 200, await snapshotHunter());
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const action = String(body.action || "").toLowerCase();
      if (action === "tick") return json(res, 200, await tickHunter({ force: true }));
      if (action === "arm") return json(res, 200, await setHunterArmed(true));
      if (action === "disarm") return json(res, 200, await setHunterArmed(false));
      if (action === "pause") return json(res, 200, await setHunterPaused(true));
      if (action === "resume") return json(res, 200, await setHunterPaused(false));
      return json(res, 400, { ok: false, error: "unknown_action" });
    }
    return json(res, 405, { ok: false, error: "method" });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "hunter_failed" });
  }
}
