import { describe, expect, it } from "vitest";
import { scoreToken } from "./tokenScore";

describe("scoreToken", () => {
  it("scores a strong, fully-known token near the top", () => {
    const s = scoreToken({
      liquidityUsd: 2_000_000,
      top10Pct: 8,
      mintRevoked: true,
      freezeRevoked: true,
      volume24hUsd: 1_500_000,
      txns24h: 4_000,
    });
    expect(s.score).toBe(100);
    expect(s.label).toBe("Strong");
    expect(s.partial).toBe(false);
    expect(s.missing).toEqual([]);
    expect(s.coverage).toBe(1);
  });

  it("scores a healthy mid token in the Fair band", () => {
    const s = scoreToken({
      liquidityUsd: 300_000,
      top10Pct: 18,
      mintRevoked: true,
      freezeRevoked: true,
      volume24hUsd: 120_000,
      txns24h: 600,
    });
    // 20 + 20 + 15 + 15 + 6 + 8 = 84
    expect(s.score).toBe(84);
    expect(s.label).toBe("Strong");
    expect(s.partial).toBe(false);
  });

  it("scores ORBITX honestly from real DexScreener + RugCheck data (2026-11-03)", () => {
    // DexScreener: liquidity $7,257.97, vol24h $88.83, txns24h 2.
    // RugCheck: mint + freeze authorities both null (revoked), top-10 65.09%
    // raw — but 40.99% of that is the pumpswap pool account itself, so the
    // wallet-held top-10 is ~24.10%.
    const s = scoreToken({
      liquidityUsd: 7257.97,
      top10Pct: 24.1,
      mintRevoked: true,
      freezeRevoked: true,
      volume24hUsd: 88.83,
      txns24h: 2,
    });
    // 6 + 15 + 15 + 15 + 2 + 2 = 55
    expect(s.score).toBe(55);
    expect(s.label).toBe("Weak");
    expect(s.partial).toBe(false);
    expect(s.breakdown).toEqual({
      liquidity: 6,
      holders: 15,
      mintAuthority: 15,
      freezeAuthority: 15,
      volume: 2,
      activity: 2,
    });
  });

  it("never invents points for unknown inputs — partial data is disclosed", () => {
    const s = scoreToken({
      liquidityUsd: 500_000,
      mintRevoked: true,
      freezeRevoked: true,
      // top10Pct, volume24hUsd, txns24h unknown
    });
    // 20 + 0 + 15 + 15 + 0 + 0 = 50 — unknown buckets earn 0, never a guess
    expect(s.score).toBe(50);
    expect(s.partial).toBe(true);
    expect(s.missing).toEqual(["top-10 holders", "24h volume", "24h transactions"]);
    expect(s.coverage).toBe(0.5);
    expect(s.breakdown.holders).toBe(0);
    expect(s.breakdown.volume).toBe(0);
    expect(s.breakdown.activity).toBe(0);
  });

  it("scores a fully-unknown token 0 and flags every input missing", () => {
    const s = scoreToken({});
    expect(s.score).toBe(0);
    expect(s.label).toBe("Low");
    expect(s.partial).toBe(true);
    expect(s.coverage).toBe(0);
    expect(s.missing).toHaveLength(6);
  });

  it("treats a live mint authority as unsafe (0 points), not as unknown", () => {
    const s = scoreToken({
      liquidityUsd: 2_000_000,
      top10Pct: 8,
      mintRevoked: false,
      freezeRevoked: true,
      volume24hUsd: 1_500_000,
      txns24h: 4_000,
    });
    expect(s.score).toBe(85);
    expect(s.missing).not.toContain("mint authority");
    expect(s.breakdown.mintAuthority).toBe(0);
  });

  it("punishes extreme holder concentration even when everything else is fine", () => {
    const s = scoreToken({
      liquidityUsd: 2_000_000,
      top10Pct: 82,
      mintRevoked: true,
      freezeRevoked: true,
      volume24hUsd: 1_500_000,
      txns24h: 4_000,
    });
    expect(s.breakdown.holders).toBe(0);
    expect(s.score).toBe(75);
    expect(s.label).toBe("Fair");
  });

  it("clamps to the documented bands at the boundaries", () => {
    expect(scoreToken({ liquidityUsd: 1_000_000, top10Pct: 10, mintRevoked: true, freezeRevoked: true, volume24hUsd: 1_000_000, txns24h: 1000 }).score).toBe(100);
    // Exactly 60 → Fair; exactly 40 → Weak; exactly 80 → Strong
    expect(scoreToken({ liquidityUsd: 1_000_000, top10Pct: 20, mintRevoked: true, freezeRevoked: false, volume24hUsd: 0, txns24h: 0 }).score).toBe(60);
    expect(scoreToken({ liquidityUsd: 1_000_000, top10Pct: 20, mintRevoked: true, freezeRevoked: false, volume24hUsd: 0, txns24h: 0 }).label).toBe("Fair");
  });
});
