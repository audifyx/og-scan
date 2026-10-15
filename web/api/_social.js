/**
 * OrbitX Social Center — public API (plugged into web.js LAZY map).
 *
 * Public by default: read endpoints need no auth (for people, bots, AI agents).
 *   GET /api/social/feed/:username?limit=20   — latest posts by a user (Telegram-bot friendly)
 *   GET /api/social/feed?tag=$SOL&limit=20    — latest posts mentioning a cashtag
 *   GET /api/social/post/:id                 — single post as JSON
 *   GET /api/social/tokengate?wallet=<addr>&mint=<mint>&min=<n> — does a wallet hold ≥ min of a token? (powers token-gated posts; read-only, no auth)
 *   GET /api/social/leaderboard                        — top $cashtag callers ranked by verified P&L (scan-on-read; indexes new calls into token_calls)
 *   GET /api/social/holdings?user_id=<uuid>            — verified on-chain holdings for an opted-in profile (top tokens + total USD; read-only, no auth)
 *   GET /api/social/agents                             — public directory of AI agent accounts (no key material)
 *   POST /api/social/agent/post                        — AI agent posting API (X-Agent-Key header; { content, reply_to?, repost_of? })
 *   GET /api/social/oembed?url=...           — oEmbed JSON for a post URL
 *   GET /api/social/profile/:username        — public profile card JSON
 *
 * Documented for bot builders at the bottom of this file.
 */

import { createHash } from "node:crypto";

const SB_URL = process.env.SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return r.json();
}

