/**
 * orbitx_app_pnl — read-only PnL analytics over the user's strategy fills.
 *
 * Aggregates fills recorded in ox_live_events by the strategy engine
 * (limit orders, trailing stops, take-profit ladders, copy-trade mirrors,
 * sniper buys, alert-triggered trades): realized/unrealized per token,
 * win rate, avg hold time, best/worst trades, totals.
 *
 * Read-only: never signs, never trades. Estimates are always flagged.
 */
import {
  needAuth,
  sb,
  tokenInfo,
  solUsd,
  walletRow,
  tokenBalance,
} from "./_mcp-app-wallet.js";

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FILL_KINDS = ["app_limit", "app_trailing", "app_ladder", "app_alert", "app_copy", "app_snipe"];
const OPEN_KINDS = ["app_limit", "app_trailing", "app_ladder", "app_alert", "app_copy", "app_snipe"];

function buyUsdFromSize(size = {}, solPx) {
  if (size.usd != null) return Number(size.usd);
  if (size.amountUsdc != null) return Number(size.amountUsdc);
  if (size.amountSol != null) return Number(size.amountSol) * (solPx || 0);
  return 1; // limit-order default buy size
}

/** Normalize one ox_live_events row into zero or more trade fills. */
function fillsFromRow(r, solPx) {
  const m = r.meta || {};
  const out = [];
  const push = (f) => {
    const mint = f.mint || m.mint;
    if (!mint) return;
    out.push({ mint, symbol: f.symbol || m.symbol || "?", ...f });
  };
  try {
    if (r.kind === "app_limit" || r.kind === "app_trailing") {
      if (m.status === "filled" && m.lastFill && m.lastFill.ok) {
        const lf = m.lastFill;
        if (m.side === "buy") {
          const usd = buyUsdFromSize(m.size, solPx);
          const px = lf.priceUsd || m.entryUsd || null;
          push({ side: "buy", usd, priceUsd: px, tokens: usd && px ? usd / px : null, at: m.filledAt || r.created_at, signature: lf.signature || null, estimated: !lf.priceUsd });
        } else {
          push({ side: "sell", usd: lf.proceedsUsd ?? null, tokens: lf.tokens ?? null, priceUsd: lf.priceUsd ?? null, at: m.filledAt || r.created_at, signature: lf.signature || null, estimated: true });
        }
      }
    } else if (r.kind === "app_ladder") {
      for (const t of m.tranches || []) {
        if (t.status === "filled") {
          push({ side: "sell", usd: t.proceedsUsd ?? null, tokens: t.tokens ?? null, priceUsd: t.priceUsd ?? null, at: t.filledAt, signature: t.signature || null, estimated: true });
        }
      }
    } else if (r.kind === "app_alert") {
      if (m.status === "triggered" && m.lastResult && m.lastResult.ok && m.action !== "notify_only") {
        const lr = m.lastResult;
        push({
          side: m.action === "buy_usd" ? "buy" : "sell",
          usd: lr.usd ?? (m.action === "buy_usd" ? m.actionValue : null) ?? null,
          tokens: lr.tokens ?? null,
          priceUsd: m.triggerPrice ?? null,
          at: m.triggeredAt, signature: lr.signature || null, estimated: true,
        });
      }
    } else if (r.kind === "app_copy" || r.kind === "app_snipe") {
      for (const f of m.fills || []) {
        if (f.ok === false) continue;
        push({ side: f.side, mint: f.mint, symbol: f.symbol, usd: f.usd ?? null, tokens: f.tokens ?? null, priceUsd: f.priceUsd ?? null, at: f.at, signature: f.signature || null, estimated: f.estimated !== false });
      }
    }
  } catch {
    /* one malformed row never breaks the report */
  }
  return out;
}

