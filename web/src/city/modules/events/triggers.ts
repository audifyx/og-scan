/**
 * OrbitXCity — Events module: real-data market triggers.
 *
 * REAL DATA ONLY. Every trigger here consumes a `MarketSnapshot` whose
 * values must come from live price feeds (e.g. the existing
 * `web/src/hooks/useLivePrices.ts`, DexScreener-backed). This module
 * fabricates NO prices, NO volume figures, and NO crashes — if the
 * snapshot is stale or empty, no trigger fires.
 *
 * The integrator calls `evaluateMarketTriggers` on each price poll with
 * the real hook output. The director (eventDirector.ts) turns results
 * into `CityEvent`s.
 */

import type {
  EventPayload,
  MarketSnapshot,
  TimedEventKind,
} from "./types";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export interface MarketTriggerConfig {
  /**
   * Mint addresses watched for crash-driven earthquakes. The integrator
   * passes the real watchlist it feeds to useLivePrices.
   */
  quakeWatchlist: { mint: string; symbol: string }[];
  /**
   * A token "crashes" when its 24h change is at or below this value
   * (negative). Default: -20.
   */
  quakeCrashThresholdPct: number;
  /**
   * ORBITX milestone prices for the fireworks show. Each milestone fires
   * ONCE per session, on the first poll where price crosses ABOVE it.
   * Empty = fireworks never fire on price (host can still fire manually).
   */
  orbitxMilestones: number[];
  /** Mint address of ORBITX in the snapshot. Integrator-supplied. */
  orbitxMint: string;
  /** Per-token quake cooldown (ms). Default 30 min. */
  quakeCooldownMs: number;
}

export const DEFAULT_TRIGGER_CONFIG: MarketTriggerConfig = {
  quakeWatchlist: [],
  quakeCrashThresholdPct: -20,
  orbitxMilestones: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
  orbitxMint: "",
  quakeCooldownMs: 30 * 60 * 1000,
};

/* ------------------------------------------------------------------ */
/* Trigger memory (session state, owned by the integrator)             */
/* ------------------------------------------------------------------ */

export interface TriggerMemory {
  /** Milestones already celebrated this session. */
  celebratedMilestones: number[];
  /** Last quake fire time per mint. */
  lastQuakeAt: Record<string, number>;
}

export function createTriggerMemory(): TriggerMemory {
  return { celebratedMilestones: [], lastQuakeAt: {} };
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export interface TriggerResult {
  kind: TimedEventKind;
  payload: EventPayload;
  /** Human-readable reason for logs / QA. */
  reason: string;
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

const STALE_MS = 5 * 60 * 1000; // quotes older than 5 min are unusable

function isFresh(quote: { lastUpdated: number }, now: number): boolean {
  return now - quote.lastUpdated <= STALE_MS;
}

/**
 * Evaluate real market data and return the triggers that fire NOW.
 * Pure function — safe to call on every price poll.
 */
export function evaluateMarketTriggers(
  snapshot: MarketSnapshot,
  mem: TriggerMemory,
  config: MarketTriggerConfig = DEFAULT_TRIGGER_CONFIG,
  now: number = Date.now()
): TriggerResult[] {
  const out: TriggerResult[] = [];
  if (!snapshot || Object.keys(snapshot).length === 0) return out;

  // --- 1. Earthquakes: watched majors crashing in real life ----------
  for (const { mint, symbol } of config.quakeWatchlist) {
    const quote = snapshot[mint];
    if (!quote || !isFresh(quote, now)) continue;
    if (quote.priceChange24h <= config.quakeCrashThresholdPct) {
      const last = mem.lastQuakeAt[mint] ?? 0;
      if (now - last < config.quakeCooldownMs) continue; // cooldown
      mem.lastQuakeAt[mint] = now;
      // Magnitude 3..10 scaled from the crash depth (threshold..-80%).
      const depth = Math.min(Math.abs(quote.priceChange24h), 80);
      const magnitude = Math.min(
        10,
        3 + (depth - Math.abs(config.quakeCrashThresholdPct)) / 10
      );
      out.push({
        kind: "earthquake",
        payload: {
          tokenSymbol: symbol,
          dropPct24h: quote.priceChange24h,
          magnitude: Math.round(magnitude * 10) / 10,
        },
        reason: `${symbol} crashed ${quote.priceChange24h.toFixed(1)}% in 24h (real DexScreener data)`,
      });
    }
  }

  // --- 2. Fireworks: ORBITX crossing price milestones ----------------
  if (config.orbitxMint) {
    const quote = snapshot[config.orbitxMint];
    if (quote && isFresh(quote, now) && quote.price > 0) {
      for (const m of config.orbitxMilestones) {
        if (quote.price >= m && !mem.celebratedMilestones.includes(m)) {
          mem.celebratedMilestones.push(m);
          out.push({
            kind: "fireworks",
            payload: {
              milestoneLabel: `ORBITX $${formatMilestone(m)}`,
              price: quote.price,
            },
            reason: `ORBITX hit $${formatMilestone(m)} at $${quote.price.toFixed(4)} (real data)`,
          });
        }
      }
    }
  }

  return out;
}

/**
 * Parade trigger: community 24h trading volume goals. The volume figure
 * is integrator-supplied real data (never fabricated here); the goals are
 * config tiers. `celebrated` tracks fired tiers across polls.
 */
export interface ParadeGoalTier {
  volumeUsd: number;
  title: string;
}

export const DEFAULT_PARADE_GOALS: ParadeGoalTier[] = [
  { volumeUsd: 100_000, title: "Street Parade" },
  { volumeUsd: 500_000, title: "Boulevard Parade" },
  { volumeUsd: 1_000_000, title: "Million-Dollar Parade" },
  { volumeUsd: 5_000_000, title: "Citywide Grand Parade" },
];

export function evaluateParadeTrigger(
  communityVolume24h: number,
  goals: ParadeGoalTier[],
  celebrated: string[],
  now: number = Date.now()
): { payload: import("./types").ParadePayload; key: string } | null {
  if (!(communityVolume24h > 0)) return null; // no real data → no parade
  const hit = goals
    .filter((g) => communityVolume24h >= g.volumeUsd)
    .sort((a, b) => b.volumeUsd - a.volumeUsd)[0];
  if (!hit) return null;
  const key = `parade:${hit.volumeUsd}`;
  if (celebrated.includes(key)) return null;
  celebrated.push(key);
  return {
    key,
    payload: {
      title: hit.title,
      goalLabel: `Community hit $${formatCompact(communityVolume24h)} 24h volume`,
      route: [], // integrator fills waypoints from core road data
    },
  };
}

function formatMilestone(m: number): string {
  return m < 0.01 ? m.toFixed(4) : m < 1 ? m.toFixed(2) : m.toFixed(m % 1 ? 2 : 0);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
}
