/**
 * Pulse feed data + pure logic for the Trade Terminal.
 *
 * Cloned from the ogdex Pulse feed (web/ogdex/src/pages/Pulse.tsx, read-only)
 * and the KOL/whale pattern in web/ogdex/src/components/KolWhaleActivity.tsx.
 *
 * Data sources (all live, same-origin — no invented data):
 *  - Signals: GET /api/ogdex/signals (web/api/ogdex.js ROUTES `signals`
 *    → ./ogdex/_routes/_signals.js). Computed live from GeckoTerminal
 *    5m/1h/24h volume + tx buys/sells and pump.fun bonding curves.
 *    Response: { ok, count, counts: Record<type, number>, signals: PulseSignal[] }
 *  - KOL / whale trades: GET /api/ogdex/kols?feed=1[&token=<mint>]&limit=50
 *    (web/api/ogdex.js ROUTES `kols` → ./ogdex/_routes/_kols.js `feed()`).
 *    Rows come from the `ogdex_kol_feed` table (tracked KOL wallets only).
 *    Response: { ok, count, feed: KolFeedRow[] }
 *
 * This module holds the fetchers plus the pure helpers the component and the
 * tests share. Nothing here invents a signal, a whale trade, or a sentiment
 * number — empty feeds surface as empty arrays and the UI shows an honest
 * empty state.
 */

export type SignalTone = "lime" | "cyan" | "violet" | "gold" | "red";

export type SignalIconKey =
  | "rocket"
  | "badge"
  | "waves"
  | "users"
  | "trending"
  | "gauge"
  | "sparkles"
  | "alert"
  | "zap";

export interface PulseSignal {
  mint: string;
  symbol?: string;
  name?: string;
  icon?: string | null;
  chain?: string;
  type: string;
  label: string;
  tone: string;
  strength?: number;
  metric?: string;
  priceUsd?: number | null;
  mcap?: number | null;
  liq?: number | null;
  vol1h?: number | null;
  ch5m?: number;
  ch1h?: number;
  ch24h?: number | null;
  ageH?: number | null;
  bondingPct?: number;
  pool?: string;
}

export interface KolFeedRow {
  id?: string | number;
  side?: string;
  kolId?: string | null;
  kolAddress?: string | null;
  name?: string | null;
  twitter?: string | null;
  tags?: string[];
  avatar?: string | null;
  kolStatus?: string | null;
  mint?: string | null;
  symbol?: string | null;
  tokenName?: string | null;
  tokenIcon?: string | null;
  tokenAmount?: number | null;
  solAmount?: number | null;
  priceUsd?: number | null;
  usdValue?: number | null;
  time?: number | null;
  txHash?: string | null;
}

