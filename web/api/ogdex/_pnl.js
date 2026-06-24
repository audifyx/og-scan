import { callFn } from "./_lib.js";
import { parseSwap } from "./_swap.js";

const SOLP_CACHE = { v: 0, t: 0 };
async function solPrice() {
  if (Date.now() - SOLP_CACHE.t < 60000 && SOLP_CACHE.v) return SOLP_CACHE.v;
  try { const r = await fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112"); const d = await r.json(); SOLP_CACHE.v = Number(d.So11111111111111111111111111111111111111112?.usdPrice) || 0; SOLP_CACHE.t = Date.now(); } catch {}
  return SOLP_CACHE.v;
}
async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

// Realized PnL + win rate from a wallet's recent swap history (SOL legs only).
export async function computePnl(address, sigLimit = 40) {
  const sigs = (await rpc("getSignaturesForAddress", [address, { limit: sigLimit }])) || [];
  const txs = await Promise.all(sigs.map((s) => rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
  const swaps = txs.map((t) => parseSwap(t, address)).filter((s) => s && s.solAmount > 0) // SOL-leg swaps only
    .sort((a, b) => a.time - b.time); // chronological

  const pos = {}; // mint -> { tokens, cost }
  let realizedSol = 0, wins = 0, closed = 0;
  for (const s of swaps) {
    const p = pos[s.mint] || (pos[s.mint] = { tokens: 0, cost: 0 });
    if (s.side === "buy") { p.tokens += s.tokenAmount; p.cost += s.solAmount; }
    else { // sell
      if (p.tokens <= 0) continue;
      const sold = Math.min(s.tokenAmount, p.tokens);
      const avg = p.cost / p.tokens;
      const costOfSold = avg * sold;
      const proceeds = s.solAmount * (sold / s.tokenAmount);
      const pnl = proceeds - costOfSold;
      realizedSol += pnl; closed++; if (pnl > 0) wins++;
      p.tokens -= sold; p.cost -= costOfSold;
    }
  }
  const sp = await solPrice();
  return {
    realizedPnlUsd: realizedSol * sp,
    realizedPnlSol: realizedSol,
    winRate: closed > 0 ? Math.round((wins / closed) * 100) : null,
    closedTrades: closed,
    totalSwaps: swaps.length,
  };
}
