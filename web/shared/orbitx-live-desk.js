/**
 * OrbitX live agent desk — real SOL, real Jupiter fills.
 * Deposit address is public. The signing secret lives only in
 * LIVE_AGENT_WALLET_SECRET on Vercel. Never commit a key.
 *
 * Not financial advice. Caps: $1.50 per buy, 1 open book, full take-profit.
 */
export const LIVE_WALLET_PUBKEY = "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj";
export const LIVE_TRADE_USD = 1.5;
export const LIVE_FEE_RESERVE_SOL = 0.004;
export const LIVE_MAX_OPEN = 1;
export const LIVE_STOP_PCT = -0.2;
export const LIVE_MIN_LIQ_USD = 25_000;
export const LIVE_MIN_VOL_USD = 40_000;
export const LIVE_MIN_MCAP_USD = 80_000;
export const LIVE_MAX_MCAP_USD = 80_000_000;
export const LIVE_MAX_ROUND_TRIP_PCT = 12;
export const LIVE_MAX_BUY_IMPACT_PCT = 4;
export const LIVE_MIN_AGE_MIN = 45;
export const SOL_MINT = "So11111111111111111111111111111111111111112";

export const LIVE_AGENTS = [
  {
    id: "neon-live",
    name: "NEON LIVE",
    style: "momentum",
    tpPct: 0.12,
    color: "#34d399",
    blurb: "Buys 1h continuation on sellable Jupiter books. Full sell at +12%.",
  },
  {
    id: "warden-live",
    name: "WARDEN LIVE",
    style: "mean_reversion",
    tpPct: 0.1,
    color: "#fb7185",
    blurb: "Fades stretched 24h prints. Takes +10% and walks.",
  },
  {
    id: "raid-live",
    name: "RAID LIVE",
    style: "fresh",
    tpPct: 0.3,
    color: "#fbbf24",
    blurb: "Hunts younger listed pairs with real depth. Full sell at +30%.",
  },
];

export const LIVE_DISCLAIMER =
  "Not financial advice. These books spend real SOL from a hot wallet. Max $1.50 per buy, one open book at a time, full take-profit at 10–30%, skip anything that cannot sell. You can lose the whole bank.";

export function liveAgentById(id) {
  const needle = String(id || "").trim().toLowerCase();
  return LIVE_AGENTS.find((a) => a.id === needle || a.name.toLowerCase() === needle) || null;
}

export function nextLiveAgent(lastId) {
  if (!LIVE_AGENTS.length) return null;
  const i = LIVE_AGENTS.findIndex((a) => a.id === lastId);
  return LIVE_AGENTS[(i + 1) % LIVE_AGENTS.length];
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function solForTradeUsd(usd, solUsd) {
  const price = num(solUsd);
  if (price <= 0) return 0;
  return num(usd) / price;
}

export function sizeLiveBuy({ solBalance, solUsd, openCount, tradeUsd = LIVE_TRADE_USD } = {}) {
  const open = num(openCount);
  if (open >= LIVE_MAX_OPEN) return { ok: false, skip: "max_open", openCount: open };
  const sol = solForTradeUsd(tradeUsd, solUsd);
  if (!(sol > 0)) return { ok: false, skip: "no_sol_price", sol: 0, usd: tradeUsd };
  const bal = num(solBalance);
  if (bal - sol < LIVE_FEE_RESERVE_SOL) {
    return { ok: false, skip: "fee_reserve", sol, usd: tradeUsd, balance: bal };
  }
  return { ok: true, sol, usd: tradeUsd, lamports: Math.floor(sol * 1e9) };
}

export function screenLiveCandidate(coin = {}, safety = {}) {
  const reasons = [];
  const liq = num(coin.liquidity_usd);
  const vol = num(coin.volume_24h);
  const mcap = num(coin.market_cap);
  const ageMin = coin.pair_age_min == null ? null : num(coin.pair_age_min);
  const mint = String(coin.mint || "");

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) reasons.push("bad mint");
  if (mint === SOL_MINT) reasons.push("sol mint");
  if (liq < LIVE_MIN_LIQ_USD) reasons.push(`liq $${Math.round(liq)} < $${LIVE_MIN_LIQ_USD}`);
  if (vol < LIVE_MIN_VOL_USD) reasons.push(`vol $${Math.round(vol)} < $${LIVE_MIN_VOL_USD}`);
  if (mcap > 0 && mcap < LIVE_MIN_MCAP_USD) reasons.push("mcap too small");
  if (mcap > LIVE_MAX_MCAP_USD) reasons.push("mcap too large");
  if (ageMin != null && ageMin < LIVE_MIN_AGE_MIN) reasons.push(`pair only ${Math.round(ageMin)}m old`);
  if (safety.canBuy === false) reasons.push("no buy route");
  if (safety.canSell === false) reasons.push("cannot sell — skip as rug/honeypot");
  if (safety.roundTripLossPct != null && num(safety.roundTripLossPct) >= LIVE_MAX_ROUND_TRIP_PCT) {
    reasons.push(`round-trip ${num(safety.roundTripLossPct).toFixed(0)}%`);
  }
  if (safety.buyImpactPct != null && num(safety.buyImpactPct) >= LIVE_MAX_BUY_IMPACT_PCT) {
    reasons.push(`buy impact ${num(safety.buyImpactPct).toFixed(1)}%`);
  }
  if (safety.mintAuthorityActive === true) reasons.push("mint authority live");
  if (safety.freezeAuthorityActive === true) reasons.push("freeze authority live");
  if (coin.honeypot === true || safety.honeypot === true) reasons.push("honeypot flag");
  if (safety.bondingOnly === true) reasons.push("bonding-curve only — wait for a DEX sell route");

  return {
    ok: reasons.length === 0,
    reasons,
    score: scoreLiveCandidate(coin, safety),
    mint,
    symbol: String(coin.symbol || mint.slice(0, 4)).toUpperCase(),
  };
}

