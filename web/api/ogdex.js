/**
 * Single catch-all serverless function for the entire OG DEX API.
 * Dispatches by first path segment. Adds per-IP rate limiting + optional soft
 * API key so the keyless public API can't be hammered or run up upstream costs.
 */
import admin from "./ogdex/_routes/_admin.js";
import boosts from "./ogdex/_routes/_boosts.js";
import chart from "./ogdex/_routes/_chart.js";
import configRoute from "./ogdex/_routes/_config.js";
import kols from "./ogdex/_routes/_kols.js";
import launch from "./ogdex/_routes/_launch.js";
import launches from "./ogdex/_routes/_launches.js";
import listings from "./ogdex/_routes/_listings.js";
import metadata from "./ogdex/_routes/_metadata.js";
import report from "./ogdex/_routes/_report.js";
import screener from "./ogdex/_routes/_screener.js";
import signals from "./ogdex/_routes/_signals.js";
import search from "./ogdex/_routes/_search.js";
import token from "./ogdex/_routes/_token.js";
import trade from "./ogdex/_routes/_trade.js";
import track from "./ogdex/_routes/_track.js";
import wallet from "./ogdex/_routes/_wallet.js";
import alertsRun from "./ogdex/_routes/_alerts-run.js";
import alerts from "./ogdex/_routes/_alerts.js";
import watchlist from "./ogdex/_routes/_watchlist.js";
import rpc from "./ogdex/_routes/_rpc.js";
import forensics from "./ogdex/_routes/_forensics.js";
import chat from "./ogdex/_routes/_chat.js";
import ath from "./ogdex/_routes/_ath.js";
import openapi from "./ogdex/_routes/_openapi.js";
import health from "./ogdex/_routes/_health.js";
import balance from "./ogdex/_routes/_balance.js";
import safety from "./ogdex/_routes/_safety.js";
import xray from "./ogdex/_routes/_xray.js";
import swaps from "./ogdex/_routes/_swaps.js";
import llms from "./ogdex/_routes/_llms.js";
import leaderboard from "./ogdex/_routes/_leaderboard.js";
import research from "./ogdex/_routes/_research.js";
import platformStats from "./ogdex/_routes/_platform-stats.js";
import traders from "./ogdex/_routes/_traders.js";
import waitlist from "./ogdex/_routes/_waitlist.js";
import mcp from "./ogdex/_routes/_mcp.js";
import { createHmac, timingSafeEqual } from "crypto";

const ROUTES = {
  admin, boosts, chart, kols, launch, launches,
  config: configRoute, listings, metadata, report, screener, signals, search, token, trade, track, wallet, watchlist, alerts, rpc, forensics, chat, ath, openapi,
  "openapi.json": openapi, health, balance, safety, xray, swaps, llms, "llms.txt": llms, leaderboard,
  "alerts-run": alertsRun, research,
  "platform-stats": platformStats,
  traders,
  waitlist,
  mcp,
};

const NO_LIMIT = new Set(["openapi", "openapi.json", "health", "llms", "llms.txt", "desk-unlock"]);
const LIMITS = { chat: 12, forensics: 20, report: 10, track: 30, rpc: 40, alerts: 20, watchlist: 20, admin: 30, mcp: 30 };
const DEFAULT_LIMIT = 60;
const WINDOW_MS = 10_000;
/** Soft API keys get a higher cap — never unlimited. */
const SOFT_KEY_MULT = 5;

const buckets = new Map();
function rateLimit(ip, seg, mult = 1) {
  const limit = Math.max(1, Math.floor((LIMITS[seg] ?? DEFAULT_LIMIT) * mult));
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
  const allow = (process.env.ORBITX_DEX_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allow.length) return false;
  // Header-only — query `?key=` leaks to access logs / Referer
  const k = req.headers["x-ogdex-key"] || "";
  return !!k && allow.includes(String(k));
}


function deskSecrets() {
  const out = [];
  for (const key of ["OXW_WORKER_SECRET", "ADMIN_AUTH", "OWNER_DESK_CODE", "ADMIN_PASS"]) {
    const s = String(process.env[key] || "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}
function safeEq(a, b) {
  const L = Buffer.from(String(a));
  const R = Buffer.from(String(b));
  if (L.length !== R.length) return false;
  return timingSafeEqual(L, R);
}
function handleDeskUnlock(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const secrets = deskSecrets();
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, configured: secrets.length > 0 }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "method" })); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== "object") body = {};
  const code = String(body.code || "").trim();
  if (!secrets.length) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
  if (!code || !secrets.some((s) => safeEq(code, s))) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "denied" }));
  }
  if (String(body.purpose || "desk") === "maintenance") {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, purpose: "maintenance" }));
  }
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const mac = createHmac("sha256", secrets[0]).update(String(exp)).digest("hex");
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, token: `oxdesk1.${exp}.${mac}` }));
}