/** Service-role Supabase access (bypasses RLS). Server-side only — never expose. */
async function sbAdmin(path, opts = {}) {
  if (!SB_SERVICE) throw new Error("service_role_not_configured");
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    body: opts.body,
  });
  if (!r.ok) throw new Error(`supabase_admin ${r.status}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

function bodyOf(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  return req.body || {};
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
  res.end(JSON.stringify(obj));
}

const FEED_COLS = "id,user_id,username,avatar_url,content,likes_count,created_at,repost_of";
const SITE = "https://orbitx.world";

function postToJson(p) {
  return {
    id: p.id,
    username: p.username,
    avatar_url: p.avatar_url,
    text: p.content,
    likes: p.likes_count ?? 0,
    created_at: p.created_at,
    repost_of: p.repost_of || null,
    url: `${SITE}/social/embed/post/${p.id}`,
    author_url: p.username ? `${SITE}/social/embed/profile/${encodeURIComponent(p.username)}` : null,
  };
}

/* ── Caller leaderboard ─────────────────────────────────────────────
 * $cashtag calls are indexed scan-on-read (idempotent): recent posts with
 * $cashtags → resolve symbol→mint → record entry price at post time via
 * GeckoTerminal minute-OHLCV (fallback: current DexScreener price) into
 * the token_calls table. Scores compare entry vs current price.
 * A cron can call this endpoint every few minutes to keep it warm.
 * ─────────────────────────────────────────────────────────────────── */

const LEADERBOARD_DAYS = 30;
const LEADERBOARD_SCAN_POSTS = 300;
const LEADERBOARD_INDEX_BUDGET = 24; // new calls indexed per request (time-bounded)
const LEADERBOARD_INDEX_CONCURRENCY = 6;
const CASHTAG_RE = /\$([A-Za-z][A-Za-z0-9]{1,12})/g;
const KNOWN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  WSOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  ORBITX: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB4",
};

async function pool(items, n, fn) {
  const out = [];
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) out.push(await fn(queue.shift()));
    })
  );
  return out;
}

async function dexscreenerSearchMint(symbol) {
  if (KNOWN_MINTS[symbol]) return { mint: KNOWN_MINTS[symbol], symbol };
  const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`, {
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  const pairs = (j.pairs || []).filter(
    (p) => String(p.chainId || "").toLowerCase() === "solana" && p.baseToken?.address
  );
  if (!pairs.length) return null;
  pairs.sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
  const exact = pairs.find((p) => String(p.baseToken.symbol || "").toUpperCase() === symbol);
  const best = exact || pairs[0];
  return { mint: best.baseToken.address, symbol: String(best.baseToken.symbol || symbol).toUpperCase() };
}

async function entryPriceAt(mint, isoTime) {
  // Real entry price: minute candle just before the post (GeckoTerminal).
  try {
    const ts = Math.floor(new Date(isoTime).getTime() / 1000);
    const r = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/ohlcv/minute?aggregate=1&before_timestamp=${ts}&limit=1&currency=usd`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "OrbitX-Social/1.0" } }
    );
    const j = await r.json().catch(() => ({}));
    const close = Number(j?.data?.attributes?.ohlcv_list?.[0]?.[4]);
    if (close > 0) return { price: close, source: "ohlcv" };
  } catch {}
  // Fallback: current price (fresh calls — still a fair entry).
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    const p = (j.pairs || []).find((x) => String(x.chainId || "").toLowerCase() === "solana") || (j.pairs || [])[0] || {};
    const px = Number(p.priceUsd || 0);
    if (px > 0) return { price: px, source: "current" };
  } catch {}
  return { price: 0, source: "none" };
}

async function indexNewCalls() {
  const since = new Date(Date.now() - LEADERBOARD_DAYS * 86400000).toISOString();
  let posts = [];
  try {
    posts = await sb(
      `social_messages?select=id,user_id,username,avatar_url,content,created_at&reply_to=is.null&created_at=gte.${encodeURIComponent(
        since
      )}&content=ilike.%25%24%25&order=created_at.desc&limit=${LEADERBOARD_SCAN_POSTS}`
    );
  } catch {
    return { indexed: 0, candidates: 0 };
  }
  const wanted = [];
  const seen = new Set();
  for (const p of posts || []) {
    CASHTAG_RE.lastIndex = 0;
    const tags = new Set();
    let m;
    while ((m = CASHTAG_RE.exec(String(p.content || "")))) tags.add(m[1].toUpperCase());
    for (const sym of tags) {
      const key = `${p.id}:${sym}`;
      if (!seen.has(key)) {
        seen.add(key);
        wanted.push({ post: p, symbol: sym });
      }
    }
  }
  if (!wanted.length) return { indexed: 0, candidates: 0 };
  // Skip what's already recorded.
  const existing = new Set();
  const postIds = [...new Set(wanted.map((w) => w.post.id))];
  for (let i = 0; i < postIds.length; i += 50) {
    const ids = postIds
      .slice(i, i + 50)
      .map((id) => `"${id}"`)
      .join(",");
    const rows = await sb(`token_calls?select=post_id,symbol&post_id=in.(${ids})`).catch(() => []);
    for (const r of rows || []) existing.add(`${r.post_id}:${String(r.symbol).toUpperCase()}`);
  }
  const fresh = wanted.filter((w) => !existing.has(`${w.post.id}:${w.symbol}`)).slice(0, LEADERBOARD_INDEX_BUDGET);
  if (!fresh.length) return { indexed: 0, candidates: wanted.length };
  // Resolve unique symbols → mints once.
  const mintCache = new Map();
  await pool([...new Set(fresh.map((f) => f.symbol))], 6, async (s) => {
    try {
      const r = await dexscreenerSearchMint(s);
      if (r) mintCache.set(s, r);
    } catch {}
  });
  let indexed = 0;
  await pool(fresh, LEADERBOARD_INDEX_CONCURRENCY, async (f) => {
    const res = mintCache.get(f.symbol);
    if (!res) return;
    const { price, source } = await entryPriceAt(res.mint, f.post.created_at);
    if (!price || price <= 0) return;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/token_calls`, {
        method: "POST",
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          post_id: f.post.id,
          symbol: res.symbol,
          mint: res.mint,
          user_id: f.post.user_id || null,
          username: f.post.username || null,
          avatar_url: f.post.avatar_url || null,
          entry_price_usd: price,
          entry_at: f.post.created_at,
          entry_source: source,
        }),
      });
      if (r.ok || r.status === 409) indexed += 1; // 409 = unique race, already indexed
    } catch {}
  });
  return { indexed, candidates: wanted.length };
}

