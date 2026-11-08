import { describe, expect, it } from "vitest";
import {
  ageLabel,
  authorityVerdict,
  cloneVerdict,
  computeOgScore,
  concentrationBand,
  honeypotChecks,
  lpLockState,
  ogScoreBand,
} from "./hooks/useTokenIntel";
import {
  normalizeDexPair,
  normalizeDexPairs,
  normalizeResearch,
  normalizeTokenPayload,
} from "./api/client";

describe("authorityVerdict", () => {
  it("revoked → pass", () => {
    expect(authorityVerdict(true)).toEqual({ state: "pass", label: "Revoked" });
  });
  it("live → fail", () => {
    expect(authorityVerdict(false)).toEqual({ state: "fail", label: "Live" });
  });
  it("null / undefined → unknown, never invented", () => {
    expect(authorityVerdict(null).state).toBe("unknown");
    expect(authorityVerdict(undefined).state).toBe("unknown");
  });
});

describe("concentrationBand", () => {
  it("bands by top-10 share", () => {
    expect(concentrationBand(12).band).toBe("Distributed");
    expect(concentrationBand(20).band).toBe("Distributed");
    expect(concentrationBand(21).band).toBe("Moderate");
    expect(concentrationBand(35).band).toBe("Moderate");
    expect(concentrationBand(36).band).toBe("Concentrated");
    expect(concentrationBand(50).band).toBe("Concentrated");
    expect(concentrationBand(51).band).toBe("Highly concentrated");
    expect(concentrationBand(90).state).toBe("fail");
  });
  it("null → Unknown", () => {
    expect(concentrationBand(null)).toEqual({ band: "Unknown", state: "unknown", label: "Unknown" });
  });
});

describe("lpLockState", () => {
  it("thresholds", () => {
    expect(lpLockState(100).state).toBe("pass");
    expect(lpLockState(90).state).toBe("pass");
    expect(lpLockState(75).state).toBe("warn");
    expect(lpLockState(50).state).toBe("warn");
    expect(lpLockState(10).state).toBe("warn");
    expect(lpLockState(0).state).toBe("fail");
    expect(lpLockState(null).state).toBe("unknown");
    expect(lpLockState(undefined).state).toBe("unknown");
  });
});

describe("honeypotChecks", () => {
  it("cannot sell → fail with honeypot-style label", () => {
    const checks = honeypotChecks({ canBuy: true, canSell: false });
    expect(checks.some((c) => c.id === "can-sell" && c.state === "fail")).toBe(true);
    expect(checks.some((c) => c.label.includes("honeypot"))).toBe(true);
  });
  it("clean round trip → pass, cheap cost", () => {
    const checks = honeypotChecks({ canBuy: true, canSell: true, roundTripLossPct: 2 });
    expect(checks.find((c) => c.id === "can-sell")?.state).toBe("pass");
    expect(checks.find((c) => c.id === "round-trip")?.state).toBe("pass");
  });
  it("round-trip ≥35% → fail", () => {
    const checks = honeypotChecks({ canBuy: true, canSell: true, roundTripLossPct: 40 });
    expect(checks.find((c) => c.id === "round-trip")?.state).toBe("fail");
  });
  it("no safety payload → unknown, not pass", () => {
    const checks = honeypotChecks(null);
    expect(checks).toHaveLength(1);
    expect(checks[0].state).toBe("unknown");
  });
});

describe("cloneVerdict", () => {
  it("no clones → pass", () => {
    expect(cloneVerdict([], 100_000).state).toBe("pass");
  });
  it("clones but none bigger → warn", () => {
    const v = cloneVerdict([{ mint: "x", mcap: 1_000 }], 100_000);
    expect(v.state).toBe("warn");
    expect(v.biggerClone).toBe(false);
  });
  it("a bigger same-name clone → fail", () => {
    const v = cloneVerdict([{ mint: "x", mcap: 5_000_000 }], 100_000);
    expect(v.state).toBe("fail");
    expect(v.biggerClone).toBe(true);
  });
  it("no research data → unknown", () => {
    expect(cloneVerdict(undefined, 100_000).state).toBe("unknown");
    expect(cloneVerdict(null, 100_000).state).toBe("unknown");
  });
});

describe("ageLabel", () => {
  it("formats days and months", () => {
    expect(ageLabel(0, null)).toBe("Less than a day old");
    expect(ageLabel(1, null)).toBe("1 day old");
    expect(ageLabel(12, null)).toBe("12 days old");
    expect(ageLabel(60, null)).toBe("2 months old");
  });
  it("falls back to createdAt, else Unknown", () => {
    expect(ageLabel(null, new Date(Date.now() - 3 * 86_400_000).toISOString())).toBe("3 days old");
    expect(ageLabel(null, null)).toBe("Unknown");
  });
});

