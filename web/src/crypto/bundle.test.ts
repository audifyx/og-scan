import { describe, expect, it } from "vitest";
import {
  clusterByFundingSource,
  clusterByBuyWindow,
  mergeClusters,
  bundleRiskFor,
  summarizeBundleAnalysis,
  bundleToVisualData,
  type HolderTrace,
  type BundleAnalysis,
} from "./bundle";

function trace(partial: Partial<HolderTrace> & { address: string }): HolderTrace {
  return {
    tokenAccount: null,
    supplyPct: 1,
    firstBuyAtMs: null,
    fundingSource: null,
    fundingChain: [partial.address],
    traced: true,
    traceNote: null,
    devLinked: false,
    viaAmm: false,
    ...partial,
  };
}

const T0 = 1_700_000_000_000;

describe("clusterByFundingSource", () => {
  it("groups holders funded by the same source", () => {
    const traces = [
      trace({ address: "A", supplyPct: 4, fundingSource: "F1", fundingChain: ["A", "F1"] }),
      trace({ address: "B", supplyPct: 3, fundingSource: "F1", fundingChain: ["B", "F1"] }),
      trace({ address: "C", supplyPct: 2, fundingSource: "F2", fundingChain: ["C", "F2"] }),
    ];
    const clusters = clusterByFundingSource(traces);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].fundingSource).toBe("F1");
    expect(clusters[0].members.map((m) => m.address).sort()).toEqual(["A", "B"]);
    expect(clusters[0].supplyPct).toBe(7);
    expect(clusters[0].kind).toBe("funding");
  });

  it("ignores single holders and self-funding", () => {
    const traces = [
      trace({ address: "A", fundingSource: "F1" }),
      trace({ address: "B", fundingSource: "B" }),
      trace({ address: "C", fundingSource: null, viaAmm: true }),
    ];
    expect(clusterByFundingSource(traces)).toHaveLength(0);
  });

  it("never invents a cluster from AMM-swap receipts", () => {
    const traces = [
      trace({ address: "A", fundingSource: null, viaAmm: true }),
      trace({ address: "B", fundingSource: null, viaAmm: true }),
    ];
    expect(clusterByFundingSource(traces)).toHaveLength(0);
  });
});

describe("clusterByBuyWindow", () => {
  it("groups first buys inside 60s", () => {
    const traces = [
      trace({ address: "A", firstBuyAtMs: T0 }),
      trace({ address: "B", firstBuyAtMs: T0 + 20_000 }),
      trace({ address: "C", firstBuyAtMs: T0 + 59_000 }),
      trace({ address: "D", firstBuyAtMs: T0 + 300_000 }),
    ];
    const clusters = clusterByBuyWindow(traces);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.address).sort()).toEqual(["A", "B", "C"]);
    expect(clusters[0].timeSpanSeconds).toBe(59);
    expect(clusters[0].kind).toBe("window");
  });

  it("ignores holders with unknown first-buy time", () => {
    const traces = [
      trace({ address: "A", firstBuyAtMs: T0 }),
      trace({ address: "B", firstBuyAtMs: null, traced: false }),
    ];
    expect(clusterByBuyWindow(traces)).toHaveLength(0);
  });

  it("does not chain-drift across a long series", () => {
    // A, B, C each 50s apart: A+B in one window, C outside A's window.
    const traces = [
      trace({ address: "A", firstBuyAtMs: T0 }),
      trace({ address: "B", firstBuyAtMs: T0 + 50_000 }),
      trace({ address: "C", firstBuyAtMs: T0 + 100_000 }),
    ];
    const clusters = clusterByBuyWindow(traces);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.address).sort()).toEqual(["A", "B"]);
  });
});

