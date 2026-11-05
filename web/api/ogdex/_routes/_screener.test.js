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
import { filterUnbondedCoins, filterNewPairCoins } from "./_screener.js";

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
