import { resilientRpc } from "./_lib.js";
import { parseTx, STABLE_MINTS } from "./_swap.js";

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
  // Same resilient path as the wallet route — see _lib.resilientRpc.
  return resilientRpc(method, params);
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

function newPos() {
  return {
    tokens: 0,
    cost: 0,
    realized: 0,
    wins: 0,
    closed: 0,
    buys: 0,
    sells: 0,
    boughtSol: 0,
    soldSol: 0,
    // Transfer accounting (2026-10-13): transfers are NOT trades, but they
    // move the position. A transfer-out reduces tokens + cost basis
    // proportionally (average-cost) WITHOUT generating proceeds or realized
    // P&L; a transfer-in adds tokens at zero cost. Without this, a wallet
    // that buys then transfers everything out still shows a phantom open
    // position (E33u / LILANSEM: bought 115,308, transferred out all of it,
    // PnL claimed a $2.76 open position + fake +$1.31 unrealized).
    transferredIn: 0,
    transferredOut: 0,
    costWrittenOff: 0,
    closedByTransfer: false,
  };
}

// Pure position reducer over parseTx-classified transactions (chronological).
// Exported for unit tests — computePnl is the RPC wrapper around it.
export function reduceTransactions(parsedTxs, { solPriceUsd = 0 } = {}) {
  const chrono = [...(parsedTxs || [])].filter(Boolean).sort((a, b) => a.time - b.time);
  const pos = {};
  const swapsChrono = [];
  let realizedSol = 0,
    wins = 0,
    closed = 0;
  const getPos = (mint) => pos[mint] || (pos[mint] = newPos());

  for (const t of chrono) {
    if (t.kind === "swap") {
      // Stable-leg costing: a USDC-leg swap's solAmount is only the fee, so
      // the economic size must include the stable delta converted at the
      // SOL price. solDelta is SIGNED: negative = SOL paid (buy), positive =
      // SOL received net of fee (sell). For a sell, proceeds = solDelta +
      // stableIn (fee already netted in solDelta when positive, and paid
      // separately when negative). For a buy, cost = SOL paid + stableOut.
      let stableIn = 0,
        stableOut = 0;
      for (const [m, d] of Object.entries(t.tokenDeltas || {})) {
        if (!STABLE_MINTS.has(m)) continue;
        if (d > 0) stableIn += d;
        else stableOut += -d;
      }
      const stableToSol = solPriceUsd > 0 ? (usd) => usd / solPriceUsd : () => 0;
      const p = getPos(t.mint);
      if (t.side === "buy") {
        const costSol = Math.max(0, -(t.solDelta || 0)) + stableToSol(stableOut);
        swapsChrono.push({
          txHash: t.txHash,
          side: t.side,
          mint: t.mint,
          tokenAmount: t.tokenAmount,
          // Economic size in SOL (includes stable leg) so downstream USD
          // math (solAmount * SOL price) shows the real swap size.
          solAmount: costSol,
          stableUsd: stableOut,
          time: t.time,
        });
        p.tokens += t.tokenAmount;
        p.cost += costSol;
        p.boughtSol += costSol;
        p.buys++;
      } else {
        // sell
        const proceeds = (t.solDelta || 0) + stableToSol(stableIn);
        swapsChrono.push({
          txHash: t.txHash,
          side: t.side,
          mint: t.mint,
          tokenAmount: t.tokenAmount,
          solAmount: Math.max(0, proceeds),
          stableUsd: stableIn,
          time: t.time,
        });
        p.sells++;
        p.soldSol += Math.max(0, proceeds);
        if (p.tokens <= 0) continue; // sold untracked tokens — no cost basis, no P&L
        const sold = Math.min(t.tokenAmount, p.tokens);
        const avg = p.cost / p.tokens;
        const costOfSold = avg * sold;
        const pnl = proceeds * (sold / t.tokenAmount) - costOfSold;
        realizedSol += pnl;
        closed++;
        if (pnl > 0) wins++;
        p.realized += pnl;
        p.closed++;
        if (pnl > 0) p.wins++;
        p.tokens -= sold;
        p.cost -= costOfSold;
      }
    } else if (t.kind === "transfer") {
      // Transfers move the position without trading. Track them so a
      // transfer-out closes the position instead of leaving a phantom bag.
      for (const [mint, delta] of Object.entries(t.tokenDeltas || {})) {
        if (mint === SOL_MINT) continue; // SOL transfers don't affect token positions
        const p = getPos(mint);
        if (delta > 0) {
          p.tokens += delta;
          p.transferredIn += delta;
        } else {
          const out = -delta;
          p.transferredOut += out;
          if (p.tokens <= 0) continue; // moved untracked tokens — nothing to write off
          const take = Math.min(out, p.tokens);
          const costOut = p.cost * (take / p.tokens);
          p.cost -= costOut;
          p.costWrittenOff += costOut;
          p.tokens -= take;
          if (p.tokens <= 1e-9) {
            // Entire position moved out without a sale: closed by transfer,
            // NOT a realized gain/loss. Remaining cost is written off.
            p.tokens = 0;
            p.costWrittenOff += p.cost;
            p.cost = 0;
            p.closedByTransfer = true;
          }
        }
      }
    }
    // failed / other / unknown: no position movement.
  }
  return { pos, swapsChrono, realizedSol, wins, closed };
}