describe("ogScoreBand", () => {
  it("thresholds", () => {
    expect(ogScoreBand(95).band).toBe("Excellent");
    expect(ogScoreBand(80).band).toBe("Strong");
    expect(ogScoreBand(70).band).toBe("Good");
    expect(ogScoreBand(60).band).toBe("Fair");
    expect(ogScoreBand(40).band).toBe("Risky");
    expect(ogScoreBand(20).band).toBe("High risk");
    expect(ogScoreBand(5).band).toBe("Critical");
    expect(ogScoreBand(null).band).toBe("Unknown");
  });
});

describe("computeOgScore", () => {
  const healthy = {
    mintRenounced: true,
    freezeRenounced: true,
    lpLockedPct: 95,
    rugged: false,
    liquidityUsd: 250_000,
    marketCapUsd: 800_000,
    volume24h: 120_000,
    top10Pct: 18,
    totalHolders: 4_200,
    whaleCount: 2,
    canBuy: true,
    canSell: true,
    roundTripLossPct: 2,
    devSold: false,
    devSerial: false,
    creatorTokensCount: 1,
    ageDays: 45,
    cloneCount: 0,
    biggerClone: false,
  };

  it("scores a healthy token high", () => {
    const r = computeOgScore(healthy);
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThanOrEqual(80);
    expect(["Excellent", "Strong"]).toContain(r.band);
    expect(r.caps).toHaveLength(0);
  });

  it("all-unknown input → null score, unknowns listed, nothing invented", () => {
    const r = computeOgScore({});
    expect(r.score).toBeNull();
    expect(r.band).toBe("Unknown");
    expect(r.unknowns.length).toBeGreaterThan(0);
    expect(r.categories.every((c) => c.points === 0)).toBe(true);
  });

  it("cannot sell caps at 20 (honeypot)", () => {
    const r = computeOgScore({ ...healthy, canSell: false });
    expect(r.score).toBeLessThanOrEqual(20);
    expect(r.caps.some((c) => c.includes("sell route"))).toBe(true);
  });

  it("rugged caps at 15", () => {
    const r = computeOgScore({ ...healthy, rugged: true });
    expect(r.score).toBeLessThanOrEqual(15);
    expect(r.caps.some((c) => c.includes("rugged"))).toBe(true);
  });

  it("a bigger same-name clone caps at 30", () => {
    const r = computeOgScore({ ...healthy, cloneCount: 2, biggerClone: true });
    expect(r.score).toBeLessThanOrEqual(30);
  });

  it("live authorities + concentrated holders + dev exit drag the score down", () => {
    const r = computeOgScore({
      ...healthy,
      mintRenounced: false,
      freezeRenounced: false,
      top10Pct: 78,
      devSold: true,
      lpLockedPct: 0,
    });
    expect(r.score!).toBeLessThan(60);
    expect(r.categories.find((c) => c.id === "contract")!.points).toBe(0);
    expect(r.categories.find((c) => c.id === "holders")!.points).toBeLessThan(6);
  });

  it("unknown LP lock scores 0 for that part but does not fail the token", () => {
    const r = computeOgScore({ ...healthy, lpLockedPct: null });
    expect(r.unknowns).toContain("LP lock status");
    expect(r.score!).toBeGreaterThanOrEqual(70);
  });
});

