/**
 * OrbitXCity — Seasons module: seasonal event framework.
 *
 * A tiny plugin registry other modules plug themed content into. Plugins
 * never touch the DOM or the scene directly — they implement the hooks on
 * `SeasonalEventPlugin` (see `../types.ts`) and the framework calls them.
 *
 * Self-contained: no imports from other city modules, no tokenomics.
 */

import type {
  RewardTrack,
  Season,
  SeasonalEventContext,
  SeasonalEventPayload,
  SeasonalEventPlugin,
  SeasonalEventType,
  SeasonProgress,
} from "./types";
import { getSeasonInfo } from "./data/seasons";

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const plugins = new Map<string, SeasonalEventPlugin>();
let tickerId: ReturnType<typeof setInterval> | null = null;
let contextFactory: (() => SeasonalEventContext) | null = null;

/** Register a plugin (idempotent per id — re-register replaces). */
export function registerSeasonalPlugin(plugin: SeasonalEventPlugin): void {
  plugins.set(plugin.id, plugin);
}

/** Unregister a plugin by id. */
export function unregisterSeasonalPlugin(id: string): void {
  plugins.delete(id);
}

/** All registered plugins (in registration order). */
export function listSeasonalPlugins(): SeasonalEventPlugin[] {
  return [...plugins.values()];
}

/**
 * The store (or any host) installs a context factory so dispatched events
 * carry live season state. Called once by `seasonStore` at module init.
 */
export function setEventContextFactory(factory: () => SeasonalEventContext): void {
  contextFactory = factory;
}

function ctxOrNull(): SeasonalEventContext | null {
  if (!contextFactory) return null;
  try {
    return contextFactory();
  } catch {
    return null;
  }
}

/** Live context for UI (e.g. EventBoard cards). Null until the store init ran. */
export function getSeasonalContext(): SeasonalEventContext | null {
  return ctxOrNull();
}

/** Combined XP multiplier = product of every plugin's `xpMultiplier`. */
export function currentXpMultiplier(): number {
  const ctx = ctxOrNull();
  if (!ctx) return 1;
  let mult = 1;
  for (const p of plugins.values()) {
    if (p.xpMultiplier) {
      try {
        const m = p.xpMultiplier(ctx);
        if (Number.isFinite(m) && m > 0) mult *= m;
      } catch {
        /* a bad plugin must never break XP grants */
      }
    }
  }
  return mult;
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

function forEachPlugin(fn: (p: SeasonalEventPlugin, ctx: SeasonalEventContext) => void): void {
  const ctx = ctxOrNull();
  if (!ctx) return;
  for (const p of plugins.values()) {
    try {
      fn(p, ctx);
    } catch {
      /* a bad plugin must never break the game loop */
    }
  }
}

/** Dispatch an event to every registered plugin. */
export function dispatchSeasonalEvent(
  type: SeasonalEventType,
  data?: Record<string, unknown>,
): SeasonalEventPayload {
  const payload: SeasonalEventPayload = { type, at: Date.now(), data };
  forEachPlugin((p, ctx) => {
    if (type === "season:start") p.onSeasonStart?.(ctx);
    else if (type === "season:end") p.onSeasonEnd?.(ctx);
    else if (type === "tick") p.onTick?.(ctx, payload.at);
    else if (type === "tier:up")
      p.onTierUp?.(ctx, Number(data?.tier ?? 0), (data?.track as RewardTrack) ?? "free");
    else if (type === "xp:gain")
      p.onXpGain?.(ctx, Number(data?.amount ?? 0), String(data?.source ?? "unknown"));
    else if (type === "reward:claim")
      p.onRewardClaim?.(ctx, Number(data?.tier ?? 0), (data?.track as RewardTrack) ?? "free");
    else if (type.startsWith("custom:")) p.onCustom?.(ctx, type.slice("custom:".length), data);
  });
  return payload;
}

/** Broadcast a custom event (shorthand for `dispatchSeasonalEvent("custom:<name>")`). */
export function emitSeasonalCustom(name: string, data?: Record<string, unknown>): void {
  dispatchSeasonalEvent(`custom:${name}`, data);
}

/* ------------------------------------------------------------------ */
/* Ticker — drives `onTick` / `tick` ~1/sec while mounted               */
/* ------------------------------------------------------------------ */

export function startSeasonalTicker(): void {
  if (tickerId) return;
  tickerId = setInterval(() => dispatchSeasonalEvent("tick"), 1000);
}

export function stopSeasonalTicker(): void {
  if (tickerId) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

/* ------------------------------------------------------------------ */
/* Season lifecycle watcher                                            */
/* ------------------------------------------------------------------ */

/**
 * Compare the previous active-season id against now's; dispatch
 * `season:start` / `season:end` on transitions. Call on store init and
 * whenever the host wants (cheap).
 */
let lastActiveSeasonId: string | null = null;

export function checkSeasonTransitions(now: number = Date.now()): void {
  const info = getSeasonInfo(now);
  const activeId = info.status === "active" ? info.season.id : null;
  if (activeId !== lastActiveSeasonId) {
    if (lastActiveSeasonId) {
      // a season just ended (we no longer know which is active)
      dispatchSeasonalEvent("season:end", { seasonId: lastActiveSeasonId });
    }
    if (activeId) {
      dispatchSeasonalEvent("season:start", { seasonId: activeId });
    }
    lastActiveSeasonId = activeId;
  }
}

/** Build the default context from store accessors (used by `seasonStore`). */
export function buildDefaultContext(deps: {
  season: Season;
  grantXpRaw: (amount: number, source: string) => number;
  grantPaperOrbitxRaw: (amount: number, reason: string) => void;
  getProgress: () => SeasonProgress;
}): SeasonalEventContext {
  return {
    season: deps.season,
    grantXp: (amount, source) => deps.grantXpRaw(amount, source),
    grantPaperOrbitx: (amount, reason) => deps.grantPaperOrbitxRaw(amount, reason),
    progress: deps.getProgress,
    emit: (name, data) => emitSeasonalCustom(name, data),
  };
}
