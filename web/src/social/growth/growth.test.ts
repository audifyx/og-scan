import { describe, expect, it } from "vitest";
import { applyXp, progressToNext, tierForXp, xpForAction } from "./xp";
import { generateReferralCode, qualifyReferral, scoreReferralLeaderboard } from "./referrals";
import { rankByMetric, traderRankScore } from "./leaderboard";

describe("xp growth", () => {
  it("awards known actions", () => {
    expect(xpForAction("post_create")).toBe(15);
    expect(applyXp(100, "referral_signup")).toBe(200);
  });

  it("maps tiers", () => {
    expect(tierForXp(0).title).toBe("Newcomer");
    expect(tierForXp(1600).title).toBe("Trusted");
    expect(progressToNext(100).pct).toBeGreaterThanOrEqual(0);
  });
});

describe("referrals", () => {
  it("generates stable codes", () => {
    expect(generateReferralCode("user-abc")).toBe(generateReferralCode("user-abc"));
    expect(generateReferralCode("user-abc")).not.toBe(generateReferralCode("user-xyz"));
  });

  it("qualifies and ranks", () => {
    expect(qualifyReferral({ hasProfile: true, hasWallet: true, postedOnce: false })).toBe(true);
    expect(qualifyReferral({ hasProfile: false, hasWallet: true, postedOnce: true })).toBe(false);
    const ranked = scoreReferralLeaderboard([
      { code: "A", ownerId: "1", ownerName: "a", createdAt: 1, signups: 2, qualified: 1, xpEarned: 100 },
      { code: "B", ownerId: "2", ownerName: "b", createdAt: 1, signups: 5, qualified: 3, xpEarned: 300 },
    ]);
    expect(ranked[0].code).toBe("B");
  });
});

describe("leaderboards", () => {
  it("ranks by value", () => {
    const r = rankByMetric([
      { userId: "1", username: "a", value: 10 },
      { userId: "2", username: "b", value: 50 },
    ]);
    expect(r[0].username).toBe("b");
    expect(r[0].rank).toBe(1);
  });

  it("scores traders", () => {
    expect(traderRankScore({ pnlPct: 40, winRate: 60, volumeUsd: 100_000, followers: 200 })).toBeGreaterThan(50);
  });
});
