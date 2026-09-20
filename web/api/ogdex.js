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

  function send(status, obj) {
    res.statusCode = status;
    return res.end(JSON.stringify(obj));
  }

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
  async function sbCount(path) {
    if (!key) return 0;
    const r = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    const cr = r.headers.get("content-range") || r.headers.get("Content-Range") || "";
    const m = String(cr).match(/\/(\d+)\s*$/);
    return m ? Number(m[1]) : 0;
  }

  const startOfUtcDay = (offset = 0) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString();
  };
  const today = startOfUtcDay(0);
  const yesterday = startOfUtcDay(-1);
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const month = new Date(Date.now() - 30 * 86400000).toISOString();
  const feeOf = (r) => Number(r.fee_usd_actual || r.fee_usd_calc || 0);

  try {
    if (action === "health") {
      return send(200, {
        ok: true,
        action,
        data: {
          state: key ? "up" : "degraded",
          checks: [
            { name: "owner-api", ok: true, state: "up", ms: 1 },
            { name: "supabase", ok: Boolean(key), state: key ? "up" : "missing_service_role", ms: 1 },
          ],
          failedTransactionsToday: 0,
          lastVerifiedBurn: null,
          feeProcessor: "min(tx_usd × 0.012, $10)",
          burnProcessor: "verified burns only",
        },
      });
    }

    if (action === "presence") {
      const presence = await sb("ox_admin_presence?select=user_id,status,last_heartbeat_at,current_app,username,avatar_url,wallet_address,current_path,device,last_seen_at&order=last_heartbeat_at.desc&limit=2000");
      const now = Date.now();
      const rows = presence.map((p) => {
        const ts = p.last_heartbeat_at ? new Date(p.last_heartbeat_at).getTime() : 0;
        const age = ts ? now - ts : 1e12;
        return { ...p, liveStatus: age <= 60000 ? "online" : age <= 300000 ? "away" : "offline" };
      });
      return send(200, { ok: true, action, rows });
    }

    if (action === "ledger" || action === "jupiter") {
      let q = "ox_admin_ledger?select=*&order=created_at.desc&limit=200";
      if (action === "jupiter") q += "&tx_type=in.(swap,jupiter,buy,sell)";
      const rows = await sb(q);
      return send(200, { ok: true, action, rows });
    }
    if (action === "burns") {
      const rows = await sb("ox_admin_burns?select=*&order=created_at.desc&limit=200");
      const mcp = await sb("mcp_burn_ledger?select=id,user_id,wallet_address,tokens_burned,tx_signature,created_at,package_id&order=created_at.desc&limit=200");
      return send(200, { ok: true, action, rows, mcp });
    }
    if (action === "events") {
      const rows = await sb("ox_admin_events?select=*&order=created_at.desc&limit=200");
      return send(200, { ok: true, action, rows });
    }
    if (action === "audit") {
      const rows = await sb("ox_admin_audit?select=*&order=created_at.desc&limit=200");
      return send(200, { ok: true, action, rows });
    }
    if (action === "daily") {
      const rows = await sb("ox_admin_daily?select=*&order=day.desc&limit=90");
      return send(200, { ok: true, action, rows });
    }
    if (action === "search") {
      const q = String(body.q || body.query || "").trim();
      const users = q
        ? await sb(`profiles?or=(username.ilike.*${encodeURIComponent(q)}*,wallet_address.ilike.*${encodeURIComponent(q)}*)&select=user_id,username,wallet_address,created_at&limit=40`)
        : [];
      return send(200, { ok: true, action, users, rows: users });
    }
    if (action === "user") {
      const uid = String(body.userId || body.user_id || "").trim();
      const rows = uid ? await sb(`profiles?user_id=eq.${encodeURIComponent(uid)}&select=*&limit=1`) : [];
      return send(200, { ok: true, action, data: rows[0] || null });
    }

    const [
      total,
      newToday,
      newYesterday,
      newWeek,
      newMonth,
      presence,
      ledger,
      burns,
      mcpBurns,
      tokens,
      activityToday,
    ] = await Promise.all([
      sbCount("profiles?select=user_id"),
      sbCount(`profiles?select=user_id&created_at=gte.${today}`),
      sbCount(`profiles?select=user_id&created_at=gte.${yesterday}&created_at=lt.${today}`),
      sbCount(`profiles?select=user_id&created_at=gte.${week}`),
      sbCount(`profiles?select=user_id&created_at=gte.${month}`),
      sb("ox_admin_presence?select=user_id,status,last_heartbeat_at,current_app,username,avatar_url,wallet_address,current_path,device,last_seen_at&limit=5000"),
      sb(`ox_admin_ledger?select=id,status,value_usd,fee_usd_actual,fee_usd_calc,application,tx_type,verified_onchain,created_at&created_at=gte.${month}&limit=8000`),
      sb(`ox_admin_burns?select=tokens_burned,verified_onchain,created_at&created_at=gte.${month}&limit=5000`),
      sb(`mcp_burn_ledger?select=tokens_burned,created_at&created_at=gte.${month}&limit=5000`),
      sb(`orbitx_tokens?select=id,created_at&created_at=gte.${month}&limit=4000`),
      sb(`user_activity?select=user_id,created_at&created_at=gte.${today}&limit=8000`),
    ]);

    const now = Date.now();
    const live = presence.map((p) => {
      const ts = p.last_heartbeat_at ? new Date(p.last_heartbeat_at).getTime() : 0;
      const age = ts ? now - ts : 1e12;
      return { ...p, liveStatus: age <= 60000 ? "online" : age <= 300000 ? "away" : "offline" };
    });
    const completed = ledger.filter((r) => String(r.status) === "completed" && r.verified_onchain);
    const inRange = (iso, since) => iso && new Date(iso).toISOString() >= since;
    const sum = (arr, fn) => arr.reduce((a, r) => a + (Number(fn(r)) || 0), 0);
    const verifiedBurns = [
      ...burns.filter((b) => b.verified_onchain),
      ...mcpBurns,
    ];
    const apps = {};
    for (const row of live) {
      const app = row.current_app || "app";
      apps[app] = apps[app] || { online: 0, away: 0 };
      if (row.liveStatus === "online") apps[app].online += 1;
      if (row.liveStatus === "away") apps[app].away += 1;
    }
    const feesByApp = {};
    for (const row of completed) {
      const app = row.application || "app";
      feesByApp[app] = (feesByApp[app] || 0) + feeOf(row);
    }

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
        total,
        newToday,
        newYesterday,
        newWeek,
        newMonth,
        onlineNow: live.filter((p) => p.liveStatus === "online").length,
        awayNow: live.filter((p) => p.liveStatus === "away").length,
        dau: new Set(activityToday.map((a) => a.user_id).filter(Boolean)).size,
      },
      activity: {
        txMonth: completed.length,
        txToday: completed.filter((r) => inRange(r.created_at, today)).length,
        volumeMonthUsd: sum(completed, (r) => r.value_usd),
        volumeTodayUsd: sum(completed.filter((r) => inRange(r.created_at, today)), (r) => r.value_usd),
        launchesMonth: tokens.length,
        launchesToday: tokens.filter((t) => inRange(t.created_at, today)).length,
        jupiterMonth: completed.filter((r) => /swap|jupiter|buy|sell/i.test(String(r.tx_type || ""))).length,
      },
      revenue: {
        feesMonthUsd: sum(completed, feeOf),
        feesTodayUsd: sum(completed.filter((r) => inRange(r.created_at, today)), feeOf),
        feesWeekUsd: sum(completed.filter((r) => inRange(r.created_at, week)), feeOf),
        feesByApp,
        avgFeeUsd: completed.length ? sum(completed, feeOf) / completed.length : 0,
        maxFeeUsd: completed.reduce((m, r) => Math.max(m, feeOf(r)), 0),
      },
      burns: {
        tokensMonth: sum(verifiedBurns, (b) => b.tokens_burned),
        tokensToday: sum(verifiedBurns.filter((b) => inRange(b.created_at, today)), (b) => b.tokens_burned),
        countMonth: verifiedBurns.length,
        countToday: verifiedBurns.filter((b) => inRange(b.created_at, today)).length,
      },
      apps,
      live: live.filter((p) => p.liveStatus !== "offline").slice(0, 40),
      meta: { supabaseConfigured: Boolean(key) },
    };
    return send(200, { ok: true, action: "overview", data: overview });
  } catch (e) {
    return send(500, { ok: false, error: String(e && e.message || e) });
  }
}


async function handleHunterHttp(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  try {
    const mod = await import("./orbitx/_handlers/_mcp-hunter-agent.js");
    const u = new URL(req.url, "http://x");
    const tick = u.searchParams.get("tick") === "1" || (req.body && (req.body.tick === 1 || req.body.tick === true || req.body.action === "tick"));
    const out = tick ? await mod.tickHunter({ force: true }) : await mod.snapshotHunter();
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ...out, disclaimer: "Dry $4 ALPHA loop. Live clips need HUNTER_LIVE." }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: false,
      error: String(e && e.message || e),
      desk: { name: "ALPHA", equityUsd: 4, clipUsd: 1.5, wins: 0, losses: 0, dryRun: true, note: "Hunter module error — still MCP-only dry desk." },
      feed: [],
    }));
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
  if (seg === "hunter" || seg === "hunter-agent") {
    return handleHunterHttp(req, res);
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
