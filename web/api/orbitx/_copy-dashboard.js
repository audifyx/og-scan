/**
 * Copy-trading dashboard data API.
 *
 * GET /api/orbitx/copy-dashboard
 * Routed via web/api/orbitx-hub.js dispatcher (head === "copy-dashboard")
 * because vercel.json rewrites /api/orbitx/* into the hub.
 *
 * Auth: Supabase JWT in the Authorization Bearer header, verified against
 * /auth/v1/user — the same pattern as web/api/_orbitx-delegated-wallet.js
 * and the agentos authedFetch helper on the frontend.
 *
 * Reads the app_copy rows in ox_live_events (agent_id = calling user):
 *   meta.fills      — our mirrored fills [{side,mint,symbol,usd,priceUsd,theirUsd,theirSig,sig,ok,pending,skipped,error,fraction,at}]
 *   meta.theirTrades — his swaps [{signature,side,mint,symbol,amount,theirUsd,priceUsd,at}]
 * (theirTrades is written by the copy tick; this route only reads.)
 *
 * No trades execute here. No side effects, no top-level await.
 */
import { sb, tokenInfo, isFillOpen } from "./_handlers/_mcp-app-wallet.js";

function supaBase() {
  return (
    process.env.SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  );
}
function supaAnon() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  );
}

