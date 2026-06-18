import { describe, it, expect } from "vitest";
import {
  trendVelocityScore, reconstructLifecycle, narrativeSimilarity, detectCloneEdges,
  holderEntropyScore, liquidityStabilityIndex, hypeDecayScore, whyTrending, whyExists, normalizeNarrative,
} from "./intelligence";

const mk = (vals: { price: number; volume?: number; liquidity?: number }[]) =>
  vals.map((v, i) => ({ t: i * 3.6e6, ...v }));

describe("intelligence layer", () => {
  it("scores a pumping series with high velocity", () => {
    const s = mk([{ price: 1, volume: 10 }, { price: 2, volume: 50 }, { price: 4, volume: 200 }]);
    expect(trendVelocityScore(s)).toBeGreaterThan(60);
  });
  it("scores a dumping series with low velocity", () => {
    const s = mk([{ price: 4, volume: 200 }, { price: 2, volume: 40 }, { price: 1, volume: 5 }]);
    expect(trendVelocityScore(s)).toBeLessThan(40);
  });

  it("detects decline lifecycle with drawdown", () => {
    const s = mk([{ price: 1, volume: 100, liquidity: 1000 }, { price: 5, volume: 300, liquidity: 1200 }, { price: 1.2, volume: 20, liquidity: 200 }]);
    const r = reconstructLifecycle(s);
    expect(r.stage).toBe("decline");
    expect(r.drawdownFromPeakPct).toBeGreaterThan(50);
  });
  it("flags liquidity collapse failure", () => {
    const s = mk([{ price: 1, volume: 100, liquidity: 5000 }, { price: 6, volume: 400, liquidity: 6000 }, { price: 1, volume: 10, liquidity: 100 }]);
    const r = reconstructLifecycle(s);
    expect(r.failure).toBe("liquidity_collapse");
  });

  it("computes narrative similarity", () => {
    expect(narrativeSimilarity("Pepe", "Pepe")).toBe(1);
    expect(narrativeSimilarity("Pepe", "Pepe 2.0")).toBeGreaterThan(0.5);
    expect(narrativeSimilarity("Pepe", "Bonk")).toBeLessThan(0.4);
  });
  it("detects clone edges above threshold", () => {
    const edges = detectCloneEdges(
      { mint: "A", name: "Pepe", symbol: "PEPE" },
      [{ mint: "B", name: "Pepe", symbol: "PEPE" }, { mint: "C", name: "Doge", symbol: "DOGE" }],
    );
    expect(edges[0].mint).toBe("B");
    expect(edges[0].relationship).toBe("clone_of");
    expect(edges.some((e) => e.mint === "C")).toBe(false);
  });

  it("entropy: even distribution near 100, concentrated near 0", () => {
    expect(holderEntropyScore([10, 10, 10, 10])).toBeGreaterThan(95);
    expect(holderEntropyScore([1000, 1, 1, 1])).toBeLessThan(40);
  });
  it("liquidity stability: stable high, volatile low", () => {
    expect(liquidityStabilityIndex([1000, 1010, 990, 1005])).toBeGreaterThan(80);
    expect(liquidityStabilityIndex([1000, 50, 2000, 10])).toBeLessThan(50);
  });
  it("hype decay high when volume collapses", () => {
    const s = mk([{ price: 5, volume: 500 }, { price: 4, volume: 400 }, { price: 2, volume: 5 }]);
    expect(hypeDecayScore(s)).toBeGreaterThan(40);
  });

  it("explanations produce strings", () => {
    expect(whyTrending({ velocity: 80, priceChange24h: 50, volume24hUsd: 200000, scans24h: 20 }).length).toBeGreaterThan(5);
    expect(whyExists({ symbol: "OG", isOg: true, narrative: "pepe" })).toContain("original");
    expect(normalizeNarrative("Pe!pe 2.0")).toBe("pepe20");
  });
});
