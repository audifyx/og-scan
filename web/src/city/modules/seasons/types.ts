/**
 * OrbitXCity — Seasons module: shared types.
 *
 * Self-contained: this file imports NOTHING from other modules (and nothing
 * from `@/tokenomics/*`). It only declares interfaces and plain types.
 */

/* ------------------------------------------------------------------ */
/* Season / battle-pass domain                                         */
/* ------------------------------------------------------------------ */

/** Reward track inside a season: free (everyone) vs premium (ORBITX-burn entry). */
export type RewardTrack = "free" | "premium";

/** A paper-ORBITX reward grantable from a season tier. Paper = local ledger, no chain. */
export interface PaperOrbitxReward {
  /** Paper ORBITX credited to the season paper ledger on claim. */
  paperOrbitx: number;
  /** Short display label, e.g. "+75 paper ORBITX". */
  label: string;
  /** Optional cosmetic unlock label (premium milestones). Display-only. */
  cosmetic?: string;
}

/** One tier of a season's reward track. */
export interface SeasonTier {
  tier: number; // 1-based
  /** XP (cumulative) required to reach this tier. */
  xpRequired: number;
  free: PaperOrbitxReward;
  premium: PaperOrbitxReward;
}

/** Season lifecycle state. */
export type SeasonStatus = "upcoming" | "active" | "ended";

/** A season definition (static config — see `data/seasons.ts`). */
export interface Season {
  id: string;
  name: string;
  theme: string;
  startsAt: number; // epoch ms (UTC)
  endsAt: number; // epoch ms (UTC)
  tiers: SeasonTier[];
  /** Real ORBITX burned to enter the premium track (whole tokens). */
  premiumEntryCost: number;
  maxTier: number;
}

/** Compact runtime view of the active season for UI. */
export interface SeasonInfo {
  season: Season;
  status: SeasonStatus;
  now: number;
  msRemaining: number; // until end if active, until start if upcoming
  nextSeasonId: string | null;
}

/** One season-pass progress snapshot. */
export interface SeasonProgress {
  seasonId: string;
  xp: number;
  tier: number; // current reached tier (0 = none)
  premiumUnlocked: boolean;
  premiumBurnSignature: string | null;
  /** Claimed reward keys: `f< tier>` / `p<tier>`, e.g. "f3", "p12". */
  claimed: string[];
  paperOrbitx: number; // paper-ORBITX balance (local ledger)
}

/** Paper-ORBITX ledger entry (local, no chain). */
export interface PaperOrbitxEntry {
  id: string;
  at: number; // epoch ms
  amount: number; // +credit / -debit
  reason: string;
  balanceAfter: number;
}

/** Billing provider shape — mirrors `web/src/city/BILLING_CONTRACT.md`. */
export interface SeasonBillingProvider {
  ready: boolean;
  balance: number | null;
  spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
  beginAuth: () => void;
}

/* ------------------------------------------------------------------ */
/* Seasonal event framework (plugin interface)                          */
/* ------------------------------------------------------------------ */

/** Event names dispatched by the framework. */
export type SeasonalEventType =
  | "season:start"
  | "season:end"
  | "tier:up"
  | "xp:gain"
  | "reward:claim"
  | "tick"
  | `custom:${string}`;

/** Payload carried with a dispatched event. */
export interface SeasonalEventPayload {
  type: SeasonalEventType;
  at: number; // epoch ms
  data?: Record<string, unknown>;
}

/** UI card a plugin can contribute to the Event Board. */
export interface SeasonalEventCard {
  pluginId: string;
  title: string;
  description: string;
  /** True while the event is live right now. */
  active: boolean;
  /** Optional countdown target (epoch ms) shown on the card. */
  endsAt?: number;
  accent?: string; // CSS color override
}

/**
 * Context handed to every plugin hook. All writes go through here so plugins
 * stay side-effect-safe and other modules can observe via `emit`.
 */
export interface SeasonalEventContext {
  /** The season this event fired under (may be an ended season). */
  season: Season;
  /** Grant season XP (goes through plugin XP multipliers). */
  grantXp: (amount: number, source: string) => number;
  /** Grant paper ORBITX (local ledger). */
  grantPaperOrbitx: (amount: number, reason: string) => void;
  /** Current pass progress snapshot. */
  progress: () => SeasonProgress;
  /** Broadcast a custom event to every other registered plugin. */
  emit: (name: string, data?: Record<string, unknown>) => void;
}

/** A seasonal event plugin. All hooks optional; implement what you need. */
export interface SeasonalEventPlugin {
  id: string;
  name: string;
  description: string;
  /** Fired when a season becomes active. */
  onSeasonStart?: (ctx: SeasonalEventContext) => void;
  /** Fired when a season ends. */
  onSeasonEnd?: (ctx: SeasonalEventContext) => void;
  /** Fired when the player reaches a new tier. */
  onTierUp?: (ctx: SeasonalEventContext, tier: number, track: RewardTrack) => void;
  /** Fired after XP is granted (post-multiplier, post-tier calc). */
  onXpGain?: (ctx: SeasonalEventContext, amount: number, source: string) => void;
  /** Fired when a tier reward is claimed. */
  onRewardClaim?: (ctx: SeasonalEventContext, tier: number, track: RewardTrack) => void;
  /** Called ~1/sec by the framework ticker while mounted. */
  onTick?: (ctx: SeasonalEventContext, now: number) => void;
  /** Optional XP multiplier applied to every XP grant (product of all plugins). */
  xpMultiplier?: (ctx: SeasonalEventContext) => number;
  /** Optional card for the Event Board. */
  eventCard?: (ctx: SeasonalEventContext, now: number) => SeasonalEventCard | null;
  /** Custom events via ctx.emit("name", ...). */
  onCustom?: (ctx: SeasonalEventContext, name: string, data?: Record<string, unknown>) => void;
}