describe("normalizeDexPair / normalizeDexPairs", () => {
  const rawPair = {
    chainId: "solana",
    dexId: "raydium",
    pairAddress: "pair1",
    url: "https://dexscreener.com/solana/pair1",
    priceUsd: "0.001",
    marketCap: 500_000,
    fdv: 1_000_000,
    liquidity: { usd: 120_000 },
    volume: { m5: 100, h1: 2_000, h6: 9_000, h24: 40_000 },
    txns: { m5: { buys: 3, sells: 1 }, h1: { buys: 40, sells: 30 }, h6: { buys: 200, sells: 180 }, h24: { buys: 900, sells: 850 } },
    priceChange: { m5: 1.2, h1: -3, h6: 5, h24: 12 },
    pairCreatedAt: 1_700_000_000_000,
    quoteToken: { symbol: "SOL" },
    info: {
      websites: [{ url: "https://example.com" }],
      socials: [
        { type: "twitter", url: "https://x.com/example" },
        { type: "telegram", url: "https://t.me/example" },
      ],
    },
    baseToken: { address: "MINT11111111111111111111111111111111111111", name: "Example", symbol: "EX" },
  };

  it("maps a raw DexScreener pair into windows + socials", () => {
    const p = normalizeDexPair(rawPair);
    expect(p?.dexId).toBe("raydium");
    expect(p?.volumeM5).toBe(100);
    expect(p?.volumeH1).toBe(2_000);
    expect(p?.volumeH24).toBe(40_000);
    expect(p?.txnsM5Buys).toBe(3);
    expect(p?.txnsH24Sells).toBe(850);
    expect(p?.changeH24).toBe(12);
    expect(p?.websites).toEqual(["https://example.com"]);
    expect(p?.socials?.map((s) => s.type)).toEqual(["twitter", "telegram"]);
  });

  it("keeps only Solana pairs for the mint, deepest liquidity first", () => {
    const otherChain = { ...rawPair, chainId: "ethereum" };
    const otherMint = { ...rawPair, pairAddress: "pair2", baseToken: { address: "OTHER1111111111111111111111111111111111" }, liquidity: { usd: 999_999 } };
    const shallow = { ...rawPair, pairAddress: "pair3", liquidity: { usd: 10 } };
    const out = normalizeDexPairs(
      { pairs: [otherChain, otherMint, shallow, rawPair] },
      "MINT11111111111111111111111111111111111111",
    );
    expect(out.map((p) => p.pairAddress)).toEqual(["pair1", "pair3"]);
  });

  it("returns [] for unusable payloads", () => {
    expect(normalizeDexPairs(null, "MINT")).toEqual([]);
    expect(normalizeDexPairs({}, "MINT")).toEqual([]);
    expect(normalizeDexPair(null)).toBeNull();
  });
});

describe("normalizeResearch", () => {
  it("maps clones + links + launch", () => {
    const r = normalizeResearch({
      ok: true,
      meta: {
        description: "A test token",
        links: { website: "https://example.com", twitter: "https://x.com/example", dex: "https://dexscreener.com/solana/MINT" },
      },
      launch: { deployer: "DEV111", platform: "pump.fun", launchTime: 1_700_000_000_000, graduated: true },
      clones: [
        { mint: "CLONE1", name: "Example", symbol: "EX", mcap: 9_000_000, volume24h: 5_000, liquidity: 50_000, launchTime: 1_699_000_000_000, dexUrl: "https://dexscreener.com/solana/CLONE1", price: 0.02 },
      ],
    });
    expect(r?.clones).toHaveLength(1);
    expect(r?.clones?.[0].mcap).toBe(9_000_000);
    expect(r?.links?.website).toBe("https://example.com");
    expect(r?.launch?.platform).toBe("pump.fun");
    expect(r?.description).toBe("A test token");
  });

  it("returns null for unusable payloads, [] clones when absent", () => {
    expect(normalizeResearch(null)).toBeNull();
    expect(normalizeResearch({ ok: true })?.clones).toEqual([]);
  });
});

describe("normalizeTokenPayload (extended fields)", () => {
  it("captures pairs, socials, ATH, fdv, age, holder count from the token route", () => {
    const raw = {
      mint: "MINT11111111111111111111111111111111111111",
      token: {
        mint: "MINT11111111111111111111111111111111111111",
        symbol: "EX",
        name: "Example",
        priceUsd: 0.001,
        marketCap: 500_000,
        fdv: 1_000_000,
        liquidity: 120_000,
        volume: 40_000,
        holderCount: 1234,
        createdAt: "2026-10-01T00:00:00.000Z",
        ageDays: 33,
        change5m: 1.2,
        change1h: -3,
        change24h: 12,
        firstPool: { id: "pair1" },
      },
      meta: {
        socials: { website: "https://example.com", twitter: "https://x.com/example" },
        pairDexId: "raydium",
        athPrice: 0.01,
        athMcap: 5_000_000,
      },
      pairs: [
        { dex: "raydium", address: "pair1", priceUsd: 0.001, liquidity: 120_000, volume24h: 40_000, change24h: 12, txnsBuys: 900, txnsSells: 850 },
      ],
      athPrice: 0.01,
      athMcap: 5_000_000,
    };
    const t = normalizeTokenPayload(raw, "MINT11111111111111111111111111111111111111");
    expect(t?.fdv).toBe(1_000_000);
    expect(t?.holderCount).toBe(1234);
    expect(t?.ageDays).toBe(33);
    expect(t?.change5m).toBe(1.2);
    expect(t?.athPrice).toBe(0.01);
    expect(t?.athMcap).toBe(5_000_000);
    expect(t?.pairDexId).toBe("raydium");
    expect(t?.socials?.website).toBe("https://example.com");
    expect(t?.pairs).toHaveLength(1);
    expect(t?.pairs?.[0].dexId).toBe("raydium");
    expect(t?.pairs?.[0].txnsH24Buys).toBe(900);
    expect(t?.firstPool?.id).toBe("pair1");
  });

  it("leaves extended fields null/undefined when the backend omits them", () => {
    const t = normalizeTokenPayload({ mint: "MINT", token: { symbol: "EX" } }, "MINT");
    expect(t?.fdv).toBeUndefined();
    expect(t?.holderCount).toBeNull();
    expect(t?.socials).toBeUndefined();
    expect(t?.pairs).toBeUndefined();
    expect(t?.athPrice).toBeNull();
  });
});

