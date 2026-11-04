/**
 * OrbitX Terminal analytics — real-data aggregates for the trade desk.
 *
 * Sources (all already exist; nothing invented, no new api/ files):
 *  - Market overview: /api/ogdex/screener via tradeApi.fetchScreener
 *    (same pipeline TradeHome uses) + /api/ogdex/signals for live signals.
 *  - Per-token analytics: computed from data the desk ALREADY loads
 *    (DexScreener pair via fetchDexPair, GeckoTerminal trade tape,
 *    traders-route holders, security/xray) — this module never fetches
 *    for a token, it only aggregates what it is handed.
 *
 * Honesty rules: every number that has no source is `null` and the UI
 * renders it as "unknown" — never 0, never a guess. 1h volume is always
 * null: no desk source reports it.
 */
import { fetchScreener, type MarketCoin } from "./tradeApi";

/* ── Market overview ─────────────────────────────────────────── */

export type Mover = {
  mint: string;
  symbol: string;
  name: string;
  image?: string;
  change24h: number;
  mcap: number;
  volume24h: number;
};

export type MarketOverview = {
  /** False when the screener returned no rows at all — UI shows "no data". */
  hasData: boolean;
  tokenCount: number;
  totalVolume24h: number;
  totalLiquidity: number;
  gainers: number;
  losers: number;
  flat: number;
  topGainers: Mover[];
  topLosers: Mover[];
  /** Pairs created in the last 24h, or null when no row reports createdAt. */
  newPairs24h: number | null;
  /** Rows in the new-pairs feed (feed size, not an age claim). */
  newPairsFeed: number;
};

function toMover(c: MarketCoin): Mover {
  return {
    mint: c.mint,
    symbol: c.symbol,
    name: c.name,
    image: c.image,
    change24h: c.change24h,
    mcap: c.mcap,
    volume24h: c.volume24h,
  };
}

/** Top `n` gainers (change24h > 0) and losers (change24h < 0). Zero-change rows are not movers. */
export function rankMovers(rows: MarketCoin[], n = 5): { gainers: Mover[]; losers: Mover[] } {
  const gainers = rows
    .filter((r) => r.change24h > 0)
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, n)
    .map(toMover);
  const losers = rows
    .filter((r) => r.change24h < 0)
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, n)
    .map(toMover);
  return { gainers, losers };
}

/**
 * Count rows created within the last `hours`. Returns null when no row
 * carries a parseable createdAt (caller must show "unknown", not 0).
 */
export function countNewPairs(
  rows: Array<{ createdAt?: string | null }>,
  hours = 24,
  now = Date.now(),
): number | null {
  let dated = 0;
  let count = 0;
  for (const r of rows) {
    if (!r?.createdAt) continue;
    const ms = new Date(r.createdAt).getTime();
    if (!Number.isFinite(ms)) continue;
    dated += 1;
    if (now - ms <= hours * 3_600_000) count += 1;
  }
  return dated === 0 ? null : count;
}

export function computeMarketOverview(
  rows: MarketCoin[],
  newPairRows: Array<{ createdAt?: string | null }>,
  now = Date.now(),
): MarketOverview {
  const { gainers, losers } = rankMovers(rows, 5);
  let totalVolume24h = 0;
  let totalLiquidity = 0;
  let g = 0;
  let l = 0;
  let f = 0;
  for (const r of rows) {
    totalVolume24h += Number.isFinite(r.volume24h) ? r.volume24h : 0;
    totalLiquidity += Number.isFinite(r.liquidity) ? r.liquidity : 0;
    if (r.change24h > 0) g += 1;
    else if (r.change24h < 0) l += 1;
    else f += 1;
  }
  return {
    hasData: rows.length > 0,
    tokenCount: rows.length,
    totalVolume24h,
    totalLiquidity,
    gainers: g,
    losers: l,
    flat: f,
    topGainers: gainers,
    topLosers: losers,
    newPairs24h: countNewPairs(newPairRows, 24, now),
    newPairsFeed: newPairRows.length,
  };
}

/* ── Live signals (/api/ogdex/signals) ───────────────────────── */

export type LiveSignal = {
  mint: string;
  symbol: string;
  name: string;
  icon?: string | null;
  type: string;
  label: string;
  strength: number;
  metric: string;
  tone: string;
  ch24h?: number | null;
  mcap?: number | null;
};

export type SignalsResult = {
  signals: LiveSignal[];
  counts: Record<string, number>;
  generatedAt: string | null;
};

export async function fetchLiveSignals(): Promise<SignalsResult | null> {
  try {
    const r = await fetch("/api/ogdex/signals");
    const d = await r.json();
    if (!d || !Array.isArray(d.signals)) return null;
    return {
      signals: d.signals
        .filter((s: any) => s?.mint && s?.label)
        .map((s: any) => ({
          mint: String(s.mint),
          symbol: String(s.symbol || "???"),
          name: String(s.name || s.symbol || ""),
          icon: s.icon ?? null,
          type: String(s.type || "signal"),
          label: String(s.label),
          strength: Number(s.strength) || 0,
          metric: String(s.metric || ""),
          tone: String(s.tone || "gold"),
          ch24h: s.ch24h != null ? Number(s.ch24h) : null,
          mcap: s.mcap != null ? Number(s.mcap) : null,
        })),
      counts: (d.counts && typeof d.counts === "object" ? d.counts : {}) as Record<string, number>,
      generatedAt: typeof d.generatedAt === "string" ? d.generatedAt : null,
    };
  } catch {
    return null;
  }
}

async function fetchRawScreener(type: string): Promise<Array<{ createdAt?: string | null }>> {
  try {
    const r = await fetch(
      `/api/ogdex/screener?type=${encodeURIComponent(type)}&interval=1h&limit=200&chain=solana`,
    );
    const d = await r.json();
    return Array.isArray(d?.rows) ? d.rows : [];
  } catch {
    return [];
  }
}