export function scoreLiveCandidate(coin = {}, safety = {}) {
  let s = 0;
  const liq = num(coin.liquidity_usd);
  const vol = num(coin.volume_24h);
  const ch1 = num(coin.change_1h);
  const ch24 = num(coin.change_24h);
  if (liq >= 80_000) s += 10;
  if (liq >= 250_000) s += 8;
  if (vol >= 100_000) s += 10;
  if (vol >= 400_000) s += 8;
  if (safety.canSell) s += 20;
  if (safety.roundTripLossPct != null && num(safety.roundTripLossPct) < 6) s += 8;
  if (Math.abs(ch1) >= 4 && Math.abs(ch1) <= 25) s += 6;
  if (ch24 <= -40) s -= 12;
  if (ch1 >= 80) s -= 10;
  return s;
}

export function rankForLiveStyle(style, coins) {
  const list = (coins || []).filter((c) => c?.mint && c.mint !== SOL_MINT);
  const copy = list.slice();
  if (style === "momentum") copy.sort((a, b) => num(b.change_1h) - num(a.change_1h) || num(b.volume_24h) - num(a.volume_24h));
  else if (style === "mean_reversion") copy.sort((a, b) => num(a.change_24h) - num(b.change_24h) || num(b.liquidity_usd) - num(a.liquidity_usd));
  else if (style === "fresh") {
    copy.sort(
      (a, b) =>
        (num(a.pair_age_min, 9e9) - num(b.pair_age_min, 9e9)) ||
        num(b.volume_24h) - num(a.volume_24h),
    );
  } else copy.sort((a, b) => num(b.volume_24h) - num(a.volume_24h));
  return copy;
}

export function pickLiveToken(agent, ranked) {
  const list = ranked || [];
  if (!list.length) return null;
  if (agent?.style === "momentum") return list.find((t) => num(t.change_1h) >= 4) || list[0];
  if (agent?.style === "mean_reversion") return list.find((t) => num(t.change_24h) <= -8) || list[0];
  if (agent?.style === "fresh") return list.find((t) => num(t.pair_age_min, 999) >= LIVE_MIN_AGE_MIN) || list[0];
  return list[0];
}

export function decideLiveExit(position = {}, markUsd) {
  const entry = num(position.entry_price_usd);
  const mark = num(markUsd);
  const tp = num(position.tp_pct, 0.1);
  if (!(entry > 0) || !(mark > 0)) return { action: "hold", pnlPct: 0, reason: "no_mark" };
  const pnlPct = (mark - entry) / entry;
  if (pnlPct >= tp) return { action: "take_profit", pnlPct, reason: `+${(pnlPct * 100).toFixed(1)}% hit +${(tp * 100).toFixed(0)}% TP — sell 100%` };
  if (pnlPct <= LIVE_STOP_PCT) return { action: "stop", pnlPct, reason: `${(pnlPct * 100).toFixed(1)}% hit ${LIVE_STOP_PCT * 100}% stop — sell 100%` };
  return { action: "hold", pnlPct, reason: "hold" };
}

