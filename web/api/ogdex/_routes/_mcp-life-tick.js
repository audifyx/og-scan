/**
 * Hourly Life Agent tick — Vercel Cron GET /api/mcp-life-tick
 * Auth: Bearer CRON_SECRET or OXW_WORKER_SECRET when set.
 *
 * Lives in the ogdex catch-all (NOT a standalone api/ file): Vercel Hobby
 * allows max 12 serverless functions per deployment, and a standalone
 * mcp-life-tick.js was the 13th — it blocked EVERY deploy. Routed via
 * vercel.json rewrite /api/mcp-life-tick -> /api/ogdex?path=mcp-life-tick.
 * ogdex.js maxDuration is 90s so the tick keeps its original time budget.
 */
import { tickDueLifeAgents } from "../../orbitx/_handlers/_mcp-life-agents.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      Prefer: init.prefer || "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || text || r.statusText);
    err.status = r.status;
    throw err;
  }
  return data;
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
  // Vercel Cron is GET with optional Authorization. Allow GET so the hourly job runs.
  if (secret && req.method === "GET") {
    const fromVercel = Boolean(req.headers?.["x-vercel-cron"]);
    if (!fromVercel && auth && auth !== `Bearer ${secret}`) {
      return json(res, { ok: false, error: "unauthorized" }, 401);
    }
  }
  try {
    const out = await tickDueLifeAgents(sb, { limit: 8 });
    return json(res, out);
  } catch (e) {
    return json(res, { ok: false, error: "tick_failed", message: e?.message || String(e) }, 500);
  }
}
