/**
 * Referral codes + attribution scoring.
 */

export type ReferralRecord = {
  code: string;
  ownerId: string;
  ownerName: string;
  createdAt: number;
  signups: number;
  qualified: number;
  xpEarned: number;
};

export type ReferralEvent = {
  id: string;
  code: string;
  referredId: string;
  referredName: string;
  at: number;
  qualified: boolean;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(seed: string, length = 6): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let x = Math.abs(h) || 1;
  for (let i = 0; i < length; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out += CODE_ALPHABET[x % CODE_ALPHABET.length];
  }
  return out;
}

export function referralLink(code: string, origin = typeof window !== "undefined" ? window.location.origin : "https://orbitx.fun"): string {
  return `${origin}/hq/invite?ref=${encodeURIComponent(code)}`;
}

export function scoreReferralLeaderboard(records: ReferralRecord[]): ReferralRecord[] {
  return [...records].sort((a, b) => {
    if (b.qualified !== a.qualified) return b.qualified - a.qualified;
    if (b.signups !== a.signups) return b.signups - a.signups;
    return b.xpEarned - a.xpEarned;
  });
}

export function qualifyReferral(opts: { hasProfile: boolean; hasWallet: boolean; postedOnce: boolean }): boolean {
  return opts.hasProfile && (opts.hasWallet || opts.postedOnce);
}
