/**
 * ORBITXCITY — Factions module: the four trading firms.
 * Pure data + membership rules. No other-module imports.
 */
import type { FactionDef, FactionId, PlayerFactionProfile, RankDef } from "./types";

export const RANKS: RankDef[] = [
  { name: "Recruit", rep: 0 },
  { name: "Paperhand", rep: 100 },
  { name: "Daytrader", rep: 300 },
  { name: "Whalehunter", rep: 700 },
  { name: "Marketmaker", rep: 1500 },
  { name: "Partner", rep: 3000 },
  { name: "Kingpin", rep: 6000 },
];

export const FACTIONS: Record<FactionId, FactionDef> = {
  bulls: {
    id: "bulls",
    name: "Neon Bulls",
    short: "BULLS",
    motto: "Only up. The city buys the dip.",
    color: "#22d3ee",
    accent: "#a3e635",
    buff: { label: "+6% paper CITY earnings citywide", earnPct: 0.06 },
    logoSvg:
      '<path d="M32 8 L44 20 L52 18 L48 30 L54 40 L40 38 L36 52 L28 52 L24 38 L10 40 L16 30 L12 18 L20 20 Z" fill="currentColor"/><circle cx="32" cy="30" r="5" fill="#0b0f1a"/>',
  },
  bears: {
    id: "bears",
    name: "Crimson Bears",
    short: "BEARS",
    motto: "Short the hype. Own the streets.",
    color: "#ef4444",
    accent: "#fca5a5",
    buff: { label: "+6% turf fee-share payouts", earnPct: 0.06 },
    logoSvg:
      '<path d="M14 22 a6 6 0 1 1 8 -10 a14 14 0 0 1 20 0 a6 6 0 1 1 8 10 a14 14 0 0 1 4 14 a10 10 0 0 1 -20 8 a10 10 0 0 1 -20 -8 a14 14 0 0 1 0 -14 Z" fill="currentColor"/>',
  },
  whales: {
    id: "whales",
    name: "Violet Whales",
    short: "WHALES",
    motto: "Deep pockets. Deeper conviction.",
    color: "#a855f7",
    accent: "#67e8f9",
    buff: { label: "+6% war-bond returns on victories", earnPct: 0.06 },
    logoSvg:
      '<path d="M8 36 q10 -18 26 -18 q16 0 22 14 l-8 2 q2 8 -6 12 q-14 8 -30 -2 q-6 -4 -4 -8 Z" fill="currentColor"/><circle cx="20" cy="32" r="3" fill="#0b0f1a"/>',
  },
  apes: {
    id: "apes",
    name: "Gold Apes",
    short: "APES",
    motto: "Diamond hands on every corner.",
    color: "#f59e0b",
    accent: "#fef08a",
    buff: { label: "+6% graffiti style & prize payouts", earnPct: 0.06 },
    logoSvg:
      '<circle cx="24" cy="30" r="5" fill="currentColor"/><circle cx="40" cy="30" r="5" fill="currentColor"/><path d="M16 40 q16 14 32 0 q-2 12 -16 12 q-14 0 -16 -12 Z" fill="currentColor"/>',
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

export function faction(id: FactionId | null | undefined): FactionDef | null {
  if (!id) return null;
  return FACTIONS[id] ?? null;
}

/** Rank name for a given rep total. */
export function rankForRep(rep: number): string {
  let name = RANKS[0].name;
  for (const r of RANKS) if (rep >= r.rep) name = r.name;
  return name;
}

/** Rep still needed for the next rank (0 when maxed). */
export function repToNextRank(rep: number): { next: string | null; needed: number } {
  for (const r of RANKS) {
    if (rep < r.rep) return { next: r.name, needed: r.rep - rep };
  }
  return { next: null, needed: 0 };
}

/** Blank player profile (unaffiliated). */
export function blankProfile(): PlayerFactionProfile {
  return {
    factionId: null,
    rank: RANKS[0].name,
    rep: 0,
    lifetimeContributed: 0,
    joinedAt: 0,
  };
}

/**
 * Join a firm. Returns a fresh profile. Switching firms costs loyalty:
 * rep resets (keeps 25% of it as street cred).
 */
export function joinFaction(current: PlayerFactionProfile, id: FactionId): PlayerFactionProfile {
  const keptRep = current.factionId === id ? current.rep : Math.floor(current.rep * 0.25);
  const now = Date.now();
  return {
    factionId: id,
    rank: rankForRep(keptRep),
    rep: keptRep,
    lifetimeContributed: current.lifetimeContributed,
    joinedAt: current.factionId === id ? current.joinedAt : now,
  };
}

/** Leave the firm. Keeps rep history for lifetime stats but wipes standing. */
export function leaveFaction(current: PlayerFactionProfile): PlayerFactionProfile {
  return { ...blankProfile(), lifetimeContributed: current.lifetimeContributed };
}

/** Award rep (paper). Returns updated profile + whether a promotion happened. */
export function awardRep(
  profile: PlayerFactionProfile,
  amount: number
): { profile: PlayerFactionProfile; promoted: boolean } {
  const before = rankForRep(profile.rep);
  const rep = Math.max(0, profile.rep + Math.floor(amount));
  const after = rankForRep(rep);
  return { profile: { ...profile, rep, rank: after }, promoted: after !== before };
}

/** Contribute paper CITY to the firm's war chest. Earns rep at 1:10. */
export function contributeToFirm(
  profile: PlayerFactionProfile,
  paperCity: number
): { profile: PlayerFactionProfile; promoted: boolean } {
  if (paperCity <= 0) return { profile, promoted: false };
  const withRep = awardRep(profile, paperCity / 10);
  return {
    profile: {
      ...withRep.profile,
      lifetimeContributed: profile.lifetimeContributed + paperCity,
    },
    promoted: withRep.promoted,
  };
}
