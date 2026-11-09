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
 *                v3 adds likely_bot (ingest-time, strong signals only —
 *                see computeLikelyBot) on view + live rows, likelyBot on
 *                liveVisitors/recent, and bot-excluded *Human variants of
 *                the headline counts for the dashboard toggle.
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

// Likely-bot flag (v3) — strong signals only, never a block, badge only.
// A Linux/Chrome 1920x1080 desktop alone NEVER flags: that is also a huge
// population of real users. The flag is a boolean, stored per view row and
// on the live row; no IPs, no UA strings, no fingerprints are ever stored.
//   1. auto — client-sent navigator.webdriver boolean (headless / WebDriver
//      driven browsers: Playwright, Selenium, the recording rig).
//   2. Datacenter signature — known datacenter-exit city AND unrecognised
//      OS AND Chrome AND desktop AND 1280x720 (the Council Bluffs polling
//      pattern). A city alone never flags.
//   3. Behaviour — 6+ same-page hits from one visitor in 10 minutes
//      (recording rig re-running takes: 10x /orbitx-social in ~7 min).
export const BOT_DATACENTER_CITIES = ["council bluffs", "ashburn"];
export const BOT_BEHAVIOR_WINDOW_MS = 600000; // 10 min
export const BOT_BEHAVIOR_MIN_REPEATS = 5; // prior same-path hits in window

export function computeLikelyBot(input) {
  const i = input || {};
  if (i.auto === true) return true;
  const city = String(i.city || "").trim().toLowerCase();
  return (
    BOT_DATACENTER_CITIES.includes(city) &&
    String(i.os || "") === "Other" &&
    String(i.browser || "") === "Chrome" &&
    String(i.device || "") === "desktop" &&
    String(i.screen || "") === "1280x720"
  );
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase GET ${path} failed (${r.status})`);
  return r.json();
}

// Behaviour check for a hit: how many times has this visitor loaded this
// exact path in the last 10 minutes (excluding the hit being recorded)?
// Throws on lookup failure — callers treat that as "not flagged", never
// fail a hit because the lookup failed.
export async function countRecentSamePathViews({ site, vid, path, since }) {
  const q =
    `site_stats_views?select=ts` +
    `&site=eq.${encodeURIComponent(site)}` +
    `&vid=eq.${encodeURIComponent(vid)}` +
    `&path=eq.${encodeURIComponent(path)}` +
    `&ts=gte.${since}&order=ts.desc&limit=6`;
  const rows = await sbGet(q);
  return Array.isArray(rows) ? rows.length : 0;
}

async function likelyBotForHit(input) {
  if (computeLikelyBot(input)) return true;
  try {
    const n = await countRecentSamePathViews({
      site: input.site,
      vid: input.vid,
      path: input.path,
      since: input.now - BOT_BEHAVIOR_WINDOW_MS,
    });
    return n >= BOT_BEHAVIOR_MIN_REPEATS;
  } catch {
    return false;
  }
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
      const flagInput = { auto: body.auto === true, city, os, browser, device, screen };
      if (action === "hit") {
        let ref = "";
        try { ref = body.ref ? new URL(body.ref).hostname : ""; } catch {}
        const likelyBot = await likelyBotForHit({ ...flagInput, site, vid, path, now });
        await sb("site_stats_views", { ts: now, site, vid, path, ref: ref.slice(0, 80), country, device, os, browser, city, region, tz, utm_source, screen, likely_bot: likelyBot }, "return=minimal");
        await sb("site_stats_live", { site, vid, ts: now, path, country, os, browser, city, region, likely_bot: likelyBot }, "return=minimal,resolution=merge-duplicates");
      } else {
        // Ping: never clear a flag. A behaviour flag from an earlier hit
        // survives quiet pings (likely_bot is omitted, so the upsert keeps
        // the stored value); automation / datacenter signatures can only
        // ever SET it. Also omit os/browser here — the beacon does not send
        // them on ping, and writing "unknown" would clobber the hit's real
        // values on the live row every 20s.
        const liveRow = { site, vid, ts: now, path, country, city, region };
        if (computeLikelyBot(flagInput)) liveRow.likely_bot = true;
        await sb("site_stats_live", liveRow, "return=minimal,resolution=merge-duplicates");
      }
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
