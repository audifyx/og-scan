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