export function summarizeLiveLedger({
  fills = [],
  open = [],
  agents = LIVE_AGENTS,
  startingUsd = null,
  startingSol = null,
  solBalance = null,
  usdBalance = null,
  equityUsd = null,
  realizedPnlUsd = 0,
} = {}) {
  const sells = fills.filter((f) => String(f.side || "") === "sell");
  const buys = fills.filter((f) => String(f.side || "") === "buy");
  const winRows = sells.filter((f) => num(f.pnl_usd) > 0);
  const lossRows = sells.filter((f) => num(f.pnl_usd) <= 0);
  const realized = sells.reduce((s, f) => s + num(f.pnl_usd), 0) || num(realizedPnlUsd);
  const holding = open[0] || null;
  const unrealized = open.reduce((s, p) => {
    if (p.pnl_pct == null) return s;
    return s + (num(p.usd_in) * num(p.pnl_pct)) / 100;
  }, 0);
  const startUsd = startingUsd != null ? num(startingUsd) : null;
  const nowUsd = equityUsd != null ? num(equityUsd) : usdBalance != null ? num(usdBalance) + unrealized : null;
  const madeUsd = startUsd != null && nowUsd != null ? nowUsd - startUsd : realized + unrealized;
  const books = (agents || LIVE_AGENTS).map((a) => {
    const mine = fills.filter((f) => f.agent_id === a.id);
    const mySells = mine.filter((f) => String(f.side || "") === "sell");
    const wins = mySells.filter((f) => num(f.pnl_usd) > 0).length;
    const losses = mySells.filter((f) => num(f.pnl_usd) <= 0).length;
    const hold = open.find((p) => p.agent_id === a.id) || null;
    const realizedA = mySells.reduce((s, f) => s + num(f.pnl_usd), 0);
    const unrealizedA = hold?.pnl_pct != null ? (num(hold.usd_in) * num(hold.pnl_pct)) / 100 : 0;
    const deployed = mine.filter((f) => String(f.side || "") === "buy").reduce((s, f) => s + num(f.usd_amount ?? f.usd_in), 0);
    return {
      ...a,
      open: hold,
      holding: hold,
      currently_hold: hold ? `$${String(hold.symbol || "").replace(/^\$/, "")}` : "cash",
      wins,
      losses,
      trades: mySells.length,
      win_pct: mySells.length ? (wins / mySells.length) * 100 : 0,
      realized_pnl_usd: realizedA,
      unrealized_pnl_usd: unrealizedA,
      made_usd: realizedA + unrealizedA,
      deployed_usd: deployed,
      buys: mine.filter((f) => String(f.side || "") === "buy").length,
      last: mine[0] || null,
    };
  });
  return {
    started_usd: startUsd,
    started_sol: startingSol != null ? num(startingSol) : null,
    currently_usd: nowUsd,
    currently_sol: solBalance != null ? num(solBalance) : null,
    cash_usd: usdBalance != null ? num(usdBalance) : null,
    made_usd: madeUsd,
    made_pct: startUsd > 0 && madeUsd != null ? (madeUsd / startUsd) * 100 : null,
    wins: winRows.length,
    losses: lossRows.length,
    trades: sells.length,
    buys: buys.length,
    win_pct: sells.length ? (winRows.length / sells.length) * 100 : 0,
    realized_pnl_usd: realized,
    unrealized_pnl_usd: unrealized,
    holding,
    trade_usd: LIVE_TRADE_USD,
    max_open: LIVE_MAX_OPEN,
    books,
  };
}

export function writeLiveThesis(agent, coin = {}, safety = {}, size = {}) {
  const t = String(coin.symbol || "TOKEN").replace(/^\$/, "").toUpperCase();
  const ch1 = coin.change_1h != null ? `${num(coin.change_1h) >= 0 ? "+" : ""}${num(coin.change_1h).toFixed(1)}% 1h` : "no 1h";
  const ch24 = coin.change_24h != null ? `${num(coin.change_24h) >= 0 ? "+" : ""}${num(coin.change_24h).toFixed(1)}% 24h` : "no 24h";
  const liq = coin.liquidity_usd != null ? `$${Math.round(num(coin.liquidity_usd)).toLocaleString()} liq` : "liq n/a";
  const vol = coin.volume_24h != null ? `$${Math.round(num(coin.volume_24h)).toLocaleString()} vol` : "vol n/a";
  const why =
    agent?.style === "momentum"
      ? "1h continuation with a confirmed Jupiter sell route"
      : agent?.style === "mean_reversion"
        ? "24h extension looks stretched; fade with a tight +10% full take"
        : "listed pair with real depth; ride toward +30% then flatten";
  const rt = safety.roundTripLossPct != null ? ` Round-trip ~${num(safety.roundTripLossPct).toFixed(1)}%.` : "";
  const pump = coin.pump_complete === true ? " Pump.fun complete / DEX book." : coin.pump_complete === false ? " Still watching pump.fun tape; buy only because Jupiter can sell." : "";
  const usd = size.usd != null ? `$${num(size.usd).toFixed(2)}` : `$${LIVE_TRADE_USD.toFixed(2)}`;
  const tp = `${Math.round(num(agent?.tpPct, 0.1) * 100)}%`;
  return `${agent?.name || "LIVE"} is buying ${usd} of $${t} (${ch1}, ${ch24}, ${liq}, ${vol}). Thesis: ${why}.${rt}${pump} Plan: sell 100% at +${tp}. Not financial advice.`;
}

