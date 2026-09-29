/**
 * OrbitXCity — Seasons module: season-pass progress store.
 *
 * External store + `useSeasonStore()` hook (useSyncExternalStore), persisted
 * to localStorage. Holds season XP, tier, reward claims, premium unlock, and
 * the PAPER-ORBITX ledger (local only — never on-chain).
 *
 * Self-contained: no imports from other city modules, no tokenomics.
 * XP grants flow through the seasonal event framework (plugin multipliers).
 */

import { useSyncExternalStore } from "react";
import type { PaperOrbitxEntry, RewardTrack, Season, SeasonProgress } from "../types";
import { getSeasonById, getSeasonInfo, tierForXp } from "../data/seasons";
import {
  buildDefaultContext,
  checkSeasonTransitions,
  currentXpMultiplier,
  dispatchSeasonalEvent,
  setEventContextFactory,
} from "../eventFramework";

const STORAGE_KEY = "orbitxcity:seasons:v1";
const MAX_HISTORY = 200;

interface StoreState {
  seasonId: string;
  xp: number;
  claimed: string[];
  premiumUnlocked: boolean;
  premiumBurnSignature: string | null;
  paperOrbitx: number;
  paperHistory: PaperOrbitxEntry[];
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function blankState(seasonId: string): StoreState {
  return {
    seasonId,
    xp: 0,
    claimed: [],
    premiumUnlocked: false,
    premiumBurnSignature: null,
    paperOrbitx: 0,
    paperHistory: [],
  };
}

function loadState(): StoreState {
  const active = getSeasonInfo().season;
  let parsed: Partial<StoreState> | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw) as Partial<StoreState>;
  } catch {
    parsed = null;
  }
  const base = blankState(active.id);
  if (!parsed || typeof parsed !== "object") return base;
  const state: StoreState = {
    ...base,
    seasonId: typeof parsed.seasonId === "string" ? parsed.seasonId : active.id,
    xp: typeof parsed.xp === "number" && parsed.xp >= 0 ? Math.floor(parsed.xp) : 0,
    claimed: Array.isArray(parsed.claimed) ? parsed.claimed.filter((c) => typeof c === "string") : [],
    premiumUnlocked: parsed.premiumUnlocked === true,
    premiumBurnSignature:
      typeof parsed.premiumBurnSignature === "string" ? parsed.premiumBurnSignature : null,
    paperOrbitx:
      typeof parsed.paperOrbitx === "number" && parsed.paperOrbitx >= 0 ? parsed.paperOrbitx : 0,
    paperHistory: Array.isArray(parsed.paperHistory)
      ? (parsed.paperHistory as PaperOrbitxEntry[]).slice(0, MAX_HISTORY)
      : [],
  };
  // Rollover: if a new season is active, reset pass progress (paper ORBITX
  // balance carries over — it's a persistent wallet, not a seasonal reset).
  const info = getSeasonInfo();
  if (info.status === "active" && state.seasonId !== info.season.id) {
    return { ...blankState(info.season.id), paperOrbitx: state.paperOrbitx, paperHistory: state.paperHistory };
  }
  return state;
}

let state: StoreState = loadState();
const listeners = new Set<() => void>();

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — game keeps running */
  }
}

function emit(): void {
  save();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

/* ------------------------------------------------------------------ */
/* Internal mutators                                                   */
/* ------------------------------------------------------------------ */

function activeSeason(): Season {
  return getSeasonById(state.seasonId) ?? getSeasonInfo().season;
}

/** Credit paper ORBITX to the local ledger. */
function creditPaperOrbitx(amount: number, reason: string): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  state.paperOrbitx = Math.max(0, state.paperOrbitx + amount);
  state.paperHistory = [
    {
      id: newId(),
      at: Date.now(),
      amount,
      reason,
      balanceAfter: state.paperOrbitx,
    },
    ...state.paperHistory,
  ].slice(0, MAX_HISTORY);
}

/** Grant XP after the multiplier is already applied. Returns tiers gained. */
function grantXpPostMultiplier(amount: number, source: string): { final: number; tierUps: number[] } {
  const season = activeSeason();
  const final = Math.max(0, Math.floor(amount));
  if (final <= 0) return { final: 0, tierUps: [] };
  const oldTier = tierForXp(state.xp, season);
  state.xp += final;
  const newTier = tierForXp(state.xp, season);
  const tierUps: number[] = [];
  for (let t = oldTier + 1; t <= newTier; t += 1) tierUps.push(t);
  emit();
  dispatchSeasonalEvent("xp:gain", { amount: final, source, seasonId: season.id });
  for (const t of tierUps) {
    dispatchSeasonalEvent("tier:up", { tier: t, track: "free", seasonId: season.id });
    if (state.premiumUnlocked) {
      dispatchSeasonalEvent("tier:up", { tier: t, track: "premium", seasonId: season.id });
    }
  }
  return { final, tierUps };
}

