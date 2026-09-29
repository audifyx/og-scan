/**
 * OrbitXCity — Seasons module: season catalog (static config).
 *
 * Season windows are fixed UTC epochs. No server, no mocks: the clock is the
 * device clock. Rollover logic (in the store's `loadState`, which runs on
 * module init) resets pass progress when a new season becomes active.
 */

import type { Season, SeasonInfo, SeasonTier, PaperOrbitxReward } from "../types";

export const XP_PER_TIER = 250;
export const MAX_TIERS = 20;
export const PREMIUM_ENTRY_COST_ORBITX = 25;

function freeReward(tier: number): PaperOrbitxReward {
  const amount = 5 * tier;
  return { paperOrbitx: amount, label: `+${amount} paper ORBITX` };
}

function premiumReward(tier: number): PaperOrbitxReward {
  const amount = 15 * tier;
  const cosmetics: Record<number, string> = {
    5: "Neon Trail (vehicle)",
    10: "Chrome Rider Jacket",
    15: "Holo License Plate",
    20: "Season 1 Crown Car Wrap",
  };
  const cosmetic = cosmetics[tier];
  return {
    paperOrbitx: amount,
    label: cosmetic ? `+${amount} paper ORBITX · ${cosmetic}` : `+${amount} paper ORBITX`,
    ...(cosmetic ? { cosmetic } : {}),
  };
}

function buildTiers(): SeasonTier[] {
  const tiers: SeasonTier[] = [];
  for (let t = 1; t <= MAX_TIERS; t += 1) {
    tiers.push({
      tier: t,
      xpRequired: t * XP_PER_TIER,
      free: freeReward(t),
      premium: premiumReward(t),
    });
  }
  return tiers;
}

/** Season 1 — "Neon Genesis" (30-day window, UTC). */
const SEASON_1: Season = {
  id: "season-1",
  name: "Season 1 · Neon Genesis",
  theme: "neon",
  startsAt: Date.UTC(2026, 8, 29, 0, 0, 0),
  endsAt: Date.UTC(2026, 9, 29, 0, 0, 0),
  tiers: buildTiers(),
  premiumEntryCost: PREMIUM_ENTRY_COST_ORBITX,
  maxTier: MAX_TIERS,
};

export const SEASONS: Season[] = [SEASON_1];

export function getSeasonById(id: string): Season | null {
  return SEASONS.find((s) => s.id === id) ?? null;
}

/** Current tier (0 = none) for a cumulative XP total. */
export function tierForXp(xp: number, season: Season): number {
  let tier = 0;
  for (const t of season.tiers) {
    if (xp >= t.xpRequired) tier = t.tier;
    else break;
  }
  return tier;
}

export function getSeasonInfo(now: number = Date.now()): SeasonInfo {
  const sorted = [...SEASONS].sort((a, b) => a.startsAt - b.startsAt);
  for (const season of sorted) {
    if (now >= season.startsAt && now < season.endsAt) {
      return {
        season,
        status: "active",
        now,
        msRemaining: season.endsAt - now,
        nextSeasonId: null,
      };
    }
  }
  // Upcoming?
  for (const season of sorted) {
    if (now < season.startsAt) {
      return {
        season,
        status: "upcoming",
        now,
        msRemaining: season.startsAt - now,
        nextSeasonId: season.id,
      };
    }
  }
  // All ended — report the most recent.
  const last = sorted[sorted.length - 1];
  return {
    season: last,
    status: "ended",
    now,
    msRemaining: 0,
    nextSeasonId: null,
  };
}

/** "12d 04h 33m 10s" style countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}
