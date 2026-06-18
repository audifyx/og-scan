// ============================================================
// OG Scan — Discovery Engine (spec section C & 8)
// Explainable ranking + segmented feeds:
//   Trending OG | Trending SAFE | Emerging | Risky
// Pure & dependency-free.
// ============================================================

import type { OgTier } from "./classification";

export type FeedCandidate = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  tier?: OgTier;
  velocity?: number;            // 0-100
  liquidityStability?: number;  // 0-100
  socialSignal?: number;        // 0-100
  liquidityUsd?: number;
  ageHours?: number;
  scans24h?: number;
};

export type RankFactor = { label: string; weight: number; contribution: number };
export type RankedItem = FeedCandidate & {
  rankScore: number;            // 0-100
  factors: RankFactor[];
  explanation: string;
};

export type FeedKind = "trending_og" | "trending_safe" | "emerging" | "risky";

const W = { velocity: 0.4, liquidityStability: 0.3, socialSignal: 0.3 } as const;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}

/** Explainable composite ranking score. */
export function rankCandidate(c: FeedCandidate): RankedItem {
  const velocity = clamp(c.velocity ?? 0);
  const stability = clamp(c.liquidityStability ?? 0);
  const social = clamp(c.socialSignal ?? socialFromScans(c.scans24h));

  const factors: RankFactor[] = [
    { label: "Trend velocity", weight: W.velocity, contribution: velocity * W.velocity },
    { label: "Liquidity stability", weight: W.liquidityStability, contribution: stability * W.liquidityStability },
    { label: "Social signal", weight: W.socialSignal, contribution: social * W.socialSignal },
  ];
  const rankScore = clamp(factors.reduce((a, f) => a + f.contribution, 0));

  const top = factors.slice().sort((a, b) => b.contribution - a.contribution)[0];
  const explanation = `Ranked ${rankScore.toFixed(0)}/100 — led by ${top.label.toLowerCase()} (${top.contribution.toFixed(0)} pts).`;

  return { ...c, velocity, liquidityStability: stability, socialSignal: social, rankScore, factors, explanation };
}

function socialFromScans(scans?: number): number {
  if (!scans || scans <= 0) return 0;
  return clamp(100 * (1 - Math.exp(-scans / 12))); // saturating curve
}

/** Bucket a ranked item into a discovery feed. */
export function classifyFeed(item: RankedItem): FeedKind {
  const isNew = (item.ageHours ?? Infinity) <= 48;
  if (item.tier === "RISKY_TOKEN" || item.tier === "DANGEROUS_TOKEN") return "risky";
  if (isNew && item.rankScore >= 45) return "emerging";
  if (item.tier === "OG_TOKEN") return "trending_og";
  return "trending_safe";
}

export type Feeds = Record<FeedKind, RankedItem[]>;

/** Rank, sort, and segment candidates into the four discovery feeds. */
export function buildFeeds(candidates: FeedCandidate[], perFeed = 25): Feeds {
  const ranked = candidates.map(rankCandidate).sort((a, b) => b.rankScore - a.rankScore);
  const feeds: Feeds = { trending_og: [], trending_safe: [], emerging: [], risky: [] };
  for (const item of ranked) feeds[classifyFeed(item)].push(item);
  (Object.keys(feeds) as FeedKind[]).forEach((k) => { feeds[k] = feeds[k].slice(0, perFeed); });
  return feeds;
}

export const FEED_LABEL: Record<FeedKind, string> = {
  trending_og: "Trending OG",
  trending_safe: "Trending SAFE",
  emerging: "Emerging",
  risky: "Risky",
};