/* ------------------------------------------------------------------ */
/* Public store                                                        */
/* ------------------------------------------------------------------ */

export const seasonStore = {
  subscribe,

  getSnapshot(): SeasonProgress {
    const season = activeSeason();
    return {
      seasonId: state.seasonId,
      xp: state.xp,
      tier: tierForXp(state.xp, season),
      premiumUnlocked: state.premiumUnlocked,
      premiumBurnSignature: state.premiumBurnSignature,
      claimed: [...state.claimed],
      paperOrbitx: state.paperOrbitx,
    };
  },

  getPaperHistory(): PaperOrbitxEntry[] {
    return [...state.paperHistory];
  },

  /**
   * Grant season XP. Runs through every registered plugin's `xpMultiplier`.
   * Other modules / the core loop call this (e.g. on job completion).
   * No-ops (returns 0) when no season is active.
   */
  addXp(amount: number, source: string): number {
    if (getSeasonInfo().status !== "active") return 0;
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const mult = currentXpMultiplier();
    const { final } = grantXpPostMultiplier(amount * mult, source);
    return final;
  },

  /** Is a tier reward claimable right now? */
  canClaim(tier: number, track: RewardTrack): boolean {
    const progress = seasonStore.getSnapshot();
    if (tier < 1 || tier > activeSeason().maxTier) return false;
    if (tier > progress.tier) return false;
    if (track === "premium" && !progress.premiumUnlocked) return false;
    const key = `${track === "free" ? "f" : "p"}${tier}`;
    return !state.claimed.includes(key);
  },

  /**
   * Claim a tier reward → credits paper ORBITX to the local ledger.
   * Returns the credited amount, or 0 if not claimable.
   */
  claimReward(tier: number, track: RewardTrack): number {
    if (!seasonStore.canClaim(tier, track)) return 0;
    const season = activeSeason();
    const tierDef = season.tiers.find((t) => t.tier === tier);
    if (!tierDef) return 0;
    const reward = track === "free" ? tierDef.free : tierDef.premium;
    const key = `${track === "free" ? "f" : "p"}${tier}`;
    state.claimed.push(key);
    creditPaperOrbitx(reward.paperOrbitx, `Season pass ${track} tier ${tier}`);
    emit();
    dispatchSeasonalEvent("reward:claim", {
      tier,
      track,
      seasonId: season.id,
      paperOrbitx: reward.paperOrbitx,
      cosmetic: reward.cosmetic ?? null,
    });
    return reward.paperOrbitx;
  },

  /** Mark the premium track unlocked after the entry burn lands. */
  unlockPremium(signature: string): void {
    state.premiumUnlocked = true;
    state.premiumBurnSignature = signature;
    emit();
  },

  /** Paper-ORBITX grant outside the pass (plugins, event bonuses). */
  grantPaperOrbitx(amount: number, reason: string): void {
    creditPaperOrbitx(amount, reason);
    emit();
  },

  /** Dev/test helper: wipe this season's progress (keeps paper balance). */
  resetProgress(): void {
    const keep = { paperOrbitx: state.paperOrbitx, paperHistory: state.paperHistory };
    state = { ...blankState(activeSeason().id), ...keep };
    emit();
  },
};

export function useSeasonStore(): SeasonProgress {
  return useSyncExternalStore(subscribe, () => seasonStore.getSnapshot(), () => seasonStore.getSnapshot());
}

export function usePaperOrbitxHistory(): PaperOrbitxEntry[] {
  return useSyncExternalStore(subscribe, () => seasonStore.getPaperHistory(), () =>
    seasonStore.getPaperHistory(),
  );
}

/** "1,250" formatting for paper ORBITX amounts. */
export function formatPaperOrbitx(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/* Module init (runs once on first import)                             */
/* ------------------------------------------------------------------ */

setEventContextFactory(() =>
  buildDefaultContext({
    season: activeSeason(),
    grantXpRaw: (amount, source) => seasonStore.addXp(amount, source),
    grantPaperOrbitxRaw: (amount, reason) => seasonStore.grantPaperOrbitx(amount, reason),
    getProgress: () => seasonStore.getSnapshot(),
  }),
);
checkSeasonTransitions();
