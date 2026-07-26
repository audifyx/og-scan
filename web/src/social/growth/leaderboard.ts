/**
 * Leaderboard ranking helpers for social growth.
 */

export type LeaderboardMetric = "xp" | "followers" | "posts" | "voice_hours" | "referrals";

export type LeaderboardEntry = {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  value: number;
  rank: number;
  delta?: number;
};

export function rankByMetric(
  rows: Array<{ userId: string; username: string; avatarUrl?: string | null; value: number; prevValue?: number }>,
): LeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  return sorted.map((r, i) => ({
    userId: r.userId,
    username: r.username,
    avatarUrl: r.avatarUrl,
    value: r.value,
    rank: i + 1,
    delta: r.prevValue != null ? r.value - r.prevValue : undefined,
  }));
}

export function traderRankScore(opts: { pnlPct?: number; winRate?: number; volumeUsd?: number; followers?: number }): number {
  const pnl = Math.max(-50, Math.min(200, opts.pnlPct ?? 0));
  const wr = Math.max(0, Math.min(100, opts.winRate ?? 0));
  const vol = Math.log10(Math.max(1, opts.volumeUsd ?? 1)) * 12;
  const social = Math.min(40, (opts.followers ?? 0) / 25);
  return Math.round(pnl * 0.35 + wr * 0.35 + vol + social);
}
