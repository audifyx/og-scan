import { describe, it, expect } from "vitest";
import { classifyToken, tierIntent, TIER_LABEL } from "./classification";

describe("classifyToken — 4-tier taxonomy", () => {
  it("flags honeypot + LP pull as DANGEROUS with high confidence", () => {
    const r = classifyToken({
      honeypot: true, lpPulled: true, mintAuthorityActive: true,
      isFirstMint: false, trueOgProbability: 5, topHolderPct: 80,
      liquidityUsd: 100, holderCount: 10, ageHours: 2,
    });
    expect(r.tier).toBe("DANGEROUS_TOKEN");
    expect(r.confidence).toBeGreaterThan(60);
    expect(r.riskScore).toBeGreaterThanOrEqual(70);
    expect(r.signals.some((s) => s.id === "honeypot")).toBe(true);
  });

  it("classifies first-mint, low-risk, dominant token as OG", () => {
    const r = classifyToken({
      isFirstMint: true, isPrimaryToken: true, trueOgProbability: 90,
      cloneProbability: 5, lpPulled: false, mintAuthorityActive: false,
      freezeAuthorityActive: false, topHolderPct: 8, bundledSupplyPct: 3,
      liquidityUsd: 250_000, holderCount: 4000, ageHours: 5000,
      hasName: true, hasSymbol: true, hasSocials: true,
    });
    expect(r.tier).toBe("OG_TOKEN");
    expect(r.confidence).toBeGreaterThan(50);
    expect(r.riskScore).toBeLessThan(25);
  });

  it("classifies a clean non-original token as SAFE_CLONE", () => {
    const r = classifyToken({
      isFirstMint: false, isPrimaryToken: false, trueOgProbability: 20,
      cloneProbability: 70, lpPulled: false, mintAuthorityActive: false,
      topHolderPct: 12, bundledSupplyPct: 5, liquidityUsd: 60_000,
      holderCount: 1200, ageHours: 1500, hasName: true, hasSymbol: true, hasSocials: true,
    });
    expect(r.tier).toBe("SAFE_CLONE");
    expect(r.riskScore).toBeLessThan(40);
  });

  it("classifies sparse-data token as RISKY (low confidence)", () => {
    const r = classifyToken({ symbolOnly: true } as any);
    expect(r.tier).toBe("RISKY_TOKEN");
    expect(r.dataCompleteness).toBeLessThan(35);
  });

  it("classifies incomplete metadata + mild risk as RISKY", () => {
    const r = classifyToken({
      isFirstMint: false, trueOgProbability: 30, lpPulled: false,
      mintAuthorityActive: true, topHolderPct: 30, liquidityUsd: 8000,
      holderCount: 200, ageHours: 100, hasName: true, hasSymbol: true, hasSocials: false,
    });
    expect(r.tier).toBe("RISKY_TOKEN");
  });

  it("always returns confidence within 0-100 and a non-empty rationale", () => {
    const r = classifyToken({ isFirstMint: true, liquidityUsd: 30000, holderCount: 600, ageHours: 800, topHolderPct: 10, lpPulled: false, mintAuthorityActive: false, trueOgProbability: 70 });
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(100);
    expect(r.rationale.length).toBeGreaterThan(0);
  });

  it("produces an explainability trace sorted by weight", () => {
    const r = classifyToken({ honeypot: true, mintAuthorityActive: true, lpPulled: true });
    for (let i = 1; i < r.signals.length; i++) {
      expect(r.signals[i - 1].weight).toBeGreaterThanOrEqual(r.signals[i].weight);
    }
  });

  it("maps every tier to a UI intent and label", () => {
    (["OG_TOKEN", "SAFE_CLONE", "RISKY_TOKEN", "DANGEROUS_TOKEN"] as const).forEach((t) => {
      expect(TIER_LABEL[t]).toBeTruthy();
      expect(tierIntent(t)).toBeTruthy();
    });
  });
});