// Realized + unrealized PnL, win rate, and per-token breakdown from a wallet's
// recent transaction history. Swaps are trades (SOL + stable legs costed in
// SOL); transfers adjust positions without generating realized P&L.
// `priceMap` (mint -> usdPrice) is optional; when provided, open positions
// are valued for unrealized PnL. Also returns the parsed `swaps` (newest
// first) so /wallet can embed a trade tape without a second RPC round-trip.
// Completeness: `complete` is true only when the sig scan covered the full
// history (fewer sigs than sigLimit). When false, positions may be missing
// buys/sells/transfers outside the window — callers must not treat the PnL
// as final (the wallet route reconciles open positions against live holdings).
export async function computePnl(address, opts = {}) {
  const { sigLimit = 50, priceMap = null } = opts;
  const sigs = await rpc("getSignaturesForAddress", [address, { limit: sigLimit }]);
  if (sigs == null) throw new Error("trade_history_unavailable");
  const txs = await mapPool(sigs, 8, (s) => rpcTx(s.signature));
  const parsed = txs.map((t) => parseTx(t, address));
  const sp = await solPrice();
  const { pos, swapsChrono, realizedSol, wins, closed } = reduceTransactions(parsed, {
    solPriceUsd: sp,
  });

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
    // A position is open when tokens remain — including transfer-only
    // holdings (cost 0: airdrop/gift, valued at full market price).
    const open = p.tokens > 1e-9;
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
        transferredIn: p.transferredIn,
        transferredOut: p.transferredOut,
        closedByTransfer: p.closedByTransfer,
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
      transferredIn: p.transferredIn,
      transferredOut: p.transferredOut,
      costWrittenOff: p.costWrittenOff,
      closedByTransfer: p.closedByTransfer,
    });
  }
  perToken.sort((a, b) => (b.totalUsd || 0) - (a.totalUsd || 0));
  positions.sort((a, b) => (b.curValueUsd || 0) - (a.curValueUsd || 0));

  const unrealizedUsd = unrealizedSol * sp;
  const swaps = [...swapsChrono].sort((a, b) => b.time - a.time);
  const scanned = sigs.length;
  const complete = scanned < sigLimit;

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
    // History-window completeness (see header comment).
    scanned,
    complete,
    hasMore: !complete,
  };
}

// Mints involved in the wallet's recent swaps — used to fetch prices before
// the second computePnl pass (or to pre-warm a price map).
export async function swapMints(address, sigLimit = 50) {
  const sigs = (await rpc("getSignaturesForAddress", [address, { limit: sigLimit }])) || [];
  const txs = await mapPool(sigs, 8, (s) => rpcTx(s.signature));
  const set = new Set();
  for (const t of txs) {
    const s = parseTx(t, address);
    if (s && s.kind === "swap" && s.mint) set.add(s.mint);
  }
  return [...set];
}
