/**
 * Private live analytics — lazy module under web.js (Vercel edition).
 * Routed via vercel.json: /stats-api/:action -> /api/web?path=stats/:action.
 * No Google Analytics, no third-party service. Storage is the
 * project's own Supabase Postgres (site_stats_views / site_stats_live),
 * written via the PostgREST REST API with the service-role key — the same
 * client pattern as _admin-tokens.ts. Visitor IDs are anonymous: a
 * first-party cookie + localStorage UUID, or a one-way hash of the account
 * ID for signed-in users (raw IDs never leave the device).
 *
 * Actions (mirrors the Cloudflare Worker spec exactly):
 *   POST /hit  — insert a view row + upsert the live row for this vid
 *   POST /ping — upsert the live row only
 *   GET  /data — the stats JSON (same shape as the worker, plus the
 *                advanced fields from site_stats_data): asOf, liveNow
 *                (45s window), livePages, liveVisitors (per-vid trails
 *                with timestamps), sessionsToday, avgSessionSeconds,
 *                avgPagesPerSession, topEntryPages, topExitPages,
 *                hourly24, totalViews, uniqueVisitors, viewsToday,
 *                visitorsToday, views24h, daily (14 days), topPages,
 *                countries, devices, referrers, recent (with short vid).
 * "Today" uses TZ=-5 (Eastern). Live rows older than 1h are deleted on read
 * (inside the site_stats_data function). Every query is scoped by `site`
 * (sanitized like the worker: lowercase, [^a-z0-9-] stripped, max 40).
 */

// MUST be .js, NOT .ts — Vercel does not bundle .ts files dynamically
// imported from the .js web.js LAZY map, so a .ts module 500s in prod
// ("Cannot find module '/var/task/web/api/_stats.ts'").
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ibojtmeqgzabgeiwbvhf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function sanitizeSite(s) {
  return String(s || "default").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "default";
}

function json(res, obj, status = 200) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  return res.status(status).send(JSON.stringify(obj));
}

async function sb(path, body, prefer) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const out = await r.text();
  if (!r.ok) {
    const e = new Error(`supabase ${path} failed (${r.status}): ${out.slice(0, 200)}`);
    e.status = r.status;
    throw e;
  }
  try { return JSON.parse(out); } catch { return out; }
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") return res.status(200).end();

  const parts = String(req.query.path || "").split("/").filter(Boolean);
  const action = (parts[1] || "").toLowerCase();
  const site = sanitizeSite(req.query.site);

  if (!SERVICE_KEY) return json(res, { ok: false, error: "Server not configured (missing service role key)" }, 500);

  try {
    if (req.method === "POST" && (action === "hit" || action === "ping")) {
      const body = (() => {
        try { return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch { return {}; }
      })();
      const vid = String(body.vid || "").slice(0, 40);
      if (!vid) return json(res, { ok: false }, 400);
      const path = String(body.path || "/").slice(0, 120);
      const country = String(req.headers["x-vercel-ip-country"] || "??").slice(0, 10);
      const region = String(req.headers["x-vercel-ip-country-region"] || "").slice(0, 40);
      let city = "";
      try { city = decodeURIComponent(String(req.headers["x-vercel-ip-city"] || "")); } catch { city = String(req.headers["x-vercel-ip-city"] || ""); }
      city = city.slice(0, 60);
      const clean = (v, n) => String(v || "").replace(/[^A-Za-z0-9 _.\-+/]/g, "").slice(0, n);
      const os = clean(body.os, 20) || "unknown";
      const browser = clean(body.browser, 20) || "unknown";
      const device = ["phone", "tablet", "desktop", "mobile"].includes(body.device) ? body.device : "desktop";
      const screen = clean(body.screen, 12);
      const tz = clean(body.tz, 40);
      const utm_source = clean(body.utm_source, 40);
      const now = Date.now();
      if (action === "hit") {
        let ref = "";
        try { ref = body.ref ? new URL(body.ref).hostname : ""; } catch {}
        await sb("site_stats_views", { ts: now, site, vid, path, ref: ref.slice(0, 80), country, device, os, browser, city, region, tz, utm_source, screen }, "return=minimal");
      }
      await sb("site_stats_live", { site, vid, ts: now, path, country, os, browser, city, region }, "return=minimal,resolution=merge-duplicates");
      return json(res, { ok: true });
    }

    if (req.method === "GET" && action === "data") {
      const data = await sb("rpc/site_stats_data", { p_site: site });
      return json(res, data);
    }

    return json(res, { ok: false, error: `unknown stats action: ${action}` }, 404);
  } catch (e) {
    return json(res, { ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
  }
}