export type MarketOverviewResult = {
  overview: MarketOverview;
  signals: LiveSignal[];
  signalCounts: Record<string, number>;
  signalsAt: string | null;
  updatedAt: number;
};

/**
 * One parallel fetch for the market-overview panel. Returns null only when
 * every source came back empty — the panel then shows its "no data" state.
 * Auto-refresh cadence lives in the component (60s).
 */
export async function fetchMarketOverview(now = Date.now()): Promise<MarketOverviewResult | null> {
  const [trending, newRaw, sig] = await Promise.all([
    fetchScreener("trending", 200),
    fetchRawScreener("newpairs"),
    fetchLiveSignals(),
  ]);
  if (!trending.length && !newRaw.length && !sig) return null;
  return {
    overview: computeMarketOverview(trending, newRaw, now),
    signals: sig?.signals ?? [],
    signalCounts: sig?.counts ?? {},
    signalsAt: sig?.generatedAt ?? null,
    updatedAt: now,
  };
}

/* ── Per-token analytics (pure — desk hands it already-loaded data) ── */

export type TokenAnalyticsInput = {
  /** DexScreener pair fields the desk already holds (selectedToken). */
  volume5m?: number | null;
  volume24h?: number | null;
  buys5m?: number | null;
  sells5m?: number | null;
  buyVol5m?: number | null;
  sellVol5m?: number | null;
  /** GeckoTerminal trade tape the desk already holds (≤50 recent trades). */
  trades?: Array<{ side: string; value?: number | null; time?: number | null; wallet?: string | null }>;
  /** Traders-route holder sample the desk already holds. */
  holders?: Array<{ owner?: string | null; pct?: number | null; usdValue?: number | null }>;
  holderCount?: number | null;
  /** Security / xray concentration the desk already holds. */
  top10Pct?: number | null;
  devPct?: number | null;
};

export type LargestTrade = {
  side: "buy" | "sell";
  value: number;
  time: number | null;
  wallet: string | null;
};

export type TokenAnalytics = {
  volume5m: number | null;
  /** No desk source reports 1h volume — always null ("unknown"). */
  volume1h: null;
  volume24h: number | null;
  buys5m: number | null;
  sells5m: number | null;
  buyVol5m: number | null;
  sellVol5m: number | null;
  /** Buys as a share of 5m trades (0–1), null when no 5m trades reported. */
  buyShare5m: number | null;
  /** Tape aggregates over the loaded recent-trades window. */
  tapeCount: number;
  tapeBuys: number;
  tapeSells: number;
  tapeBuyUsd: number;
  tapeSellUsd: number;
  largestTrades: LargestTrade[];
  /** Tape trades ≥ $10k — whale-sized prints inside the loaded window. */
  largeTrades: number;
  holderCount: number | null;
  top10Pct: number | null;
  devPct: number | null;
  topHolders: Array<{ owner: string; pct: number | null; usdValue: number | null }>;
  /** Sum of the top-5 sample pcts — null when the sample has no pcts. */
  top5SharePct: number | null;
};

function num(v: unknown): number | null {
  // null / undefined / "" mean "unknown" — never coerce to 0 (Number(null) is 0).
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function computeTokenAnalytics(input: TokenAnalyticsInput): TokenAnalytics {
  const volume5m = num(input.volume5m);
  const volume24h = num(input.volume24h);
  const buys5m = num(input.buys5m);
  const sells5m = num(input.sells5m);
  const buyVol5m = num(input.buyVol5m);
  const sellVol5m = num(input.sellVol5m);
  const buyShare5m =
    buys5m != null && sells5m != null && buys5m + sells5m > 0
      ? buys5m / (buys5m + sells5m)
      : null;

  const tape = Array.isArray(input.trades) ? input.trades : [];
  let tapeBuys = 0;
  let tapeSells = 0;
  let tapeBuyUsd = 0;
  let tapeSellUsd = 0;
  let largeTrades = 0;
  const sized: LargestTrade[] = [];
  for (const t of tape) {
    const side = String(t?.side || "").toLowerCase() === "sell" ? "sell" : "buy";
    const value = num(t?.value) ?? 0;
    if (side === "buy") {
      tapeBuys += 1;
      tapeBuyUsd += value;
    } else {
      tapeSells += 1;
      tapeSellUsd += value;
    }
    if (value >= 10_000) largeTrades += 1;
    if (value > 0) {
      sized.push({
        side,
        value,
        time: num(t?.time),
        wallet: t?.wallet != null ? String(t.wallet) : null,
      });
    }
  }
  sized.sort((a, b) => b.value - a.value);

  const holders = (Array.isArray(input.holders) ? input.holders : [])
    .filter((h) => h?.owner)
    .map((h) => ({ owner: String(h.owner), pct: num(h.pct), usdValue: num(h.usdValue) }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  const topHolders = holders.slice(0, 5);
  const top5SharePct =
    topHolders.length > 0 && topHolders.every((h) => h.pct != null)
      ? topHolders.reduce((s, h) => s + (h.pct ?? 0), 0)
      : null;

  return {
    volume5m,
    volume1h: null,
    volume24h,
    buys5m,
    sells5m,
    buyVol5m,
    sellVol5m,
    buyShare5m,
    tapeCount: tape.length,
    tapeBuys,
    tapeSells,
    tapeBuyUsd,
    tapeSellUsd,
    largestTrades: sized.slice(0, 3),
    largeTrades,
    holderCount: num(input.holderCount),
    top10Pct: num(input.top10Pct),
    devPct: num(input.devPct),
    topHolders,
    top5SharePct,
  };
}