describe("coordinator adapters — W1/W2 raw shapes → scoring inputs", () => {
  it("adaptBundleAnalysis maps risk + largest cluster, unknown → unavailable", async () => {
    const { adaptBundleAnalysis } = await import("./hooks/useTokenIntel");
    const raw = {
      mint: "M",
      state: "complete",
      reason: null,
      analyzedAt: new Date().toISOString(),
      holdersTotal: 100,
      holdersAnalyzed: 20,
      holdersTraced: 18,
      holdersUntraced: 2,
      untracedAddresses: [],
      topHoldersSupplyPct: 40,
      bundledSupplyPct: 32,
      clusters: [
        { id: "c1", kind: "funding", fundingSource: "SRC", fundingChain: [], members: [], supplyPct: 22, timeSpanSeconds: 30, windowStartMs: null, windowEndMs: null, devLinked: false, sourceBehindOtherLaunches: false, sourceOtherLaunches: 0, evidence: "x" },
        { id: "c2", kind: "window", fundingSource: null, fundingChain: [], members: [], supplyPct: 10, timeSpanSeconds: 45, windowStartMs: null, windowEndMs: null, devLinked: false, sourceBehindOtherLaunches: false, sourceOtherLaunches: 0, evidence: "x" },
      ],
      clusterCount: 2,
      devLinkedPct: 0,
      devLinkedWallets: [],
      creator: null,
      mintAuthority: null,
      creatorKnown: false,
      risk: "high",
      fundingSources: ["SRC"],
    } as any;
    const a = adaptBundleAnalysis(raw);
    expect(a?.available).toBe(true);
    expect(a?.bundledSupplyPct).toBe(32);
    expect(a?.clusterCount).toBe(2);
    expect(a?.largestClusterPct).toBe(22);
    expect(a?.bundleRisk).toBe("high");
    expect(adaptBundleAnalysis({ ...raw, state: "unknown", risk: "unknown" } as never)?.available).toBe(false);
    expect(adaptBundleAnalysis(null)).toBeNull();
  });

  it("adaptXIntel takes the linked handle, never invents mentions/sentiment", async () => {
    const { adaptXIntel } = await import("./hooks/useTokenIntel");
    const raw = {
      mint: "M",
      linkedAccount: { status: "available", value: { handle: "orbitx_wrld", url: "https://x.com/orbitx_wrld", sources: ["dexscreener", "geckoterminal"], agreement: "agree" }, source: "dexscreener", fetchedAt: new Date().toISOString() },
      profile: { status: "unavailable", reason: "no_bearer_token", detail: "no token", fetchedAt: new Date().toISOString() },
      mentions: { status: "unavailable", reason: "no_search_source", fetchedAt: new Date().toISOString() },
      kolActivity: { status: "unavailable", reason: "no_kol_source", fetchedAt: new Date().toISOString() },
      sentiment: { status: "unavailable", reason: "no_text_source", fetchedAt: new Date().toISOString() },
      fetchedAt: new Date().toISOString(),
    } as never;
    const a = adaptXIntel(raw);
    expect(a?.availability).toBe("available");
    expect(a?.handle).toBe("orbitx_wrld");
    expect(a?.followers).toBeNull();
    expect(a?.mentions24h).toBeNull();
    expect(a?.sentiment).toBeNull();
    expect(a?.accountAgeDays).toBeNull();
    expect(adaptXIntel(null)).toBeNull();
  });

  it("computeOgScore applies bundle/X/source adjustments, unavailable adjusts 0", async () => {
    const { computeOgScore } = await import("./hooks/useTokenIntel");
    const base = {
      mintRenounced: true, freezeRenounced: true, lpLockedPct: 100, rugged: false,
      liquidityUsd: 200_000, marketCapUsd: 1_000_000, volume24h: 50_000,
      top10Pct: 10, totalHolders: 2000, whaleCount: 0, canBuy: true, canSell: true,
      roundTripLossPct: 2, devSold: false, devSerial: false, creatorTokensCount: 1,
      ageDays: 40, cloneCount: 0, biggerClone: false,
    };
    const clean = computeOgScore(base);
    expect(clean.score).not.toBeNull();
    const bundled = computeOgScore({
      ...base,
      bundle: { available: true, bundledSupplyPct: 35, clusterCount: 3, largestClusterPct: 20, bundleRisk: "high", note: null },
    });
    expect(bundled.score).toBe((clean.score ?? 0) - 5);
    expect(bundled.adjustments).toEqual([{ id: "bundle", label: "Bundle risk -5", points: -5 }]);
    const unavailable = computeOgScore({
      ...base,
      bundle: { available: false, bundledSupplyPct: null, clusterCount: null, largestClusterPct: null, bundleRisk: null, note: "scan failed" },
      x: { availability: "unavailable", handle: null, followers: null, mentions24h: null, kolMentions: null, sentiment: null, accountAgeDays: null },
    });
    expect(unavailable.score).toBe(clean.score);
    expect(unavailable.adjustments).toEqual([]);
  });
});

