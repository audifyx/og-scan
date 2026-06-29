import { callFn } from "./_lib.js";
import { parseSwap } from "./_swap.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOLP_CACHE = { v: 0, t: 0 };
async function solPrice() {
  if (Date.now() - SOLP_CACHE.t < 60000 && SOLP_CACHE.v) return SOLP_CACHE.v;
  try { const r = await fetch("https://lite-api.jup.ag/price/v3?ids=" + SOL_MINT); const d = await r.json(); SOLP_CACHE.v = Number(d[SOL_MINT]?.usdPrice) || 0; SOLP_CACHE.t = Date.now(); } catch {}
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
      const t = await rpc("getTransaction", [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
      if (t) return t;
    } catch { /* retry */ }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

// Run async jobs with a hard concurrency cap so we don't flood the RPC proxy.
// Firing 30+ getTransaction calls at once gets rate-limited and silently drops
// transactions, which made the trader leaderboard look empty.
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return out;
}

// Realized + unrealized PnL, win rate, and per-token breakdown from a wallet's
// recent swap history (SOL legs only). `priceMap` (mint -> usdPrice) is optional;
// when provided, open positions are valued for unrealized PnL.
export async function computePnl(address, opts = {}) {
  const { sigLimit = 40, priceMap = null } = opts;
  const sigs = (await rpc("getSignaturesForAddress", [address, { limit: sigLimit }])) || [];
  const txs = await mapPool(sigs, 6, (s) => rpcTx(s.signature));
  const swaps = txs.map((t) => parseSwap(t, address)).filter((s) => s && s.solAmount > 0) // SOL-leg swaps only
    .sort((a, b) => a.time - b.time); // chronological

  // pos: mint -> { tokens, cost (sol), realized (sol), wins, closed, buys, sells }
  const pos = {};
  let realizedSol = 0, wins = 0, closed = 0;
  for (const s of swaps) {
    const p = pos[s.mint] || (pos[s.mint] = { tokens: 0, cost: 0, realized: 0, wins: 0, closed: 0, buys: 0, sells: 0 });
    if (s.side === "buy") { p.tokens += s.tokenAmount; p.cost += s.solAmount; p.buys++; }
    else { // sell
      p.sells++;
      if (p.tokens <= 0) continue;
      const sold = Math.min(s.tokenAmount, p.tokens);
      const avg = p.cost / p.tokens;
      const costOfSold = avg * sold;
      const proceeds = s.solAmount * (sold / s.tokenAmount);
      const pnl = proceeds - costOfSold;
      realizedSol += pnl; closed++; if (pnl > 0) wins++;
      p.realized += pnl; p.closed++; if (pnl > 0) p.wins++;
      p.tokens -= sold; p.cost -= costOfSold;
    }
  }
  const sp = await solPrice();

  // Open positions: remaining tokens with cost basis. Value with priceMap if given.
  let unrealizedSol = 0;
  const positions = [];
  const perToken = [];
  for (const [mint, p] of Object.entries(pos)) {
    const realizedUsd = p.realized * sp;
    let unrealizedUsd = null, curPriceUsd = null, curValueUsd = null, avgCostUsd = null;
    const open = p.tokens > 1e-9 && p.cost > 1e-9;
    if (open) {
      const px = priceMap ? Number(priceMap[mint]?.usdPrice) || 0 : 0;
      const costSol = p.cost;
      const costUsd = costSol * sp;
      avgCostUsd = costUsd / p.tokens;
      if (px > 0) {
        curPriceUsd = px;
        curValueUsd = p.tokens * px;
        unrealizedUsd = curValueUsd - costUsd;
        const curValueSol = sp > 0 ? curValueUsd / sp : 0;
        unrealizedSol += curValueSol - costSol;
      }
      positions.push({ mint, tokens: p.tokens, costSol, costUsd, avgCostUsd, curPriceUsd, curValueUsd, unrealizedUsd });
    }
    perToken.push({
      mint,
      realizedUsd,
      realizedSol: p.realized,
      unrealizedUsd,
      totalUsd: realizedUsd + (unrealizedUsd || 0),
      closedTrades: p.closed,
      winRate: p.closed > 0 ? Math.round((p.wins / p.closed) * 100) : null,
      open,
      tokens: open ? p.tokens : 0,
      avgCostUsd,
      curPriceUsd,
      curValueUsd,
    });
  }
  perToken.sort((a, b) => (b.totalUsd || 0) - (a.totalUsd || 0));
  positions.sort((a, b) => (b.curValueUsd || 0) - (a.curValueUsd || 0));

  const unrealizedUsd = unrealizedSol * sp;
  return {
    realizedPnlUsd: realizedSol * sp,
    realizedPnlSol: realizedSol,
    unrealizedPnlUsd: priceMap ? unrealizedUsd : null,
    unrealizedPnlSol: priceMap ? unrealizedSol : null,
    totalPnlUsd: priceMap ? realizedSol * sp + unrealizedUsd : null,
    winRate: closed > 0 ? Math.round((wins / closed) * 100) : null,
    closedTrades: closed,
    openPositions: positions.length,
    totalSwaps: swaps.length,
    positions,
    perToken,
    solPrice: sp,
  };
}

// Mints involved in the wallet's recent swaps — used to fetch prices before
// the second computePnl pass (or to pre-warm a price map).
export async function swapMints(address, sigLimit = 40) {
  const sigs = (await rpc("getSignaturesForAddress", [address, { limit: sigLimit }])) || [];
  const txs = await mapPool(sigs, 6, (s) => rpcTx(s.signature));
  const set = new Set();
  for (const t of txs) { const s = parseSwap(t, address); if (s && s.mint) set.add(s.mint); }
  return [...set];
}
