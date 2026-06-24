/**
 * Single catch-all serverless function for the entire OG DEX API.
 *
 * Vercel's Hobby plan caps a deployment at 12 serverless functions, and each
 * file in /api normally becomes its own function. To stay under the limit (and
 * keep adding endpoints freely), every route lives in api/_routes/*.js — the
 * leading underscore folder is excluded from Vercel's function count — and this
 * one function dispatches to them by the first path segment.
 *
 * Frontend URLs are unchanged: /api/wallet, /api/launch?config=1, etc.
 * To add a new endpoint: drop api/_routes/<name>.js and register it below.
 */
import admin from "./_routes/admin.js";
import boosts from "./_routes/boosts.js";
import chart from "./_routes/chart.js";
import config from "./_routes/config.js";
import kols from "./_routes/kols.js";
import launch from "./_routes/launch.js";
import launches from "./_routes/launches.js";
import listings from "./_routes/listings.js";
import report from "./_routes/report.js";
import screener from "./_routes/screener.js";
import search from "./_routes/search.js";
import token from "./_routes/token.js";
import track from "./_routes/track.js";
import wallet from "./_routes/wallet.js";
import rpc from "./_routes/rpc.js";

const ROUTES = {
  admin, boosts, chart, config, kols, launch, launches,
  listings, report, screener, search, token, track, wallet, rpc,
};

export default async function handler(req, res) {
  // Resolve the route segment from the path (e.g. /api/wallet -> "wallet").
  // Fall back to Vercel's parsed catch-all param if present.
  // Resolve the route from the LAST path segment so this works whether mounted
  // at /api/<route> (standalone) or /api/ogdex/<route> (inside OG Scan).
  let seg = "";
  try {
    const { pathname } = new URL(req.url, "http://x");
    const parts = pathname.split("/").filter(Boolean);
    seg = parts[parts.length - 1] || "";
  } catch {}
  if (!seg && req.query) {
    const p = req.query.path;
    if (Array.isArray(p)) seg = p[p.length - 1] || "";
    else seg = p || "";
  }

  const route = ROUTES[seg];
  if (!route) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: `unknown route: ${seg || "(none)"}` }));
    return;
  }
  return route(req, res);
}
