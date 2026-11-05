/**
 * Pump.fun filter regression tests.
 *
 * pump.fun dropped real_sol_reserves / real_quote_reserves from its API
 * response, which made the old unbonded/newpairs filters match nothing (both
 * tabs fell back to stale hardcoded coins). These tests pin the new-schema
 * behavior: `complete` + usd_market_cap are the signals, bondingPct is null
 * (unknown) when reserves are absent.
 */
import { describe, it, expect } from "vitest";
import { filterUnbondedCoins, filterNewPairCoins, normDexPumpfunPair, filterDexUnbondedPairs, filterDexNewPairs } from "./_screener.js";

const now = Date.now();
const base = (over = {}) => ({
  mint: "Mint111111111111111111111111111111111111111",
  name: "Test",
  symbol: "TEST",
  image_uri: "https://example.com/img.png",
  complete: false,
  total_supply: 1_000_000_000_000_000,
  usd_market_cap: 5000,
  created_timestamp: now - 3600_000,
  last_trade_timestamp: now - 60_000,
  ...over,
});

describe("filterUnbondedCoins", () => {
  it("passes a new-schema unbonded coin (no reserve fields) with mcap in range", () => {
    const rows = filterUnbondedCoins([base()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].mint).toBe("Mint111111111111111111111111111111111111111");
    // Bonding progress is unknown without reserves — never 0.
    expect(rows[0].bondingPct).toBeNull();
  });

  it("excludes complete (graduated) coins", () => {
    expect(filterUnbondedCoins([base({ complete: true })])).toHaveLength(0);
  });

  it("excludes mcap outside 1500–40000", () => {
    expect(filterUnbondedCoins([base({ usd_market_cap: 1000 })])).toHaveLength(0);
    expect(filterUnbondedCoins([base({ usd_market_cap: 50000 })])).toHaveLength(0);
  });

  it("still computes bondingPct for old-schema coins that carry reserves", () => {
    const rows = filterUnbondedCoins([
      base({ real_sol_reserves: 42_500_000_000 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].bondingPct).toBe(50);
  });

  it("sorts by most recent trade first", () => {
    const rows = filterUnbondedCoins([
      base({ mint: "Old111111111111111111111111111111111111111", last_trade_timestamp: now - 3600_000 }),
      base({ mint: "New111111111111111111111111111111111111111", last_trade_timestamp: now - 1000 }),
    ]);
    expect(rows.map((r) => r.mint)).toEqual([
      "New111111111111111111111111111111111111111",
      "Old111111111111111111111111111111111111111",
    ]);
  });
});

describe("filterNewPairCoins", () => {
  const cutoff = now - 86_400_000;
  it("passes a new-schema coin created in the last 24h with mcap >= 2500", () => {
    expect(filterNewPairCoins([base()], cutoff)).toHaveLength(1);
  });

  it("excludes coins older than 24h and tiny mcap", () => {
    expect(filterNewPairCoins([base({ created_timestamp: now - 2 * 86_400_000 })], cutoff)).toHaveLength(0);
    expect(filterNewPairCoins([base({ usd_market_cap: 100 })], cutoff)).toHaveLength(0);
  });

  it("passes complete coins too (both bonded + unbonded)", () => {
    expect(filterNewPairCoins([base({ complete: true })], cutoff)).toHaveLength(1);
  });
});

/**
 * DexScreener fallback for the Pump tabs.
 *
 * pump.fun's frontend API 403s from Vercel IPs, so on the deployed site the
 * pump.fun fetch returns [] and both Pump tabs would be empty. The fallback
 * reads the same coins from DexScreener's pumpfun dex (still-on-the-curve
 * pairs trade there; graduated coins move to pumpswap/raydium).
 */
const dexPair = (over = {}) => ({
  chainId: "solana",
  dexId: "pumpfun",
  pairAddress: "Pair11111111111111111111111111111111111111",
  baseToken: { address: "Mint111111111111111111111111111111111111111", name: "Test", symbol: "TEST" },
  priceUsd: "0.00001",
  marketCap: 5000,
  fdv: 5000,
  liquidity: { usd: 1200 },
  volume: { h24: 3000 },
  priceChange: { m5: 1, h1: 2, h24: 3 },
  pairCreatedAt: now - 3600_000,
  info: { imageUrl: "https://example.com/img.png" },
  ...over,
});

describe("normDexPumpfunPair", () => {
  it("maps a pumpfun pair to a desk row with _source dexscreener", () => {
    const r = normDexPumpfunPair(dexPair());
    expect(r.mint).toBe("Mint111111111111111111111111111111111111111");
    expect(r.symbol).toBe("TEST");
    expect(r.mcap).toBe(5000);
    expect(r._source).toBe("dexscreener");
    expect(r.bondingPct).toBeNull();
  });

  it("returns null for non-pumpfun pairs and pairs without a base address", () => {
    expect(normDexPumpfunPair(dexPair({ dexId: "raydium" }))).toBeNull();
    expect(normDexPumpfunPair(dexPair({ baseToken: {} }))).toBeNull();
    expect(normDexPumpfunPair(null)).toBeNull();
  });
});

describe("filterDexUnbondedPairs", () => {
  it("passes pumpfun pairs with mcap in 1500–40000, sorted newest first", () => {
    const rows = filterDexUnbondedPairs([
      dexPair({ baseToken: { address: "Old111111111111111111111111111111111111111", name: "Old", symbol: "OLD" }, pairCreatedAt: now - 7200_000 }),
      dexPair({ baseToken: { address: "New111111111111111111111111111111111111111", name: "New", symbol: "NEW" }, pairCreatedAt: now - 1000 }),
    ]);
    expect(rows.map((r) => r.symbol)).toEqual(["NEW", "OLD"]);
  });

  it("excludes out-of-range mcap and migrated (non-pumpfun) pairs", () => {
    expect(filterDexUnbondedPairs([dexPair({ marketCap: 1000 })])).toHaveLength(0);
    expect(filterDexUnbondedPairs([dexPair({ marketCap: 50000 })])).toHaveLength(0);
    expect(filterDexUnbondedPairs([dexPair({ dexId: "pumpswap" })])).toHaveLength(0);
  });
});

describe("filterDexNewPairs", () => {
  const cutoff = now - 86_400_000;
  it("passes pumpfun pairs created in the last 24h with mcap >= 2500", () => {
    expect(filterDexNewPairs([dexPair()], cutoff)).toHaveLength(1);
  });

  it("excludes pairs older than 24h and tiny mcap", () => {
    expect(filterDexNewPairs([dexPair({ pairCreatedAt: now - 2 * 86_400_000 })], cutoff)).toHaveLength(0);
    expect(filterDexNewPairs([dexPair({ marketCap: 100 })], cutoff)).toHaveLength(0);
  });
});