describe("mergeClusters", () => {
  it("merges funding + window clusters over the same wallets", () => {
    const traces = [
      trace({ address: "A", supplyPct: 4, fundingSource: "F1", firstBuyAtMs: T0 }),
      trace({ address: "B", supplyPct: 3, fundingSource: "F1", firstBuyAtMs: T0 + 10_000 }),
    ];
    const merged = mergeClusters([
      ...clusterByFundingSource(traces),
      ...clusterByBuyWindow(traces),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe("funding+window");
    expect(merged[0].fundingSource).toBe("F1");
    expect(merged[0].supplyPct).toBe(7);
  });
});

describe("bundleRiskFor", () => {
  it("returns unknown when nothing was observed", () => {
    expect(bundleRiskFor(null, null)).toBe("unknown");
  });
  it("returns none for zero bundled and zero dev-linked", () => {
    expect(bundleRiskFor(0, 0)).toBe("none");
  });
  it("steps up with bundled supply", () => {
    expect(bundleRiskFor(4, 0)).toBe("low");
    expect(bundleRiskFor(15, 0)).toBe("medium");
    expect(bundleRiskFor(30, 0)).toBe("high");
  });
  it("dev-linked supply forces the flag up on its own", () => {
    expect(bundleRiskFor(0, 10)).toBe("medium");
    expect(bundleRiskFor(2, 25)).toBe("high");
  });
});

describe("summarizeBundleAnalysis", () => {
  it("reports complete + bundled % for fully traced holders", () => {
    const a = summarizeBundleAnalysis({
      mint: "MINT",
      traces: [
        trace({ address: "A", supplyPct: 6, fundingSource: "F1", firstBuyAtMs: T0 }),
        trace({ address: "B", supplyPct: 5, fundingSource: "F1", firstBuyAtMs: T0 + 5_000 }),
        trace({ address: "C", supplyPct: 2, fundingSource: null, viaAmm: true }),
      ],
      holdersTotal: 3,
      topHoldersSupplyPct: 13,
      creator: "DEV",
      mintAuthority: null,
      creatorKnown: true,
    });
    expect(a.state).toBe("complete");
    expect(a.bundledSupplyPct).toBe(11);
    expect(a.clusterCount).toBe(1);
    expect(a.risk).toBe("low");
    expect(a.devLinkedPct).toBe(0);
  });

  it("reports unknown — never a made-up number — when holders cannot be read", () => {
    const a = summarizeBundleAnalysis({
      mint: "MINT",
      traces: [],
      holdersTotal: 0,
      topHoldersSupplyPct: null,
      creatorKnown: false,
    });
    expect(a.state).toBe("unknown");
    expect(a.bundledSupplyPct).toBeNull();
    expect(a.risk).toBe("unknown");
    expect(a.reason).toMatch(/unavailable/i);
  });

  it("reports partial when some holders are untraced, and labels it", () => {
    const a = summarizeBundleAnalysis({
      mint: "MINT",
      traces: [
        trace({ address: "A", supplyPct: 6, fundingSource: "F1" }),
        trace({ address: "B", supplyPct: 5, fundingSource: "F1" }),
        trace({
          address: "C",
          supplyPct: 9,
          traced: false,
          traceNote: "history too deep",
          fundingSource: null,
        }),
      ],
      holdersTotal: 3,
      topHoldersSupplyPct: 20,
      creatorKnown: true,
    });
    expect(a.state).toBe("partial");
    expect(a.holdersUntraced).toBe(1);
    expect(a.untracedAddresses).toEqual(["C"]);
    // Bundled % covers traced holders only — the untraced 9% is NOT counted.
    expect(a.bundledSupplyPct).toBe(11);
    expect(a.reason).toMatch(/1 of 3/);
  });

  it("reports dev-linked % as null — not 0 — when the creator is unknown", () => {
    const a = summarizeBundleAnalysis({
      mint: "MINT",
      traces: [trace({ address: "A", supplyPct: 6 })],
      holdersTotal: 1,
      topHoldersSupplyPct: 6,
      creatorKnown: false,
    });
    expect(a.devLinkedPct).toBeNull();
    expect(a.creatorKnown).toBe(false);
  });

  it("flags dev-linked holders and their funding", () => {
    const a = summarizeBundleAnalysis({
      mint: "MINT",
      traces: [
        trace({ address: "DEV", supplyPct: 12, fundingSource: null }),
        trace({ address: "P", supplyPct: 8, fundingSource: "DEV", devLinked: true }),
      ],
      holdersTotal: 2,
      topHoldersSupplyPct: 20,
      creator: "DEV",
      mintAuthority: null,
      creatorKnown: true,
    });
    expect(a.devLinkedPct).toBe(8);
    expect(a.devLinkedWallets.map((w) => w.address)).toEqual(["P"]);
    expect(a.risk).toBe("low");
  });
});

describe("bundleToVisualData", () => {
  it("maps a live analysis onto BundleVisual props", () => {
    const a = summarizeBundleAnalysis({
      mint: "MINT",
      traces: [
        trace({ address: "A", supplyPct: 6, fundingSource: "F1", firstBuyAtMs: T0 }),
        trace({ address: "B", supplyPct: 5, fundingSource: "F1", firstBuyAtMs: T0 + 5_000 }),
      ],
      holdersTotal: 2,
      topHoldersSupplyPct: 11,
      creatorKnown: true,
    });
    const v = bundleToVisualData(a as BundleAnalysis);
    expect(v.totalBundlePct).toBe(11);
    expect(v.bundles).toHaveLength(1);
    expect(v.bundles[0].fundingSource).toBe("F1");
    expect(v.bundles[0].wallets).toHaveLength(2);
  });

  it("returns empty — not a fake zero-risk claim — for unknown analyses", () => {
    const v = bundleToVisualData(null);
    expect(v).toEqual({ bundles: [], totalBundlePct: 0 });
  });
});

// ── Team A wave 3: shared pure helpers ───────────────────────────────────────
import {
  convictionLabel,
  walletAgeLabel,
  slippageForSize,
  simulateDevSell,
  entryExitFor1Pct,
  detectWashTrading,
  detectChartPatterns,
  volatilityFromCandles,
  bundleDecayTrend,
  dangerScoreForOutcome,
  usdToDropPricePct,
  KNOWN_CEX_HOT_WALLETS,
} from "./bundle";

describe("convictionLabel / walletAgeLabel", () => {
  it("diamond >= 30d, paper < 30d, unknown without a time", () => {
    expect(convictionLabel(30)).toBe("diamond");
    expect(convictionLabel(29)).toBe("paper");
    expect(convictionLabel(null)).toBe("unknown");
    expect(walletAgeLabel(30)).toBe("aged");
    expect(walletAgeLabel(5)).toBe("fresh");
    expect(walletAgeLabel(null)).toBe("unknown");
  });
});

describe("slippageForSize", () => {
  it("size/(liq+size); nulls on unknown depth", () => {
    expect(slippageForSize(1000, 9000)).toEqual({ buyPct: 10, sellPct: 10 });
    expect(slippageForSize(1000, null)).toEqual({ buyPct: null, sellPct: null });
    expect(slippageForSize(1000, 0)).toEqual({ buyPct: null, sellPct: null });
  });
});

describe("simulateDevSell", () => {
  it("holding value + CPAMM impact; null when inputs missing", () => {
    const s = simulateDevSell({ devHoldingPct: 25, marketCapUsd: 400_000, liquidityUsd: 100_000 });
    expect(s?.devHoldingUsd).toBe(100_000);
    expect(s?.estPriceImpactPct).toBe(50);
    expect(simulateDevSell({ devHoldingPct: 25, marketCapUsd: 400_000, liquidityUsd: null })).toBeNull();
  });
});

describe("entryExitFor1Pct", () => {
  it("inverts the 1% CPAMM move", () => {
    const p = entryExitFor1Pct(9900);
    expect(p.maxBuyUsdFor1Pct).toBeCloseTo(100, 1);
    expect(p.depthUsd).toBe(9900);
    expect(entryExitFor1Pct(null).maxBuyUsdFor1Pct).toBeNull();
  });
});

describe("detectWashTrading", () => {
  it("no tape → score 0, no wash pattern observed", () => {
    expect(detectWashTrading([])).toEqual({ score: 0, pairs: [], verdict: "no wash pattern observed" });
  });
  it("different wallets never pair up", () => {
    const w = detectWashTrading([
      { wallet: "A", time: T0, sizeUsd: 500, side: "buy" },
      { wallet: "B", time: T0 + 1000, sizeUsd: 500, side: "sell" },
    ]);
    expect(w.pairs).toEqual([]);
  });
});

describe("detectChartPatterns", () => {
  const candle = (o: number, h: number, l: number, c: number, at = T0) => ({ open: o, high: h, low: l, close: c, at });
  it("doji fires when open ≈ close", () => {
    const out = detectChartPatterns([candle(100, 110, 90, 100.5)]);
    expect(out.map((p) => p.type)).toContain("doji");
  });
  it("hammer fires on a long lower shadow", () => {
    const out = detectChartPatterns([candle(100, 102, 80, 101)]);
    expect(out.map((p) => p.type)).toContain("hammer");
  });
  it("bullish engulfing needs a full-body cover", () => {
    const out = detectChartPatterns([candle(100, 101, 99, 98), candle(97, 105, 96, 103)]);
    expect(out.map((p) => p.type)).toContain("bullish-engulfing");
  });
  it("three white soldiers need three rising closes", () => {
    const out = detectChartPatterns([candle(90, 92, 89, 91), candle(91, 94, 90, 93), candle(93, 96, 92, 95)]);
    expect(out.map((p) => p.type)).toContain("three-white-soldiers");
  });
  it("no candles → no patterns, never invented", () => {
    expect(detectChartPatterns([])).toEqual([]);
  });
});

describe("volatilityFromCandles", () => {
  it("range / mean close; nulls without candles", () => {
    const v = volatilityFromCandles(
      [{ high: 110, low: 90, close: 100 }],
      [{ high: 120, low: 80, close: 100 }],
    );
    expect(v.volatilityPct24h).toBe(20);
    expect(v.volatilityPct7d).toBe(40);
    expect(volatilityFromCandles([], []).volatilityPct24h).toBeNull();
  });
});

describe("bundleDecayTrend", () => {
  it("< 2 snapshots → unknown; ±10% bands decide growing/unwinding/flat", () => {
    expect(bundleDecayTrend([{ at: 1, bundledPct: 20 }])).toBe("unknown");
    expect(bundleDecayTrend([{ at: 1, bundledPct: 20 }, { at: 2, bundledPct: 25 }])).toBe("growing");
    expect(bundleDecayTrend([{ at: 1, bundledPct: 20 }, { at: 2, bundledPct: 15 }])).toBe("unwinding");
    expect(bundleDecayTrend([{ at: 1, bundledPct: 20 }, { at: 2, bundledPct: 21 }])).toBe("flat");
  });
});

describe("dangerScoreForOutcome", () => {
  it("rugged 100 / dead 60 / alive 20 / unknown null (excluded)", () => {
    expect(dangerScoreForOutcome("rugged")).toBe(100);
    expect(dangerScoreForOutcome("dead")).toBe(60);
    expect(dangerScoreForOutcome("alive")).toBe(20);
    expect(dangerScoreForOutcome("unknown")).toBeNull();
  });
});

describe("usdToDropPricePct", () => {
  it("(liq/2) * d/(1-d); null on unknown depth", () => {
    expect(usdToDropPricePct(100_000, 50)).toBe(50_000);
    expect(usdToDropPricePct(100_000, 10)).toBeCloseTo(5555.56, 1);
    expect(usdToDropPricePct(null, 10)).toBeNull();
  });
});

describe("KNOWN_CEX_HOT_WALLETS", () => {
  it("empty by design — no verified addresses exist to embed", () => {
    expect(KNOWN_CEX_HOT_WALLETS).toEqual([]);
  });
});
