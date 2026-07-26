import { describe, expect, it } from "vitest";
import { composeRisk } from "./composeRisk";

describe("composeRisk", () => {
  it("flags honeypot as critical", () => {
    const r = composeRisk({ canBuy: true, canSell: false });
    expect(r.rating).toBe("F");
    expect(r.factors.some((f) => f.id === "honeypot")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("scores healthy token as A/B", () => {
    const r = composeRisk({
      canBuy: true,
      canSell: true,
      roundTripLossPct: 2,
      mintRenounced: true,
      freezeRenounced: true,
      lpLockedPct: 95,
      liquidityUsd: 250_000,
      top10Pct: 18,
      holderEntropy: 78,
      cloneSimilarityMax: 0.1,
      rugged: false,
    });
    expect(["A", "B"]).toContain(r.rating);
    expect(r.tone).toBe("good");
  });

  it("elevates serial deployer + clone", () => {
    const r = composeRisk({
      canBuy: true,
      canSell: true,
      creatorTokensCount: 12,
      devSerial: true,
      cloneHardMatch: true,
      liquidityUsd: 8_000,
    });
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.factors.some((f) => f.id === "clone_hard")).toBe(true);
    expect(r.factors.some((f) => f.id === "serial_dev")).toBe(true);
  });

  it("returns unknown tone when no signals", () => {
    const r = composeRisk({});
    expect(r.tone).toBe("unknown");
    expect(r.summary).toMatch(/unverified/i);
  });
});