// ── Team A wave 3 (B2–B6) builders ────────────────────────────────────────────
import {
  buildSniperRadar,
  buildLiquidityHealth,
  buildDevFingerprint,
  buildRugTimeline,
  buildTokenDna,
  buildGraduation,
  buildContractDiff,
  buildCopycats,
  buildHolderConviction,
  buildWhaleLabels,
  buildRugLeaderboard,
  buildFreshWalletRadar,
  buildLpMigration,
  buildMetadataAudit,
  buildEntryExitPlanner,
  buildRugAutopsy,
  buildDevWalletWatch,
  buildInsiders,
  buildUnlockSchedule,
  buildWashTrading,
  buildSlippageEstimator,
  buildHoneypotFlip,
  buildAuthorityChange,
  buildCostBasis,
  buildCexDeposits,
  buildDevSellSimulator,
} from "./hooks/useTokenIntel";
import type { HolderTrace } from "./bundle";

const T0 = 1_700_000_000_000;
function w3trace(partial: Partial<HolderTrace> & { address: string }): HolderTrace {
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

describe("buildSniperRadar", () => {
  it("flags first buys within 60s of pair creation, nothing else", () => {
    const traces = [
      w3trace({ address: "S1", firstBuyAtMs: T0 + 10_000, supplyPct: 2 }),
      w3trace({ address: "S2", firstBuyAtMs: T0 + 61_000, supplyPct: 2 }),
      w3trace({ address: "S3", firstBuyAtMs: null, supplyPct: 2 }),
    ];
    const out = buildSniperRadar(traces, T0);
    expect(out.map((s) => s.wallet)).toEqual(["S1"]);
    expect(out[0].firstBuyBlock).toBeNull();
    expect(out[0].amountSol).toBeNull();
    expect(out[0].dumped).toBeNull();
  });
  it("no pair creation time → empty, never guessed", () => {
    expect(buildSniperRadar([w3trace({ address: "A", firstBuyAtMs: T0 })], null)).toEqual([]);
  });
});

describe("buildLiquidityHealth", () => {
  it(">=90% locked → dev cannot pull; 0% → yes; unknown → unknown", () => {
    expect(buildLiquidityHealth(50_000, 95).canDevPull).toBe("no");
    expect(buildLiquidityHealth(50_000, 0).canDevPull).toBe("yes");
    expect(buildLiquidityHealth(50_000, null).canDevPull).toBe("unknown");
    expect(buildLiquidityHealth(50_000, 50).canDevPull).toBe("unknown");
  });
  it("burned share and lock expiry are always null (unobserved)", () => {
    const h = buildLiquidityHealth(50_000, 95);
    expect(h.burnedPct).toBeNull();
    expect(h.lockExpiry).toBeNull();
    expect(h.lpDepthUsd).toBe(50_000);
  });
});

describe("buildDevFingerprint", () => {
  it("one signal caps at medium; two independent signals promote to high", () => {
    const one = buildDevFingerprint({
      dev: { serial: true, tokensCreated: 3 },
      bundle: null,
      sameDev: null,
    });
    expect(one).toHaveLength(1);
    expect(one[0].confidence).toBe("medium");
    const two = buildDevFingerprint({
      dev: { serial: true, tokensCreated: 3 },
      bundle: { devLinkedPct: 12, devLinkedWallets: [{ address: "D", supplyPct: 12, fundingSource: null, via: "creator" }] } as never,
      sameDev: null,
    });
    expect(two.every((e) => e.confidence === "high")).toBe(true);
  });
  it("no signals → no fingerprint", () => {
    expect(buildDevFingerprint({ dev: null, bundle: null, sameDev: null })).toEqual([]);
  });
});

describe("buildRugTimeline", () => {
  it("critical flags first; every entry dateless (time unknown)", () => {
    const out = buildRugTimeline({
      forensics: { safetyFlags: { rugged: true, mintRenounced: false }, dev: { serial: true } },
      safety: { canSell: false },
      bundle: null,
      sameDev: null,
    });
    expect(out[0].severity).toBe("critical");
    expect(out.every((e) => e.at === null)).toBe(true);
    expect(out.map((e) => e.severity)).toEqual(["critical", "critical", "warn", "info"]);
  });
  it("clean inputs → empty timeline", () => {
    expect(buildRugTimeline({ forensics: null, safety: null, bundle: null, sameDev: null })).toEqual([]);
  });
});

describe("buildTokenDna", () => {
  it("nothing observed → insufficient data", () => {
    const dna = buildTokenDna({ forensics: null, bundle: null, sameDev: null, safety: null });
    expect(dna.templateMatches).toEqual([]);
    expect(dna.verdict).toBe("insufficient data");
  });
  it("serial deployer scores the replay template at 100", () => {
    const dna = buildTokenDna({
      forensics: { dev: { serial: true, tokensCreated: 6 } },
      bundle: null,
      sameDev: null,
      safety: null,
    });
    expect(dna.templateMatches[0].template).toBe("serial-launcher replay");
    expect(dna.templateMatches[0].matchPct).toBe(100);
    expect(dna.verdict).toBe("serial-launcher replay");
  });
});

describe("buildGraduation", () => {
  it("non-pump token → null (not_pumpfun)", () => {
    expect(buildGraduation({ dexPairs: [{ dexId: "raydium" }], research: null, token: null, isPumpFun: false })).toBeNull();
  });
  it("pump token progress = mcap / $69k", () => {
    const g = buildGraduation({
      dexPairs: [{ dexId: "pumpfun", marketCap: 34_500 }],
      research: null,
      token: { marketCap: 34_500 },
      isPumpFun: true,
    });
    expect(g?.progressPct).toBe(50);
    expect(g?.source).toBe("pumpfun");
    expect(g?.migrationAt).toBeNull();
  });
});

describe("buildContractDiff", () => {
  it("pump origin + both revoked → standard; live mint → false + diff", () => {
    const std = buildContractDiff({ isPumpFun: true, safetyFlags: { mintRenounced: true, freezeRenounced: true } });
    expect(std.isStandardPumpfun).toBe(true);
    expect(std.diffs).toEqual([]);
    const dev = buildContractDiff({ isPumpFun: true, safetyFlags: { mintRenounced: false, freezeRenounced: true } });
    expect(dev.isStandardPumpfun).toBe(false);
    expect(dev.diffs[0].area).toBe("mint-authority");
  });
  it("unknown origin → null", () => {
    expect(buildContractDiff(null).isStandardPumpfun).toBeNull();
  });
});

describe("buildCopycats", () => {
  it("maps research clones to solana copycats", () => {
    const out = buildCopycats({ clones: [{ mint: "M1", name: "Fake", symbol: "FAKE", mcap: 100 }] });
    expect(out).toEqual([{ mint: "M1", chain: "solana", name: "Fake", symbol: "FAKE", marketCapUsd: 100 }]);
    expect(buildCopycats(null)).toEqual([]);
  });
});

describe("buildHolderConviction", () => {
  it("diamond >= 30d, paper < 30d, unknown without first buy", () => {
    const now = T0 + 40 * 86_400_000;
    const out = buildHolderConviction(
      [
        w3trace({ address: "D", firstBuyAtMs: T0 }),
        w3trace({ address: "P", firstBuyAtMs: T0 + 35 * 86_400_000 }),
        w3trace({ address: "U", firstBuyAtMs: null }),
      ],
      now,
    );
    expect(out.holders.map((h) => h.label)).toEqual(["diamond", "paper", "unknown"]);
    expect(out.avgHoldDays).toBe(22.5);
  });
});

describe("buildWhaleLabels", () => {
  it("labels only from observed evidence", () => {
    const out = buildWhaleLabels({
      bundle: {
        traces: [w3trace({ address: "W", supplyPct: 5, devLinked: true, firstBuyAtMs: T0 + 5_000 })],
        clusters: [{ members: [{ address: "W", supplyPct: 5, firstBuyAtMs: T0 + 5_000, fundingSource: "F", devLinked: true }] }],
      } as never,
      tape: null,
      pairCreatedAt: T0,
    });
    expect(out).toHaveLength(1);
    expect(out[0].labels).toEqual(["bundle-member", "dev-linked", "sniper", "whale"]);
  });
});

describe("buildRugLeaderboard", () => {
  it("ranks rugged first, excludes unscorable with a count and the scanned mint", () => {
    const out = buildRugLeaderboard({
      devHistory: {
        tokens: [
          { mint: "R1", name: "Rug", outcome: "rugged", launchedAt: T0, evidence: "" },
          { mint: "U1", name: "?", outcome: "unknown", launchedAt: T0, evidence: "" },
          { mint: "SELF", name: "Self", outcome: "rugged", launchedAt: T0, evidence: "" },
        ],
      } as never,
      sameDev: null,
      mint: "SELF",
    });
    expect(out.entries.map((e) => e.mint)).toEqual(["R1"]);
    expect(out.entries[0].dangerScore).toBe(100);
    expect(out.unscorableCount).toBe(1);
  });
});

describe("buildFreshWalletRadar", () => {
  it("first buys within 10 min of launch; fundedByDevSource from dev-link", () => {
    const out = buildFreshWalletRadar(
      [
        w3trace({ address: "F1", firstBuyAtMs: T0 + 100_000, devLinked: true, fundingChain: ["F1", "DEV"] }),
        w3trace({ address: "F2", firstBuyAtMs: T0 + 100_000, traced: true }),
        w3trace({ address: "F3", firstBuyAtMs: T0 + 100_000, traced: false }),
        w3trace({ address: "LATE", firstBuyAtMs: T0 + 700_000 }),
      ],
      T0,
    );
    expect(out.map((e) => e.wallet)).toEqual(["F1", "F2", "F3"]);
    expect(out.map((e) => e.fundedByDevSource)).toEqual([true, false, null]);
    expect(out[0].amountSol).toBeNull();
  });
});

describe("buildLpMigration", () => {
  it("pumpfun → raydium is a migration; one DEX is not", () => {
    const out = buildLpMigration([
      { dexId: "pumpfun", pairCreatedAt: T0, liquidityUsd: 10_000 },
      { dexId: "raydium", pairCreatedAt: T0 + 60_000, liquidityUsd: 80_000 },
    ]);
    expect(out.movements).toHaveLength(1);
    expect(out.movements[0]).toMatchObject({ fromPool: "pumpfun", toPool: "raydium", amountUsd: 80_000 });
    expect(buildLpMigration([{ dexId: "raydium", pairCreatedAt: T0 }]).movements).toEqual([]);
  });
});

describe("buildMetadataAudit", () => {
  it("flags unchecked image and unverified mutability, never claims mutable", () => {
    const a = buildMetadataAudit({ name: "T", symbol: "T", image: "https://x/img.png" }, null);
    expect(a.mutable).toBeNull();
    expect(a.imageOk).toBeNull();
    expect(a.issues.join(" ")).toMatch(/not yet checked/i);
    expect(a.issues.join(" ")).toMatch(/mutability unverified/i);
  });
});

describe("buildEntryExitPlanner", () => {
  it("1% move size from CPAMM; null depth → nulls", () => {
    const p = buildEntryExitPlanner(10_000);
    expect(p.maxBuyUsdFor1Pct).toBeCloseTo(101.01, 1);
    expect(p.maxSellUsdFor1Pct).toBeCloseTo(101.01, 1);
    expect(buildEntryExitPlanner(null).maxBuyUsdFor1Pct).toBeNull();
  });
});

describe("buildRugAutopsy", () => {
  it("null when not rugged; full autopsy when rugged", () => {
    expect(buildRugAutopsy({ mint: "M", token: null, forensics: { safetyFlags: { rugged: false } }, timeline: [] })).toBeNull();
    const a = buildRugAutopsy({
      mint: "M",
      token: { name: "Rug" },
      forensics: { safetyFlags: { rugged: true } },
      timeline: [{ at: null, flag: "Flagged rugged", severity: "critical", source: "forensics" }],
    });
    expect(a?.verdict).toBe("rugged");
    expect(a?.rootCause).toMatch(/rugged/i);
    expect(a?.lessons.length).toBeGreaterThan(0);
  });
});

describe("buildDevWalletWatch", () => {
  it("no wallet → empty; sold dev → sell + moved", () => {
    expect(buildDevWalletWatch(null, null)).toEqual([]);
    const w = buildDevWalletWatch(null, { dev: { wallet: "DEV", sold: true } });
    expect(w[0].lastAction).toBe("sell");
    expect(w[0].movedSinceScan).toBe(true);
    expect(w[0].lastTxAt).toBeNull();
    expect(w[0].lastAmountUsd).toBeNull();
  });
});

describe("buildInsiders", () => {
  it("null without an announcement time; buys before it when anchored", () => {
    expect(buildInsiders({ announcementAt: null, tape: [] })).toBeNull();
    const out = buildInsiders({
      announcementAt: T0 + 1000,
      tape: [
        { time: T0, priceUsd: 1, sizeUsd: 100, side: "buy", wallet: "EARLY" },
        { time: T0 + 2000, priceUsd: 1, sizeUsd: 100, side: "buy", wallet: "LATE" },
      ],
    });
    expect(out?.map((i) => i.wallet)).toEqual(["EARLY"]);
  });
});

describe("buildUnlockSchedule", () => {
  it("always null — no unlock source for SPL mints", () => {
    expect(buildUnlockSchedule()).toBeNull();
  });
});

describe("buildWashTrading", () => {
  it("no round-trips → no wash pattern observed, score 0", () => {
    const w = buildWashTrading([
      { time: T0, priceUsd: 1, sizeUsd: 100, side: "buy", wallet: "A" },
      { time: T0 + 1000, priceUsd: 1, sizeUsd: 100, side: "sell", wallet: "B" },
    ]);
    expect(w.score).toBe(0);
    expect(w.pairs).toEqual([]);
    expect(w.verdict).toBe("no wash pattern observed");
  });
  it("same wallet buy+sell of similar size within 10 min is a round-trip", () => {
    const w = buildWashTrading([
      { time: T0, priceUsd: 1, sizeUsd: 1000, side: "buy", wallet: "A" },
      { time: T0 + 60_000, priceUsd: 1, sizeUsd: 950, side: "sell", wallet: "A" },
    ]);
    expect(w.pairs).toHaveLength(1);
    expect(w.pairs[0].roundTrips).toBe(1);
    expect(w.score).toBeGreaterThan(0);
  });
});

describe("buildSlippageEstimator", () => {
  it("$1,000 vs $9,000 depth → 10% both ways; unknown depth → nulls", () => {
    const s = buildSlippageEstimator(9000);
    expect(s.sizeUsd).toBe(1000);
    expect(s.estBuySlippagePct).toBe(10);
    expect(s.estSellSlippagePct).toBe(10);
    expect(buildSlippageEstimator(null).estBuySlippagePct).toBeNull();
  });
});

describe("buildHoneypotFlip", () => {
  it("buy-only route → honeypot; flips empty (no prior observation)", () => {
    const h = buildHoneypotFlip({ canBuy: true, canSell: false });
    expect(h.currentlyHoneypot).toBe(true);
    expect(h.flips).toEqual([]);
    expect(buildHoneypotFlip({ canBuy: true, canSell: true }).currentlyHoneypot).toBe(false);
    expect(buildHoneypotFlip(null).currentlyHoneypot).toBeNull();
  });
});

describe("buildAuthorityChange", () => {
  it("passes current authorities; changes always empty", () => {
    const a = buildAuthorityChange({ safetyFlags: { mintRenounced: true, freezeRenounced: false } });
    expect(a.mintAuthority).toBe(true);
    expect(a.freezeAuthority).toBe(false);
    expect(a.changes).toEqual([]);
  });
});

describe("buildCostBasis", () => {
  it("entry prices unobservable — PnL nulls, current price + supply kept", () => {
    const out = buildCostBasis([w3trace({ address: "H", supplyPct: 3 })], 0.05);
    expect(out[0]).toEqual({
      wallet: "H",
      avgEntryPriceUsd: null,
      currentPriceUsd: 0.05,
      unrealizedPnlPct: null,
      unrealizedPnlUsd: null,
      supplyPct: 3,
    });
  });
});

describe("buildCexDeposits", () => {
  it("empty embedded list → no events, no flags, never guessed", () => {
    const c = buildCexDeposits();
    expect(c.events).toEqual([]);
    expect(c.knownHotWallets).toEqual([]);
  });
});

describe("buildDevSellSimulator", () => {
  it("10% of $1M mcap vs $100k depth → $100k holding, 50% impact", () => {
    const s = buildDevSellSimulator({ devHoldingPct: 10, marketCapUsd: 1_000_000, liquidityUsd: 100_000 });
    expect(s?.devHoldingUsd).toBe(100_000);
    expect(s?.estPriceImpactPct).toBe(50);
    expect(s?.model).toMatch(/constant-product/i);
  });
  it("unknown depth or holdings → null", () => {
    expect(buildDevSellSimulator({ devHoldingPct: 10, marketCapUsd: 1_000_000, liquidityUsd: null })).toBeNull();
    expect(buildDevSellSimulator({ devHoldingPct: null, marketCapUsd: 1_000_000, liquidityUsd: 100_000 })).toBeNull();
  });
});