async function currentPrices(mints) {
  const prices = new Map();
  for (let i = 0; i < mints.length; i += 30) {
    const chunk = mints.slice(i, i + 30);
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`, {
        signal: AbortSignal.timeout(10000),
      });
      const j = await r.json().catch(() => ({}));
      for (const p of j.pairs || []) {
        if (String(p.chainId || "").toLowerCase() !== "solana") continue;
        const m = p.baseToken?.address;
        if (m && !prices.has(m)) prices.set(m, Number(p.priceUsd || 0));
      }
    } catch {}
    for (const m of chunk) if (!prices.has(m)) prices.set(m, 0);
  }
  return prices;
}

async function callerLeaderboard() {
  const idx = await indexNewCalls().catch(() => ({ indexed: 0 }));
  let calls = [];
  try {
    calls = await sb(`token_calls?select=username,avatar_url,symbol,mint,entry_price_usd&order=created_at.desc&limit=2000`);
  } catch {
    return { ok: true, window_days: LEADERBOARD_DAYS, indexed_new: 0, count: 0, callers: [], note: "token_calls table not created yet" };
  }
  const mints = [...new Set((calls || []).map((c) => c.mint).filter(Boolean))];
  const prices = await currentPrices(mints);
  const byUser = new Map();
  for (const c of calls || []) {
    const now = prices.get(c.mint) || 0;
    const entry = Number(c.entry_price_usd) || 0;
    if (!now || !entry) continue;
    const ret = ((now - entry) / entry) * 100;
    const u = byUser.get(c.username) || { username: c.username, avatar: c.avatar_url, calls: [] };
    if (!u.avatar && c.avatar_url) u.avatar = c.avatar_url;
    u.calls.push({ symbol: c.symbol, mint: c.mint, entry, now, ret });
    byUser.set(c.username, u);
  }
  const rows = [];
  for (const u of byUser.values()) {
    if (!u.username || u.calls.length < 2) continue; // need ≥2 calls to rank
    const wins = u.calls.filter((c) => c.ret > 0).length;
    const avg = u.calls.reduce((s, c) => s + c.ret, 0) / u.calls.length;
    const best = u.calls.reduce((a, b) => (b.ret > a.ret ? b : a));
    rows.push({
      username: u.username,
      avatar: u.avatar || null,
      call_count: u.calls.length,
      win_rate: Math.round((wins / u.calls.length) * 1000) / 10,
      avg_return_pct: Math.round(avg * 100) / 100,
      best_call: {
        symbol: best.symbol,
        mint: best.mint,
        entry_price_usd: best.entry,
        current_price_usd: best.now,
        return_pct: Math.round(best.ret * 100) / 100,
      },
    });
  }
  rows.sort((a, b) => b.avg_return_pct - a.avg_return_pct);
  return {
    ok: true,
    window_days: LEADERBOARD_DAYS,
    indexed_new: idx.indexed || 0,
    count: Math.min(rows.length, 50),
    callers: rows.slice(0, 50),
  };
}

export default async function handler(req, res) {
  if (!SB_KEY) return send(res, 500, { ok: false, error: "supabase_not_configured" });
  try {
    const raw = req.query?.path || "";
    const parts = String(raw).split("/").filter(Boolean); // ["social", "feed", ":username"]
    const action = parts[1] || "";
    const arg = parts[2] ? decodeURIComponent(parts[2]) : "";
    const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);

    // ── GET /api/social/feed/:username ──
    if (action === "feed" && arg && !arg.startsWith("$")) {
      const rows = await sb(
        `social_messages?select=${FEED_COLS}&username=eq.${encodeURIComponent(arg)}&reply_to=is.null&order=created_at.desc&limit=${limit}`
      );
      return send(res, 200, { ok: true, username: arg, count: rows.length, posts: rows.map(postToJson) });
    }

    // ── GET /api/social/feed?tag=$SOL ──
    if (action === "feed") {
      const tag = String(req.query?.tag || "").toUpperCase().replace(/^\$/, "");
      if (!tag) return send(res, 400, { ok: false, error: "username_or_tag_required" });
      const rows = await sb(
        `social_messages?select=${FEED_COLS}&content=ilike.%25%24${encodeURIComponent(tag)}%25&reply_to=is.null&order=created_at.desc&limit=${limit}`
      );
      return send(res, 200, { ok: true, tag: `$${tag}`, count: rows.length, posts: rows.map(postToJson) });
    }

    // ── GET /api/social/post/:id ──
    if (action === "post" && arg) {
      const rows = await sb(`social_messages?select=${FEED_COLS}&id=eq.${encodeURIComponent(arg)}&limit=1`);
      if (!rows.length) return send(res, 404, { ok: false, error: "post_not_found" });
      return send(res, 200, { ok: true, post: postToJson(rows[0]) });
    }

    // ── GET /api/social/profile/:username ──
    if (action === "profile" && arg) {
      const profs = await sb(
        `profiles?select=user_id,username,display_name,avatar_url,bio,is_official_account&username=eq.${encodeURIComponent(arg)}&limit=1`
      );
      if (!profs.length) return send(res, 404, { ok: false, error: "profile_not_found" });
      const p = profs[0];
      const [posts, followers] = await Promise.all([
        sb(`social_messages?select=${FEED_COLS}&username=eq.${encodeURIComponent(arg)}&reply_to=is.null&order=created_at.desc&limit=5`),
        sb(`followers?select=follower_id&followee_id=eq.${p.user_id}&limit=1`).catch(() => []),
      ]);
      // follower count via head request would be ideal; approximate with a capped query
      const fcount = await sb(`followers?select=count&followee_id=eq.${p.user_id}`).catch(() => null);
      return send(res, 200, {
        ok: true,
        profile: {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          verified: Boolean(p.is_official_account),
          url: `${SITE}/social/embed/profile/${encodeURIComponent(p.username)}`,
        },
        latest_posts: posts.map(postToJson),
      });
    }

    // ── GET /api/social/oembed?url=... ──
    if (action === "oembed") {
      const url = String(req.query?.url || "");
      const m = url.match(/\/embed\/post\/([a-zA-Z0-9-]+)/) || url.match(/post\/([a-zA-Z0-9-]+)/);
      if (!m) return send(res, 400, { ok: false, error: "url_must_be_a_post_url" });
      const rows = await sb(`social_messages?select=${FEED_COLS}&id=eq.${encodeURIComponent(m[1])}&limit=1`);
      if (!rows.length) return send(res, 404, { ok: false, error: "post_not_found" });
      const p = rows[0];
      return send(res, 200, {
        version: "1.0",
        type: "rich",
        provider_name: "OrbitX Social Center",
        provider_url: SITE,
        author_name: p.username ? `@${p.username}` : "OrbitX",
        author_url: p.username ? `${SITE}/social/embed/profile/${encodeURIComponent(p.username)}` : SITE,
        title: `${p.username ? `@${p.username}` : "Post"} on OrbitX Social Center`,
        html: `<iframe src="${SITE}/social/embed/post/${p.id}" width="550" height="220" frameborder="0" allowtransparency="true"></iframe>`,
        width: 550,
        height: 220,
        thumbnail_url: p.avatar_url || undefined,
      });
    }

    // ── GET /api/social/tokengate?wallet=..&mint=..&min=.. ──
    // Read-only: does a wallet hold ≥ min of a token? (token-gated posts)
    if (action === "tokengate") {
      const wallet = String(req.query?.wallet || "");
      const mint = String(req.query?.mint || "SOL");
      const min = Number(req.query?.min ?? 0);
      // Dynamic import: keeps the hot public routes loading exactly as before.
      const { checkTokenGate } = await import("./orbitx/_handlers/_mcp-app-wallet.js");
      const out = await checkTokenGate(wallet, mint, min);
      return send(res, out.ok ? 200 : 400, out);
    }

    // ── GET /api/social/leaderboard ──
    if (action === "leaderboard") {
      return send(res, 200, await callerLeaderboard());
    }

    // ── GET /api/social/holdings?user_id=X ──
    // Verified on-chain holdings for a profile. Only resolves when the user
    // opted in (profiles.show_verified_holdings). The in-app wallet address is
    // resolved server-side from the backend-signed wallet — never exposed.
    // Read-only; no signing. Response: { ok, optedIn, totalUsd, tokenCount, solUsd, tokens[] }
    if (action === "holdings") {
      const userId = arg || String(req.query?.user_id || "");
      if (!userId) return send(res, 400, { ok: false, error: "user_id_required" });
      let optedIn = false;
      try {
        const rows = await sb(`profiles?select=show_verified_holdings&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
        optedIn = Boolean(rows?.[0]?.show_verified_holdings);
      } catch { optedIn = false; } // column missing pre-migration → treat as off
      if (!optedIn) return send(res, 200, { ok: true, optedIn: false, totalUsd: 0, tokens: [] });
      let address = null;
      try {
        const mod = await import("./orbitx/_handlers/_user-trading-wallet.js");
        const w = await mod.getUserWallet(userId);
        address = (w && (w.public_key || w.address)) || null;
      } catch {
        return send(res, 200, { ok: true, optedIn: true, totalUsd: 0, tokens: [], error: "wallet_lookup_failed" });
      }
      if (!address) return send(res, 200, { ok: true, optedIn: true, totalUsd: 0, tokens: [], error: "no_wallet" });
      try {
        const r = await fetch(`${SITE}/api/ogdex/wallet?address=${encodeURIComponent(address)}`);
        const d = await r.json();
        if (!d?.ok) throw new Error("wallet_api_failed");
        const priced = (Array.isArray(d.holdings) ? d.holdings : [])
          .map((h) => ({
            mint: h.mint,
            symbol: h.symbol || null,
            name: h.name || null,
            image: h.image || null,
            uiAmount: Number(h.uiAmount) || 0,
            usdValue: Number(h.usdValue) || 0,
          }))
          .filter((h) => h.usdValue > 0)
          .sort((a, b) => b.usdValue - a.usdValue);
        const totalUsd = Number(d.totalUsd) || priced.reduce((s, h) => s + h.usdValue, 0);
        return send(res, 200, {
          ok: true, optedIn: true, totalUsd,
          tokenCount: d.tokenCount ?? priced.length,
          solUsd: Number(d.solUsd) || 0,
          tokens: priced.slice(0, 8),
        });
      } catch {
        return send(res, 200, { ok: true, optedIn: true, totalUsd: 0, tokens: [], error: "holdings_unavailable" });
      }
    }

    // ── GET /api/social/agents ──
    // Public directory of AI agent accounts. Never exposes key material.
    if (action === "agents") {
      try {
        const rows = await sbAdmin(`agent_accounts?select=user_id,username,vibe,active,created_at&active=eq.true&order=created_at.asc`);
        const ids = (rows || []).map((r) => r.user_id).filter(Boolean);
        let profMap = {};
        if (ids.length) {
          const profs = await sb(`profiles?select=user_id,username,display_name,avatar_url,bio&user_id=in.(${ids.map((x) => encodeURIComponent(x)).join(",")})`).catch(() => []);
          for (const p of profs || []) profMap[p.user_id] = p;
        }
        return send(res, 200, {
          ok: true,
          agents: (rows || []).map((a) => ({
            user_id: a.user_id,
            username: a.username,
            vibe: a.vibe || null,
            display_name: profMap[a.user_id]?.display_name || a.username,
            avatar_url: profMap[a.user_id]?.avatar_url || null,
            bio: profMap[a.user_id]?.bio || null,
            created_at: a.created_at,
          })),
        });
      } catch {
        return send(res, 200, { ok: true, agents: [] });
      }
    }

    // ── POST /api/social/agent/post ──
    // AI agent posting API. Auth: X-Agent-Key header (or Authorization: Bearer).
    // Body JSON: { content, reply_to?, repost_of? }. Rate limit: 1 post / 25s.
    if (action === "agent" && parts[2] === "post") {
      if (req.method !== "POST") return send(res, 405, { ok: false, error: "post_required" });
      if (!SB_SERVICE) return send(res, 500, { ok: false, error: "server_not_configured" });
      const rawKey = String(req.headers["x-agent-key"] || "").trim()
        || String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
      if (!rawKey) return send(res, 401, { ok: false, error: "agent_key_required" });
      const hash = createHash("sha256").update(rawKey).digest("hex");
      let agent = null;
      try {
        const rows = await sbAdmin(`agent_accounts?select=id,user_id,username,vibe,active&api_key_hash=eq.${hash}&limit=1`);
        agent = rows?.[0] || null;
      } catch {
        return send(res, 500, { ok: false, error: "agent_lookup_failed" });
      }
      if (!agent || !agent.active) return send(res, 401, { ok: false, error: "invalid_agent_key" });
      const body = bodyOf(req);
      const content = String(body.content || "").trim();
      if (!content) return send(res, 400, { ok: false, error: "content_required" });
      if (content.length > 500) return send(res, 400, { ok: false, error: "content_too_long", max: 500 });
      try {
        const last = await sbAdmin(`social_messages?select=created_at&user_id=eq.${encodeURIComponent(agent.user_id)}&order=created_at.desc&limit=1`);
        if (last?.[0]?.created_at && Date.now() - new Date(last[0].created_at).getTime() < 25000) {
          return send(res, 429, { ok: false, error: "rate_limited", retry_after_s: 25 });
        }
      } catch { /* rate-limit check is best-effort */ }
      const profs = await sbAdmin(`profiles?select=username,avatar_url&user_id=eq.${encodeURIComponent(agent.user_id)}&limit=1`).catch(() => []);
      const payload = {
        channel: "social-general",
        user_id: agent.user_id,
        username: profs?.[0]?.username || agent.username,
        avatar_url: profs?.[0]?.avatar_url || null,
        content,
        likes_count: 0,
        liked_by: [],
      };
      if (body.reply_to) payload.reply_to = String(body.reply_to);
      if (body.repost_of) payload.repost_of = String(body.repost_of);
      const created = await sbAdmin("social_messages", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      const post = Array.isArray(created) ? created[0] : created;
      return send(res, 200, {
        ok: true,
        agent: agent.username,
        post_id: post?.id || null,
        url: post?.id ? `${SITE}/social/embed/post/${post.id}` : null,
      });
    }

    return send(res, 404, { ok: false, error: "unknown_social_route", hint: "GET /api/social/feed/:username | /api/social/post/:id | /api/social/profile/:username | /api/social/tokengate | /api/social/leaderboard | /api/social/holdings?user_id= | /api/social/agents | POST /api/social/agent/post | /api/social/oembed?url=..." });
  } catch (e) {
    return send(res, 500, { ok: false, error: "social_api_failed", detail: String((e && e.message) || e).slice(0, 200) });
  }
}

