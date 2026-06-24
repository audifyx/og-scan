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
import admin from "./ogdex/_routes/admin.js";
import boosts from "./ogdex/_routes/boosts.js";
import chart from "./ogdex/_routes/chart.js";
import config from "./ogdex/_routes/config.js";
import kols from "./ogdex/_routes/kols.js";
import launch from "./ogdex/_routes/launch.js";
import launches from "./ogdex/_routes/launches.js";
import listings from "./ogdex/_routes/listings.js";
import report from "./ogdex/_routes/report.js";
import screener from "./ogdex/_routes/screener.js";
import signals from "./ogdex/_routes/signals.js";
import search from "./ogdex/_routes/search.js";
import token from "./ogdex/_routes/token.js";
import track from "./ogdex/_routes/track.js";
import wallet from "./ogdex/_routes/wallet.js";
import rpc from "./ogdex/_routes/rpc.js";

const ROUTES = {
  admin, boosts, chart, config, kols, launch, launches,
  listings, report, screener, signals, search, token, track, wallet, rpc,
};

export default async function handler(req, res) {
  // Resolve the route segment from the path (e.g. /api/wallet -> "wallet").
  // Fall back to Vercel's parsed catch-all param if present.
  // Mounted at /api/ogdex inside OG Scan. The route name arrives as ?path=<route>
  // (via the vercel.json rewrite) or as the last path segment.
  let seg = "";
  try {
    const u = new URL(req.url, "http://x");
    const qp = u.searchParams.get("path") || (req.query && (Array.isArray(req.query.path) ? req.query.path[0] : req.query.path));
    if (qp) {
      seg = String(qp).split("/").filter(Boolean).pop() || "";
    } else {
      const parts = u.pathname.split("/").filter(Boolean);
      seg = parts[parts.length - 1] || "";
      if (seg === "ogdex" || seg === "api") seg = "";
    }
  } catch {}

  const route = ROUTES[seg];
  if (!route) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: `unknown route: ${seg || "(none)"}` }));
    return;
  }
  return route(req, res);
}