export async function appWalletPnl(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first." };

  const mintFilter = String(args.mint || args.ca || "").trim();
  if (mintFilter && !MINT_RE.test(mintFilter)) return { ok: false, error: "bad_mint" };

  const { data } = await client
    .from("ox_live_events")
    .select("id,kind,meta,created_at,mint,symbol")
    .eq("agent_id", gate.userId)
    .in("kind", FILL_KINDS)
    .order("created_at", { ascending: false })
    .limit(500);

  const solPx = await solUsd().catch(() => 0);
  const fills = [];
  for (const r of data || []) {
    if (mintFilter && String(r.mint || r.meta?.mint || "") !== mintFilter) continue;
    fills.push(...fillsFromRow(r, solPx));
  }

  // Aggregate per mint.
  const byMint = new Map();
  for (const f of fills) {
    if (!byMint.has(f.mint)) {
      byMint.set(f.mint, {
        mint: f.mint, symbol: f.symbol, buys: 0, buyUsd: 0, buyTokens: 0,
        sells: 0, sellUsd: 0, sellTokens: 0, firstBuyAt: null, fills: [],
      });
    }
    const t = byMint.get(f.mint);
    t.fills.push({ side: f.side, usd: f.usd, tokens: f.tokens, priceUsd: f.priceUsd, at: f.at, signature: f.signature, estimated: !!f.estimated });
    if (f.side === "buy") {
      t.buys += 1;
      if (f.usd != null) t.buyUsd += f.usd;
      if (f.tokens != null) t.buyTokens += f.tokens;
      if (!t.firstBuyAt || (f.at && f.at < t.firstBuyAt)) t.firstBuyAt = f.at;
    } else {
      t.sells += 1;
      if (f.usd != null) t.sellUsd += f.usd;
      if (f.tokens != null) t.sellTokens += f.tokens;
    }
  }

  // Live positions for mints with activity (cap RPC budget).
  const mints = [...byMint.keys()].slice(0, 25);
  const live = {};
  await Promise.all(mints.map(async (mint) => {
    try {
      const [bal, info] = await Promise.all([
        tokenBalance(row.public_key, mint).catch(() => 0),
        tokenInfo(mint).catch(() => null),
      ]);
      live[mint] = { balance: bal || 0, priceUsd: info?.priceUsd || 0 };
    } catch {
      live[mint] = { balance: 0, priceUsd: 0 };
    }
  }));

  const tokens = {};
  let totalBuyUsd = 0, totalSellUsd = 0, totalRealized = 0, totalUnrealized = 0;
  let wins = 0, withRealized = 0, holdSumMs = 0, holdN = 0;
  for (const [mint, t] of byMint) {
    const avgBuy = t.buyTokens > 0 ? t.buyUsd / t.buyTokens : null;
    const realized = t.sellUsd > 0 && avgBuy != null ? t.sellUsd - avgBuy * t.sellTokens : (t.sellUsd > 0 && t.sellTokens <= 0 ? null : 0);
    const realizedKnown = realized != null;
    const lv = live[mint] || { balance: 0, priceUsd: 0 };
    const positionUsd = lv.balance * lv.priceUsd;
    const unrealized = avgBuy != null && lv.priceUsd > 0 ? lv.balance * lv.priceUsd - avgBuy * lv.balance : null;
    const totalPnl = (realizedKnown ? realized : 0) + (unrealized ?? 0);
    // Avg hold: sell time minus first buy time.
    for (const f of t.fills) {
      if (f.side === "sell" && f.at && t.firstBuyAt) {
        const ms = new Date(f.at) - new Date(t.firstBuyAt);
        if (Number.isFinite(ms) && ms >= 0) { holdSumMs += ms; holdN += 1; }
      }
    }
    if (realizedKnown) { withRealized += 1; if (realized > 0) wins += 1; }
    totalBuyUsd += t.buyUsd; totalSellUsd += t.sellUsd;
    if (realizedKnown) totalRealized += realized;
    if (unrealized != null) totalUnrealized += unrealized;
    tokens[mint] = {
      symbol: t.symbol, buys: t.buys, buyUsd: round2(t.buyUsd), sells: t.sells, sellUsd: round2(t.sellUsd),
      avgBuyPrice: avgBuy != null ? avgBuy : null,
      realizedUsd: realizedKnown ? round2(realized) : null,
      balance: lv.balance, currentPrice: lv.priceUsd || null, positionUsd: round2(positionUsd),
      unrealizedUsd: unrealized != null ? round2(unrealized) : null,
      totalPnlUsd: round2(totalPnl),
    };
  }

  const ranked = Object.entries(tokens).sort((a, b) => (b[1].totalPnlUsd || 0) - (a[1].totalPnlUsd || 0));
  const best = ranked[0] ? { mint: ranked[0][0], symbol: ranked[0][1].symbol, pnlUsd: ranked[0][1].totalPnlUsd } : null;
  const worst = ranked.length ? { mint: ranked[ranked.length - 1][0], symbol: ranked[ranked.length - 1][1].symbol, pnlUsd: ranked[ranked.length - 1][1].totalPnlUsd } : null;

  // Active strategy counts.
  const active = { limits: 0, trailing: 0, ladders: 0, alerts: 0, follows: 0, sniper: 0 };
  for (const r of data || []) {
    const st = r.meta?.status;
    if (st !== "open" && st !== "active") continue;
    if (r.kind === "app_limit") active.limits += 1;
    else if (r.kind === "app_trailing") active.trailing += 1;
    else if (r.kind === "app_ladder") active.ladders += 1;
    else if (r.kind === "app_alert") active.alerts += 1;
    else if (r.kind === "app_copy") active.follows += 1;
    else if (r.kind === "app_snipe") active.sniper += 1;
  }

  return {
    ok: true,
    readOnly: true,
    fills: fills.length,
    tokens,
    totals: {
      buyUsd: round2(totalBuyUsd), sellUsd: round2(totalSellUsd),
      realizedUsd: round2(totalRealized), unrealizedUsd: round2(totalUnrealized),
      totalPnlUsd: round2(totalRealized + totalUnrealized),
    },
    winRate: withRealized ? wins / withRealized : null,
    winRateNote: withRealized ? `${wins}/${withRealized} tokens with realized PnL` : "no realized-PnL data yet",
    avgHoldHours: holdN ? round2(holdSumMs / holdN / 36e5) : null,
    best, worst,
    activeStrategies: active,
    feesUsd: null,
    feesNote: "On-chain fee aggregation not yet wired — fills exclude gas/priority fees.",
    coverageNote: "PnL uses fill records written by the strategy engine. Older limit fills contribute buy-side only (sell proceeds weren't recorded before this deploy); figures flagged estimated use arm-time or tick-time prices.",
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function dispatchPnlTools(name, args, auth) {
  if (name === "orbitx_app_pnl") return appWalletPnl(auth, args || {});
  return null;
}

const authCode = { type: "string" };

export const PNL_TOOLS = [
  {
    name: "orbitx_app_pnl",
    description: "PnL analytics (read-only): realized/unrealized per token, win rate, avg hold time, best/worst trades, active strategy counts. Optional mint filter.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, authCode } },
  },
];
