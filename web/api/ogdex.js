/**
 * Single catch-all serverless function for the entire OG DEX API.
 * Dispatches by first path segment. Adds per-IP rate limiting + optional soft
 * API key so the keyless public API can't be hammered or run up upstream costs.
 */
import admin from "./ogdex/_routes/admin.js";
import boosts from "./ogdex/_routes/boosts.js";
import chart from "./ogdex/_routes/chart.js";
import configRoute from "./ogdex/_routes/config.js";
import kols from "./ogdex/_routes/kols.js";
import launch from "./ogdex/_routes/launch.js";
import launches from "./ogdex/_routes/launches.js";
import listings from "./ogdex/_routes/listings.js";
import metadata from "./ogdex/_routes/metadata.js";
import report from "./ogdex/_routes/report.js";
import screener from "./ogdex/_routes/screener.js";
import signals from "./ogdex/_routes/signals.js";
import search from "./ogdex/_routes/search.js";
import token from "./ogdex/_routes/token.js";
import trade from "./ogdex/_routes/trade.js";
import track from "./ogdex/_routes/track.js";
import wallet from "./ogdex/_routes/wallet.js";
import alertsRun from "./ogdex/_routes/alerts-run.js";
import alerts from "./ogdex/_routes/alerts.js";
import watchlist from "./ogdex/_routes/watchlist.js";
import rpc from "./ogdex/_routes/rpc.js";
import forensics from "./ogdex/_routes/forensics.js";
import chat from "./ogdex/_routes/chat.js";
import ath from "./ogdex/_routes/ath.js";
import openapi from "./ogdex/_routes/openapi.js";
import health from "./ogdex/_routes/health.js";
import balance from "./ogdex/_routes/balance.js";
import safety from "./ogdex/_routes/safety.js";
import xray from "./ogdex/_routes/xray.js";
import swaps from "./ogdex/_routes/swaps.js";
import llms from "./ogdex/_routes/llms.js";
import leaderboard from "./ogdex/_routes/leaderboard.js";
import research from "./ogdex/_routes/research.js";
import platformStats from "./ogdex/_routes/platform-stats.js";

const ROUTES = {
  admin, boosts, chart, kols, launch, launches,
  config: configRoute, listings, metadata, report, screener, signals, search, token, trade, track, wallet, watchlist, alerts, rpc, forensics, chat, ath, openapi,
  "openapi.json": openapi, health, balance, safety, xray, swaps, llms, "llms.txt": llms, leaderboard,
  "alerts-run": alertsRun, research,
  "platform-stats": platformStats,
};

const NO_LIMIT = new Set(["openapi", "openapi.json", "health", "track", "admin", "alerts-run", "llms", "llms.txt"]);
const LIMITS = { chat: 12, forensics: 20, report: 10 };
const DEFAULT_LIMIT = 60;
const WINDOW_MS = 10_000;

const buckets = new Map();
function rateLimit(ip, seg) {
  const limit = LIMITS[seg] ?? DEFAULT_LIMIT;
  const now = Date.now();
  const key = `${ip}:${seg}`;
  let b = buckets.get(key);
  if (!b || now >= b.reset) { b = { count: 0, reset: now + WINDOW_MS }; buckets.set(key, b); }
  b.count++;
  if (buckets.size > 5000) { for (const [k, v] of buckets) if (now >= v.reset) buckets.delete(k); }
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), retryMs: b.reset - now, limit };
}

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function hasSoftKey(req, u) {
  const allow = (process.env.OGDEX_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allow.length) return false;
  const k = req.headers["x-ogdex-key"] || u.searchParams.get("key") || "";
  return !!k && allow.includes(String(k));
}

export default async function handler(req, res) {
  let seg = "";
  let u;
  try {
    u = new URL(req.url, "http://x");
    const qp = u.searchParams.get("path") || (req.query && (Array.isArray(req.query.path) ? req.query.path[0] : req.query.path));
    if (qp) seg = String(qp).split("/").filter(Boolean).pop() || "";
    else {
      const parts = u.pathname.split("/").filter(Boolean);
      seg = parts[parts.length - 1] || "";
      if (seg === "ogdex" || seg === "api") seg = "";
    }
  } catch { u = new URL("http://x"); }

  const route = ROUTES[seg];
  if (!route) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: `unknown route: ${seg || "(none)"}` }));
    return;
  }

  if (!NO_LIMIT.has(seg) && req.method !== "OPTIONS" && !hasSoftKey(req, u)) {
    const rl = rateLimit(clientIp(req), seg);
    res.setHeader("X-RateLimit-Limit", String(rl.limit));
    res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
    if (!rl.ok) {
      const retry = Math.ceil(rl.retryMs / 1000);
      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Retry-After", String(retry));
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ ok: false, error: "rate limit exceeded — slow down or request an API key on Telegram @ogscanner", retryAfter: retry }));
      return;
    }
  }

  return route(req, res);
}

export const config = { maxDuration: 30 };
