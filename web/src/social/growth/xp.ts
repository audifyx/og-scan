/**
 * OrbitX Social Growth — XP, levels, reputation titles.
 * Pure functions; UI/store decide when to award.
 */

export type XpAction =
  | "post_create"
  | "comment"
  | "like_received"
  | "follow_gained"
  | "voice_join"
  | "voice_host"
  | "referral_signup"
  | "community_create"
  | "daily_checkin"
  | "report_valid"
  | "mod_action";

export const XP_REWARDS: Record<XpAction, number> = {
  post_create: 15,
  comment: 8,
  like_received: 3,
  follow_gained: 10,
  voice_join: 5,
  voice_host: 40,
  referral_signup: 100,
  community_create: 50,
  daily_checkin: 20,
  report_valid: 25,
  mod_action: 5,
};

export type ReputationTier = {
  level: number;
  title: string;
  minXp: number;
};

export const REPUTATION_TIERS: ReputationTier[] = [
  { level: 1, title: "Newcomer", minXp: 0 },
  { level: 2, title: "Explorer", minXp: 100 },
  { level: 3, title: "Regular", minXp: 300 },
  { level: 4, title: "Contributor", minXp: 700 },
  { level: 5, title: "Trusted", minXp: 1500 },
  { level: 6, title: "Community Voice", minXp: 3000 },
  { level: 7, title: "Alpha Lead", minXp: 6000 },
  { level: 8, title: "Orbit OG", minXp: 12000 },
  { level: 9, title: "Legend", minXp: 25000 },
  { level: 10, title: "Architect", minXp: 50000 },
];

export function xpForAction(action: XpAction): number {
  return XP_REWARDS[action] ?? 0;
}

export function tierForXp(xp: number): ReputationTier {
  let current = REPUTATION_TIERS[0];
  for (const t of REPUTATION_TIERS) {
    if (xp >= t.minXp) current = t;
  }
  return current;
}

export function progressToNext(xp: number): { current: ReputationTier; next: ReputationTier | null; pct: number } {
  const current = tierForXp(xp);
  const idx = REPUTATION_TIERS.findIndex((t) => t.level === current.level);
  const next = REPUTATION_TIERS[idx + 1] ?? null;
  if (!next) return { current, next: null, pct: 100 };
  const span = next.minXp - current.minXp;
  const pct = span <= 0 ? 100 : Math.min(100, Math.round(((xp - current.minXp) / span) * 100));
  return { current, next, pct };
}

export function applyXp(currentXp: number, action: XpAction, multiplier = 1): number {
  return Math.max(0, currentXp + Math.round(xpForAction(action) * multiplier));
}