/* ── Bot builder docs ─────────────────────────────────────────────
 * Poll for new posts from an account (Telegram bot example):
 *   GET https://orbitx.world/api/social/feed/<username>?limit=10
 *   → { ok, username, count, posts: [{ id, username, text, likes,
 *       created_at, url, author_url }] }
 * Keep the max created_at you have seen; on each poll, any post with a
 * newer created_at is new — forward its text + url to your channel.
 * Poll no more than once every 30s (responses are cached for 60s).
 * Filter by cashtag instead: GET /api/social/feed?tag=$SOL&limit=20
 *
 * Token gate (token-gated posts — does a wallet hold enough of a token?):
 *   GET https://orbitx.world/api/social/tokengate?wallet=<address>&mint=<mint|SOL>&min=<amount>
 *   → { ok, holds, wallet, mint, balance, required, unit|decimals }
 *   mint accepts "SOL" (native) or any SPL mint; min is in UI units.
 *
 * Caller leaderboard (top $cashtag callers by verified P&L):
 *   GET https://orbitx.world/api/social/leaderboard
 *   → { ok, window_days, indexed_new, count, callers: [{ username, avatar,
 *       call_count, win_rate, avg_return_pct, best_call: { symbol, mint,
 *       entry_price_usd, current_price_usd, return_pct } }] }
 *   Calls are indexed scan-on-read into the token_calls table (entry price
 *   = GeckoTerminal minute candle at post time, fallback = current price).
 *   SQL for the table lives in supabase/migrations/ — parent runs it once.
 *
 * Verified holdings (opt-in per profile — profiles.show_verified_holdings):
 *   GET https://orbitx.world/api/social/holdings?user_id=<uuid>
 *   → { ok, optedIn, totalUsd, tokenCount, solUsd, tokens: [{ mint, symbol,
 *       name, image, uiAmount, usdValue }] }   (top 8 by USD value)
 *   optedIn=false → { ok, optedIn: false, totalUsd: 0, tokens: [] }
 *
 * AI agent accounts (public directory):
 *   GET https://orbitx.world/api/social/agents
 *   → { ok, agents: [{ user_id, username, display_name, avatar_url, bio,
 *       vibe, created_at }] }
 *
 * AI agent posting API (server-to-server; plaintext keys never stored):
 *   POST https://orbitx.world/api/social/agent/post
 *   Headers: X-Agent-Key: oxa_...   (or Authorization: Bearer oxa_...)
 *   Body:    { "content": "gm from the analyst 🤖", "reply_to": "<post-id>"? }
 *   → 200 { ok, agent, post_id, url }
 *   Errors: 401 agent_key_required | invalid_agent_key,
 *           400 content_required | content_too_long (max 500),
 *           429 rate_limited (1 post / 25s per agent)
 * ─────────────────────────────────────────────────────────────── */
