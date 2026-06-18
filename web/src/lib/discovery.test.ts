import { describe, it, expect } from "vitest";
import { rankCandidate, buildFeeds, classifyFeed, FEED_LABEL } from "./discovery";

describe("discovery engine", () => {
  it("ranks with explainable factors summing to score", () => {
    const r = rankCandidate({ mint: "A", velocity: 80, liquidityStability: 60, socialSignal: 40 });
    const sum = r.factors.reduce((a, f) => a + f.contribution, 0);
    expect(Math.round(r.rankScore)).toBe(Math.round(sum));
    expect(r.explanation).toContain("Ranked");
    expect(r.factors).toHaveLength(3);
  });

  it("derives social signal from scan count when absent", () => {
    const r = rankCandidate({ mint: "A", velocity: 0, liquidityStability: 0, scans24h: 50 });
    expect(r.socialSignal).toBeGreaterThan(50);
  });

  it("buckets risky/dangerous into risky feed", () => {
    expect(classifyFeed(rankCandidate({ mint: "A", tier: "DANGEROUS_TOKEN", velocity: 90 }))).toBe("risky");
  });
  it("buckets new high-rank token into emerging", () => {
    expect(classifyFeed(rankCandidate({ mint: "A", tier: "SAFE_CLONE", ageHours: 5, velocity: 90, liquidityStability: 80, socialSignal: 80 }))).toBe("emerging");
  });
  it("buckets established OG into trending_og", () => {
    expect(classifyFeed(rankCandidate({ mint: "A", tier: "OG_TOKEN", ageHours: 1000, velocity: 60 }))).toBe("trending_og");
  });

  it("buildFeeds segments and caps", () => {
    const cands = Array.from({ length: 60 }, (_, i) => ({ mint: `m${i}`, tier: "SAFE_CLONE" as const, velocity: i, liquidityStability: 50, ageHours: 1000 }));
    const feeds = buildFeeds(cands, 25);
    expect(feeds.trending_safe.length).toBeLessThanOrEqual(25);
    expect(FEED_LABEL.trending_og).toBe("Trending OG");
  });
});
