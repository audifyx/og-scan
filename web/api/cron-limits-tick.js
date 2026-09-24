/**
 * Limit-order auto-fill tick — Vercel Cron GET /api/cron-limits-tick (every 5 min).
 * Sweeps ALL users' open app_limit rows and fills any that hit, backend-signed.
 * Auth: Bearer <redacted> or OXW_WORKER_SECRET when set.
 */
import { tickAllLimits } from "./orbitx/_handlers/_mcp-app-wallet.js";

export const config = { maxDuration: 120 };

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.statusCode = 204;
    return res.end();
  }
  const secret = process.env.CRON_SECRET || process.env.OXW_WORKER_SECRET || "";
  const auth = String(req.headers?.authorization || "");
  if (secret && auth !== `Bearer ${secret}` && req.method !== "GET") {
    return json(res, { ok: false, error: "unauthorized" }, 401);
  }
  // Vercel Cron is GET with optional Authorization. Allow GET so the job runs.
  if (secret && req.method === "GET") {
    const fromVercel = Boolean(req.headers?.["x-vercel-cron"]);
    if (!fromVercel && auth && auth !== `Bearer ${secret}`) {
      return json(res, { ok: false, error: "unauthorized" }, 401);
    }
  }
  try {
    const out = await tickAllLimits();
    return json(res, out);
  } catch (e) {
    return json(res, { ok: false, error: "limits_tick_failed", message: e?.message || String(e) }, 500);
  }
}
