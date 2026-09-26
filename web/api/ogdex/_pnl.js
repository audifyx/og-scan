import { callFn } from "./_lib.js";
import { parseSwap } from "./_swap.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOLP_CACHE = { v: 0, t: 0 };
async function solPrice() {
  if (Date.now() - SOLP_CACHE.t < 60000 && SOLP_CACHE.v) return SOLP_CACHE.v;
  try {
    const r = await fetch("https://lite-api.jup.ag/price/v3?ids=" + SOL_MINT);
    const d = await r.json();
    SOLP_CACHE.v = Number(d[SOL_MINT]?.usdPrice) || 0;
    SOLP_CACHE.t = Date.now();
  } catch {}
  return SOLP_CACHE.v;
}
async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

// One retry on null/throw — getTransaction is frequently rate-limited under load.
async function rpcTx(signature) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const t = await rpc("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (t) return t;
    } catch {
      /* retry */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

// Run async jobs with a hard concurrency cap so we don't flood the RPC proxy.
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Realized + unrealized PnL, win rate, and per-token breakdown from a wallet's
// recent swap history (SOL legs only). `priceMap` (mint -> usdPrice) is optional;
// when provided, open positions are valued for unrealized PnL.
// Also returns the parsed `swaps` (newest first) so /wallet can embed a trade tape
// without a second RPC round-trip.
export async function computePnl(address, opts = {}) {
  const { sigLimit = 50, priceMap = null } = opts;
  const sigs = (await rpc("getSignaturesForAddress", [address, { limit: sigLimit }])) || [];
  const txs = await mapPool(sigs, 8, (s) => rpcTx(s.signature));
  const swapsChrono = txs
    .map((t) => parseSwap(t, address))
    .filter((s) => s && s.solAmount > 0)
    .sort((a, b) => a.time - b.time);

  // pos: mint -> { tokens, cost (sol), realized (sol), wins, closed, buys, sells, boughtSol, soldSol }
  const pos = {};
  let realizedSol = 0,
    wins = 0,
    closed = 0;
  for (const s of swapsChrono) {
    const p =
      pos[s.mint] ||
      (pos[s.mint] = {
        tokens: 0,
        cost: 0,
        realized: 0,
        wins: 0,
        closed: 0,
        buys: 0,
        sells: 0,
        boughtSol: 0,
        soldSol: 0,
      });
    if (s.side === "buy") {
      p.tokens += s.tokenAmount;
      p.cost += s.solAmount;
      p.boughtSol += s.solAmount;
      p.buys++;
    } else {
      // sell
      p.sells++;
      p.soldSol += s.solAmount;
      if (p.tokens <= 0) continue;
      const sold = Math.min(s.tokenAmount, p.tokens);
      const avg = p.cost / p.tokens;
      const costOfSold = avg * sold;
      const proceeds = s.solAmount * (sold / s.tokenAmount);
      const pnl = proceeds - costOfSold;
      realizedSol += pnl;
      closed++;
      if (pnl > 0) wins++;
      p.realized += pnl;
      p.closed++;
      if (pnl > 0) p.wins++;
      p.tokens -= sold;
      p.cost -= costOfSold;
    }
  }
  const sp = await solPrice();

  let unrealizedSol = 0;
  const positions = [];
  const perToken = [];
  for (const [mint, p] of Object.entries(pos)) {
    const realizedUsd = p.realized * sp;
    let unrealizedUsd = null,
      curPriceUsd = null,
      curValueUsd = null,
      avgCostUsd = null;
    const costSol = p.cost;
    const costUsd = costSol * sp;
    const open = p.tokens > 1e-9 && p.cost > 1e-9;
    if (open) {
      const px = priceMap ? Number(priceMap[mint]?.usdPrice) || 0 : 0;
      avgCostUsd = p.tokens > 0 ? costUsd / p.tokens : null;
      if (px > 0) {
        curPriceUsd = px;
        curValueUsd = p.tokens * px;
        unrealizedUsd = curValueUsd - costUsd;
        const curValueSol = sp > 0 ? curValueUsd / sp : 0;
        unrealizedSol += curValueSol - costSol;
      }
      positions.push({
        mint,
        tokens: p.tokens,
        costSol,
        costUsd,
        avgCostUsd,
        curPriceUsd,
        curValueUsd,
        unrealizedUsd,
      });
    }
    const tokWins = p.wins;
    const tokLosses = Math.max(0, p.closed - p.wins);
    perToken.push({
      mint,
      realizedUsd,
      realizedSol: p.realized,
      unrealizedUsd,
      totalUsd: realizedUsd + (unrealizedUsd || 0),
      closedTrades: p.closed,
      wins: tokWins,
      losses: tokLosses,
      winRate: p.closed > 0 ? Math.round((tokWins / p.closed) * 100) : null,
      open,
      tokens: open ? p.tokens : 0,
      avgCostUsd,
      // Remaining cost basis for open bags; null when fully closed in-window.
      costUsd: open ? costUsd : null,
      costSol: open ? costSol : null,
      potUsd: open ? curValueUsd : null,
      boughtSol: p.boughtSol,
      boughtUsd: p.boughtSol * sp,
      soldSol: p.soldSol,
      soldUsd: p.soldSol * sp,
      buys: p.buys,
      sells: p.sells,
      curPriceUsd,
      curValueUsd,
      unrealizedPct:
        unrealizedUsd != null && costUsd > 0 ? (unrealizedUsd / costUsd) * 100 : null,
    });
  }
  perToken.sort((a, b) => (b.totalUsd || 0) - (a.totalUsd || 0));
  positions.sort((a, b) => (b.curValueUsd || 0) - (a.curValueUsd || 0));

  const unrealizedUsd = unrealizedSol * sp;
  const swaps = [...swapsChrono].sort((a, b) => b.time - a.time);

  return {
    realizedPnlUsd: realizedSol * sp,
    realizedPnlSol: realizedSol,
    unrealizedPnlUsd: priceMap ? unrealizedUsd : null,
    unrealizedPnlSol: priceMap ? unrealizedSol : null,
    totalPnlUsd: priceMap ? realizedSol * sp + unrealizedUsd : null,
    winRate: closed > 0 ? Math.round((wins / closed) * 100) : null,
    wins,
    losses: Math.max(0, closed - wins),
    closedTrades: closed,
    openPositions: positions.length,
    totalSwaps: swaps.length,
    positions,
    perToken,
    swaps,
    solPrice: sp,
  };
}

// Mints involved in the wallet's recent swaps — used to fetch prices before
// the second computePnl pass (or to pre-warm a price map).
export async function swapMints(address, sigLimit = 50) {
  const sigs = (await rpc("getSignaturesForAddress", [address, { limit: sigLimit }])) || [];
  const txs = await mapPool(sigs, 8, (s) => rpcTx(s.signature));
  const set = new Set();
  for (const t of txs) {
    const s = parseSwap(t, address);
    if (s && s.mint) set.add(s.mint);
  }
  return [...set];
}