async function userFromRequest(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  const url = supaBase();
  const anon = supaAnon();
  if (!String(auth).startsWith("Bearer ") || !url || !anon) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: String(auth), apikey: anon },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const toTs = (v) => {
  if (v == null) return 0;
  const t = typeof v === "number" ? v : new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------------------------------------------ */
/* average-cost book from a fill/trade stream                           */
/* ------------------------------------------------------------------ */
function newBook(mint, symbol) {
  return {
    mint,
    symbol: symbol || "?",
    buys: 0,
    sells: 0,
    realized: 0,
    wins: 0,
    losses: 0,
    openAmount: 0,
    openCost: 0,
  };
}

// records: {side, mint, symbol, amount, fraction, usd, priceUsd}
// Buy  -> amount added at priceUsd.
// Sell -> fraction of the open position closed: proceeds = openAmount*fraction*priceUsd,
//         costOfSold = fraction of remaining cost; a win/loss is booked per sell.
export function buildBook(records) {
  const books = new Map();
  let totalBuys = 0;
  let totalSells = 0;
  const ordered = [...records].sort((a, b) => toTs(a.at) - toTs(b.at)); // oldest first
  for (const r of ordered) {
    const side = String(r.side || "");
    if (side !== "buy" && side !== "sell") continue;
    const mint = String(r.mint || "");
    if (!mint) continue;
    let b = books.get(mint);
    if (!b) {
      b = newBook(mint, r.symbol);
      books.set(mint, b);
    }
    const price = num(r.priceUsd);
    if (side === "buy") {
      totalBuys += 1;
      const amt = num(r.amount);
      if (!(price > 0) || !(amt > 0)) continue; // skip priceUsd=0 / zero size — never NaN
      b.buys += 1;
      b.openAmount += amt;
      b.openCost += amt * price;
    } else {
      totalSells += 1;
      if (!(price > 0) || !(b.openAmount > 0)) continue; // no position to close
      let fraction = num(r.fraction);
      if (!(fraction > 0)) {
        const amt = num(r.amount);
        fraction = amt > 0 ? Math.min(1, amt / b.openAmount) : 1;
      }
      fraction = Math.min(1, Math.max(0, fraction));
      if (!(fraction > 0)) continue;
      b.sells += 1;
      const soldAmount = b.openAmount * fraction;
      const proceeds = soldAmount * price;
      const costOfSold = b.openCost * fraction;
      const realized = proceeds - costOfSold;
      b.realized += realized;
      b.openAmount -= soldAmount;
      b.openCost -= costOfSold;
      if (realized > 0) b.wins += 1;
      else b.losses += 1;
    }
  }
  return { books, totalBuys, totalSells };
}

async function currentPrices(mints) {
  const out = new Map();
  await Promise.all(
    [...mints].map(async (mint) => {
      try {
        const info = await tokenInfo(mint);
        const p = num(info && info.priceUsd);
        out.set(mint, { price: p, symbol: info && info.symbol });
      } catch {
        out.set(mint, { price: 0 });
      }
    }),
  );
  return out;
}

export function finalize(bookData, prices) {
  const perToken = [];
  let totalRealized = 0;
  let totalUnrealized = 0;
  let wins = 0;
  let losses = 0;
  for (const b of bookData.books.values()) {
    const now = prices.get(b.mint) || { price: 0 };
    const price = num(now.price);
    if (now.symbol && now.symbol !== "?" && (!b.symbol || b.symbol === "?")) b.symbol = now.symbol;
    const openValueUsd = price > 0 ? b.openAmount * price : 0; // priceUsd=0 -> 0, never NaN
    const unrealized = price > 0 ? openValueUsd - b.openCost : 0;
    totalRealized += b.realized;
    totalUnrealized += unrealized;
    wins += b.wins;
    losses += b.losses;
    perToken.push({
      mint: b.mint,
      symbol: b.symbol,
      buys: b.buys,
      sells: b.sells,
      realizedPnl: b.realized,
      wins: b.wins,
      losses: b.losses,
      openAmount: b.openAmount,
      openValueUsd,
      unrealizedPnl: unrealized,
    });
  }
  perToken.sort((a, b) => b.realizedPnl + b.unrealizedPnl - (a.realizedPnl + a.unrealizedPnl));
  const openPositions = perToken.filter((t) => t.openAmount > 0).length;
  return {
    perToken,
    totalRealized,
    totalUnrealized,
    winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
    totalBuys: bookData.totalBuys,
    totalSells: bookData.totalSells,
    wins,
    losses,
    openPositions,
  };
}

/* ------------------------------------------------------------------ */
/* handler                                                             */
/* ------------------------------------------------------------------ */
export async function handleCopyDashboard(req, res, parts, json) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return json(res, { ok: false, error: "method_not_allowed" }, 405);
  }
  const user = await userFromRequest(req);
  if (!user || !user.id) {
    return json(res, { ok: false, error: "unauthorized" }, 401);
  }
  const client = await sb();
  if (!client) {
    return json(res, { ok: false, error: "db_unavailable" }, 503);
  }
  let rows = [];
  try {
    const { data, error } = await client
      .from("ox_live_events")
      .select("id,meta,created_at")
      .eq("kind", "app_copy")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    rows = (data || []).filter((r) => r.meta && r.meta.followedWallet && isFillOpen(r.meta, "active"));
  } catch (e) {
    return json(res, { ok: false, error: "db_error", message: e?.message || String(e) }, 500);
  }

  const follows = [];
  const ourFills = [];
  const theirTrades = [];
  for (const r of rows) {
    const m = r.meta || {};
    const followId = r.id;
    const wallet = m.followedWallet;
    const label = m.label || null;
    follows.push({
      followId,
      wallet,
      label,
      mode: m.mode,
      sizeValue: m.sizeValue,
      maxPerTradeUsd: m.maxPerTradeUsd,
      createdAt: m.createdAt || r.created_at || null,
    });
    for (const f of m.fills || []) {
      ourFills.push({
        followId,
        wallet,
        followLabel: label,
        side: f.side,
        mint: f.mint,
        symbol: f.symbol,
        usd: num(f.usd),
        priceUsd: num(f.priceUsd),
        theirUsd: num(f.theirUsd),
        theirSig: f.theirSig || null,
        sig: f.sig || null,
        ok: !!f.ok,
        pending: !!f.pending,
        skipped: !!f.skipped,
        error: f.error || null,
        message: f.message || null,
        fraction: f.fraction != null ? num(f.fraction) : null,
        at: f.at || null,
      });
    }
    for (const t of m.theirTrades || []) {
      theirTrades.push({
        followId,
        wallet,
        followLabel: label,
        signature: t.signature || null,
        side: t.side,
        mint: t.mint,
        symbol: t.symbol,
        amount: num(t.amount),
        theirUsd: num(t.theirUsd),
        priceUsd: num(t.priceUsd),
        at: t.at || null,
      });
    }
  }
  ourFills.sort((a, b) => toTs(b.at) - toTs(a.at)); // newest first
  theirTrades.sort((a, b) => toTs(b.at) - toTs(a.at)); // newest first

  // PnL books: ours from ok fills only (failed/skipped never moved money);
  // buys: amount = usd/priceUsd (contract). His from theirTrades (amount direct).
  const ourRecords = ourFills
    .filter((f) => f.ok && !f.pending)
    .map((f) => ({
      side: f.side,
      mint: f.mint,
      symbol: f.symbol,
      amount: f.side === "buy" && f.priceUsd > 0 ? f.usd / f.priceUsd : 0,
      fraction: f.side === "sell" ? f.fraction : null,
      priceUsd: f.priceUsd,
      at: f.at,
    }));
  const theirRecords = theirTrades.map((t) => ({
    side: t.side,
    mint: t.mint,
    symbol: t.symbol,
    amount: t.amount,
    fraction: null,
    priceUsd: t.priceUsd,
    at: t.at,
  }));
  const ourBook = buildBook(ourRecords);
  const theirBook = buildBook(theirRecords);

  // One oracle pass for every open token in either book.
  const openMints = new Set();
  for (const b of [...ourBook.books.values(), ...theirBook.books.values()]) {
    if (b.openAmount > 0) openMints.add(b.mint);
  }
  const prices = await currentPrices(openMints);

  return json(res, {
    ok: true,
    follows,
    theirTrades,
    ourFills,
    stats: finalize(ourBook, prices),
    theirStats: finalize(theirBook, prices),
  });
}

export default async function handler(req, res) {
  // Standalone entry for environments without the hub rewrite: reuse the
  // same shape the hub passes (req, res, parts, json).
  const parts = (() => {
    try {
      const u = new URL(req.url || "/", "http://x");
      return u.pathname.split("/").filter(Boolean);
    } catch {
      return [];
    }
  })();
  const json = (r, data, status = 200) => {
    r.statusCode = status;
    r.setHeader("Content-Type", "application/json");
    r.end(JSON.stringify(data));
  };
  return handleCopyDashboard(req, res, parts, json);
}