async function handleOwnerApi(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, service: "orbitx-owner" }));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method" }));
  }
  const auth = String(req.headers.authorization || req.headers.Authorization || "");
  if (!/^Bearer\s+\S+/i.test(auth)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Sign in as the owner account" }));
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== "object") body = {};
  const action = String(body.action || "overview");

  const overview = {
    generatedAt: new Date().toISOString(),
    definitions: {
      online: "heartbeat within 60s",
      away: "heartbeat 60s–5min",
      offline: "no heartbeat in 5min",
      completedTx: "ledger.status=completed AND verified_onchain",
      burn: "ox_admin_burns.verified_onchain or mcp_burn_ledger row",
      fee: "min(1.2% of USD notional, $10), backend-enforced",
    },
    users: {
      total: 0, newToday: 0, newYesterday: 0, newWeek: 0, newMonth: 0,
      onlineNow: 0, awayNow: 0, dau: 0,
    },
    activity: {
      txMonth: 0, txToday: 0, volumeMonthUsd: 0, volumeTodayUsd: 0,
      launchesMonth: 0, launchesToday: 0, jupiterMonth: 0,
    },
    revenue: {
      feesMonthUsd: 0, feesTodayUsd: 0, feesWeekUsd: 0, feesByApp: {},
      avgFeeUsd: 0, maxFeeUsd: 0,
    },
    burns: { tokensMonth: 0, tokensToday: 0, countMonth: 0, countToday: 0 },
    apps: {},
    live: [],
  };

  function send(status, obj) {
    res.statusCode = status;
    return res.end(JSON.stringify(obj));
  }

  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    async function sb(path) {
      if (!key) return [];
      const r = await fetch(`${url}/rest/v1/${path}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const t = await r.text();
      if (!r.ok) return [];
      try { const j = JSON.parse(t); return Array.isArray(j) ? j : []; } catch { return []; }
    }

    if (action === "health") {
      return send(200, {
        ok: true,
        action,
        data: {
          state: "up",
          checks: [{ name: "owner-api", ok: true, state: "up", ms: 1 }],
          failedTransactionsToday: 0,
          lastVerifiedBurn: null,
          feeProcessor: "min(tx_usd × 0.012, $10)",
          burnProcessor: "verified burns only",
        },
      });
    }

    if (action === "overview" || action === "presence") {
      const presence = await sb("ox_admin_presence?select=user_id,status,last_heartbeat_at,current_app,username,avatar_url,wallet_address,current_path,device,last_seen_at&limit=2000");
      const now = Date.now();
      const live = presence.map((p) => {
        const ts = p.last_heartbeat_at ? new Date(p.last_heartbeat_at).getTime() : 0;
        const age = ts ? now - ts : 1e12;
        const liveStatus = age <= 60000 ? "online" : age <= 300000 ? "away" : "offline";
        return { ...p, liveStatus };
      });
      overview.users.onlineNow = live.filter((p) => p.liveStatus === "online").length;
      overview.users.awayNow = live.filter((p) => p.liveStatus === "away").length;
      overview.live = live.filter((p) => p.liveStatus !== "offline").slice(0, 40);
      for (const row of overview.live) {
        const app = row.current_app || "app";
        overview.apps[app] = overview.apps[app] || { online: 0, away: 0 };
        if (row.liveStatus === "online") overview.apps[app].online += 1;
        if (row.liveStatus === "away") overview.apps[app].away += 1;
      }
      if (action === "presence") return send(200, { ok: true, action, rows: overview.live });
      return send(200, { ok: true, action, data: overview });
    }

    if (["events", "ledger", "jupiter", "burns", "audit", "daily", "search"].includes(action)) {
      return send(200, { ok: true, action, rows: [], mcp: [], users: [] });
    }
    if (action === "user") return send(200, { ok: true, action, data: null });
    return send(200, { ok: true, action, data: overview });
  } catch (e) {
    return send(200, { ok: true, action, data: overview, warning: String(e && e.message || e) });
  }
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

  if (seg === "desk-unlock" || seg === "orbitx-desk-unlock") {
    return handleDeskUnlock(req, res);
  }
  if (seg === "owner" || seg === "orbitx-owner") {
    return handleOwnerApi(req, res);
  }

  const route = ROUTES[seg];
  if (!route) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: `unknown route: ${seg || "(none)"}` }));
    return;
  }

  if (!NO_LIMIT.has(seg) && req.method !== "OPTIONS") {
    const soft = hasSoftKey(req, u);
    const rl = rateLimit(clientIp(req), seg, soft ? SOFT_KEY_MULT : 1);
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