export function emptyLiveDesk(extra = {}) {
  return {
    ok: true,
    live: true,
    mock: false,
    disclaimer: LIVE_DISCLAIMER,
    wallet: extra.wallet || LIVE_WALLET_PUBKEY,
    enabled: Boolean(extra.enabled),
    armed: Boolean(extra.armed),
    paused: Boolean(extra.paused),
    configured: Boolean(extra.configured),
    trade_usd: LIVE_TRADE_USD,
    max_open: LIVE_MAX_OPEN,
    fee_reserve_sol: LIVE_FEE_RESERVE_SOL,
    sol_usd: extra.sol_usd ?? null,
    sol_balance: extra.sol_balance ?? null,
    usd_balance: extra.usd_balance ?? null,
    equity_usd: extra.equity_usd ?? null,
    realized_pnl_usd: extra.realized_pnl_usd ?? 0,
    starting_usd: extra.starting_usd ?? null,
    starting_sol: extra.starting_sol ?? null,
    ledger: extra.ledger || null,
    open: extra.open || [],
    fills: extra.fills || [],
    agents: extra.agents || LIVE_AGENTS.map((a) => ({ ...a, open: null, last: null, wins: 0, losses: 0 })),
    last_tick_at: extra.last_tick_at || null,
    last_error: extra.last_error || null,
    skipped: extra.skipped || null,
    events: extra.events || [],
    chain: extra.chain || [],
    feed: extra.feed || [],
    worldUrl: "https://www.orbitx.world/on-chain",
    fundUrl: `https://solscan.io/account/${extra.wallet || LIVE_WALLET_PUBKEY}`,
  };
}

export function mergeLiveFeed({ fills = [], events = [], chain = [] } = {}) {
  const rows = [];
  for (const f of fills) {
    const side = String(f.side || "buy");
    rows.push({
      id: f.id || `fill-${f.signature || f.created_at}`,
      at: f.created_at,
      kind: side === "sell" ? "sell" : "buy",
      agent_id: f.agent_id || null,
      mint: f.mint || null,
      symbol: f.symbol || null,
      usd: f.usd_amount != null ? num(f.usd_amount) : null,
      pnl_usd: f.pnl_usd != null ? num(f.pnl_usd) : null,
      thesis: f.thesis || null,
      reason: f.reason || side,
      signature: f.signature || null,
      source: "fill",
    });
  }
  for (const e of events) {
    rows.push({
      id: e.id || `evt-${e.created_at}-${e.kind}`,
      at: e.created_at || e.at,
      kind: e.kind || "tick",
      agent_id: e.agent_id || null,
      mint: e.mint || null,
      symbol: e.symbol || null,
      usd: e.usd_amount != null ? num(e.usd_amount) : e.usd != null ? num(e.usd) : null,
      pnl_usd: e.pnl_usd != null ? num(e.pnl_usd) : null,
      thesis: e.thesis || null,
      reason: e.reason || null,
      signature: e.signature || null,
      source: "desk",
    });
  }
  for (const c of chain) {
    rows.push({
      id: c.signature || `chain-${c.slot}`,
      at: c.blockTime ? new Date(num(c.blockTime) * 1000).toISOString() : c.at || null,
      kind: c.err ? "fail" : "swap",
      agent_id: null,
      mint: null,
      symbol: null,
      usd: null,
      pnl_usd: null,
      thesis: null,
      reason: c.err ? "tx_err" : "on-chain swap",
      signature: c.signature || null,
      source: "chain",
    });
  }
  const seen = new Set();
  const out = [];
  for (const row of rows.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))) {
    const key = `${row.source}:${row.kind}:${row.signature || row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, 80);
}
