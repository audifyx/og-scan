import type { ChainEvent } from "./api";

export type ActivityTotals = {
  total: number;
  buys: number;
  sells: number;
  swaps: number;
  transfers: number;
  burns: number;
  launches: number;
  liquidity: number;
  kol: number;
  whale: number;
  orbitx: number;
};

const EMPTY: ActivityTotals = {
  total: 0,
  buys: 0,
  sells: 0,
  swaps: 0,
  transfers: 0,
  burns: 0,
  launches: 0,
  liquidity: 0,
  kol: 0,
  whale: 0,
  orbitx: 0,
};

function kindOf(event: ChainEvent): keyof Omit<ActivityTotals, "total" | "kol" | "whale" | "orbitx"> | "other" {
  const t = String(event.event_type || "").toUpperCase();
  if (t.includes("BURN")) return "burns";
  if (t.includes("LAUNCH")) return "launches";
  if (t.includes("LIQUIDITY")) return "liquidity";
  if (t.includes("BUY")) return "buys";
  if (t.includes("SELL")) return "sells";
  if (t.includes("SWAP")) return "swaps";
  if (t.includes("TRANSFER") || t.includes("SOL")) return "transfers";
  return "other";
}

export function tallyActivity(events: ChainEvent[] | null | undefined): ActivityTotals {
  const out: ActivityTotals = { ...EMPTY };
  for (const event of events || []) {
    if (!event) continue;
    out.total += 1;
    const bucket = kindOf(event);
    if (bucket !== "other") out[bucket] += 1;
    if (event.kol_related) out.kol += 1;
    if (event.whale_related) out.whale += 1;
    if (event.orbitx_related) out.orbitx += 1;
  }
  return out;
}

export function tokenActivity(events: ChainEvent[] | null | undefined, mint: string | null | undefined): ActivityTotals {
  if (!mint) return { ...EMPTY };
  return tallyActivity((events || []).filter((e) => e.token_ca === mint));
}

export function buySellRatio(activity: ActivityTotals): string | null {
  const den = activity.buys + activity.sells;
  if (!den) return null;
  return `${Math.round((activity.buys / den) * 100)} / ${Math.round((activity.sells / den) * 100)}`;
}

export function inTimeWindow(
  events: ChainEvent[] | null | undefined,
  windowMs: number,
  now = Date.now(),
): ChainEvent[] {
  return (events || []).filter((event) => {
    const t = Date.parse(event.block_time || "");
    return Number.isFinite(t) && now - t <= windowMs;
  });
}

export function windowedTokenActivity(
  events: ChainEvent[] | null | undefined,
  mint: string | null | undefined,
  windowMs: number,
  now = Date.now(),
): ActivityTotals {
  return tokenActivity(inTimeWindow(events, windowMs, now), mint);
}

export function recentLargeEvents(
  events: ChainEvent[] | null | undefined,
  mint?: string | null,
  limit = 8,
): ChainEvent[] {
  const rows = (events || []).filter((event) => {
    if (mint && event.token_ca !== mint) return false;
    if (event.whale_related) return true;
    if (event.usd_value != null && event.usd_value >= 1_000) return true;
    if (event.sol_amount != null && event.sol_amount >= 10) return true;
    return false;
  });
  return rows
    .slice()
    .sort((a, b) => (b.usd_value || b.sol_amount || 0) - (a.usd_value || a.sol_amount || 0))
    .slice(0, limit);
}

export function kolEventsFor(
  events: ChainEvent[] | null | undefined,
  mint?: string | null,
  limit = 8,
): ChainEvent[] {
  return (events || [])
    .filter((event) => event.kol_related && (!mint || event.token_ca === mint))
    .slice(0, limit);
}