/** Signal types the /api/ogdex/signals route can emit (see _signals.js). */
export const SIGNAL_TYPES = [
  "graduating",
  "graduated",
  "volume_surge",
  "buyer_surge",
  "momentum",
  "velocity_spike",
  "fresh_runner",
  "selloff",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

const TYPE_META: Record<string, { label: string; icon: SignalIconKey }> = {
  graduating: { label: "Graduating", icon: "rocket" },
  graduated: { label: "Graduated", icon: "badge" },
  volume_surge: { label: "Volume Surge", icon: "waves" },
  buyer_surge: { label: "Buyer Surge", icon: "users" },
  momentum: { label: "Momentum", icon: "trending" },
  velocity_spike: { label: "Velocity", icon: "gauge" },
  fresh_runner: { label: "Fresh", icon: "sparkles" },
  selloff: { label: "Sell-Off", icon: "alert" },
};

/** Label + icon key for a signal type. Unknown types fall back to the raw label. */
export function typeMetaFor(type: string, label?: string): { label: string; icon: SignalIconKey } {
  return TYPE_META[type] || { label: label || type || "Signal", icon: "zap" };
}

/** Normalize a tone string from the API. Unknown tones fall back to "lime" (ogdex default). */
export function toneFor(tone?: string | null): SignalTone {
  if (tone === "lime" || tone === "cyan" || tone === "violet" || tone === "gold" || tone === "red") {
    return tone;
  }
  return "lime";
}

/** Bullish signal types — same set ogdex Pulse uses for its mood meter. */
export const BULL_TYPES = new Set(["momentum", "volume_surge", "buyer_surge", "fresh_runner", "graduating"]);

export function isBullishType(type: string): boolean {
  return BULL_TYPES.has(type);
}

/** Mood from the live signal set only — never a guessed sentiment number. */
export function moodOf(signals: PulseSignal[]): { bull: number; bear: number; pct: number } {
  const bull = signals.filter((s) => BULL_TYPES.has(s.type)).length;
  const bear = signals.filter((s) => s.type === "selloff").length;
  const total = bull + bear || 1;
  return { bull, bear, pct: Math.round((bull / total) * 100) };
}

/** Per-type counts, derived from the returned signals (fallback when `counts` is absent). */
export function signalCounts(signals: PulseSignal[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of signals) counts[s.type] = (counts[s.type] || 0) + 1;
  return counts;
}

export function filterSignals(signals: PulseSignal[], filter: string): PulseSignal[] {
  if (!filter || filter === "all") return signals;
  return signals.filter((s) => s.type === filter);
}

export type PulseSort = "strength" | "mcap" | "change";

export function sortSignals(signals: PulseSignal[], sort: PulseSort): PulseSignal[] {
  const arr = [...signals];
  arr.sort((a, b) => {
    if (sort === "strength") return (b.strength ?? 0) - (a.strength ?? 0);
    if (sort === "mcap") return (b.mcap ?? 0) - (a.mcap ?? 0);
    return (b.ch24h ?? -999) - (a.ch24h ?? -999);
  });
  return arr;
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  return await r.json().catch(() => ({} as any));
}

/**
 * Fetch the live signal set. Retries up to 3 times (900ms backoff, same as
 * ogdex Pulse) and returns an empty list — never fake signals — on failure.
 */
export async function fetchSignals(): Promise<{ signals: PulseSignal[]; counts: Record<string, number> }> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const d = await getJson("/api/ogdex/signals");
      const sig: PulseSignal[] = Array.isArray(d?.signals) ? d.signals : [];
      if (sig.length || attempt >= 2) {
        return { signals: sig, counts: d?.counts && typeof d.counts === "object" ? d.counts : signalCounts(sig) };
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((res) => setTimeout(res, 900 * (attempt + 1)));
  }
  void lastErr;
  return { signals: [], counts: {} };
}

/**
 * Fetch tracked KOL / whale trades. With `token`, rows are for that mint only
 * (server-side filter); without it, the latest tracked trades across all
 * tokens. Returns [] on any failure — the UI shows the honest empty state.
 */
export async function fetchKolFeed(opts?: { token?: string; limit?: number }): Promise<KolFeedRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const q = new URLSearchParams({ feed: "1", limit: String(limit) });
  if (opts?.token) q.set("token", opts.token);
  try {
    const d = await getJson(`/api/ogdex/kols?${q.toString()}`);
    return Array.isArray(d?.feed) ? (d.feed as KolFeedRow[]) : [];
  } catch {
    return [];
  }
}

/**
 * Merge KOL feed rows the way KolWhaleActivity does: dedupe by txHash
 * (fallback owner+time+side), newest first.
 */
export function mergeKolRows(...lists: Array<KolFeedRow[] | null | undefined>): KolFeedRow[] {
  const seen = new Set<string>();
  const merged: KolFeedRow[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const r of list) {
      if (!r || typeof r !== "object") continue;
      const key =
        (r.txHash && String(r.txHash)) ||
        `${r.kolAddress || r.name || ""}|${r.time || ""}|${r.side || ""}|${r.mint || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }
  merged.sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));
  return merged;
}

/**
 * Buy/sell pressure from real KOL feed rows for one token. All counts are
 * from the returned rows only — no pressure is shown when there are no rows.
 */
export function buySellPressure(rows: KolFeedRow[]): {
  buys: number;
  sells: number;
  buyUsd: number;
  sellUsd: number;
  total: number;
} {
  let buys = 0;
  let sells = 0;
  let buyUsd = 0;
  let sellUsd = 0;
  for (const r of rows) {
    const usd = Number(r.usdValue) || 0;
    if (r.side === "buy") {
      buys += 1;
      buyUsd += usd;
    } else if (r.side === "sell") {
      sells += 1;
      sellUsd += usd;
    }
  }
  return { buys, sells, buyUsd, sellUsd, total: buys + sells };
}
