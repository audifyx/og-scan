import { describe, expect, it } from "vitest";
import {
  computeMarketOverview,
  computeTokenAnalytics,
  countNewPairs,
  rankMovers,
} from "./analyticsApi";
import type { MarketCoin } from "./tradeApi";

function coin(partial: Partial<MarketCoin> & { mint: string }): MarketCoin {
  return {
    symbol: "???",
    name: "",
    price: 0,
    mcap: 0,
    change24h: 0,
    volume24h: 0,
    liquidity: 0,
    ...partial,
  };
}

const NOW = new Date("2026-11-03T19:00:00Z").getTime();

describe("rankMovers", () => {
  it("ranks gainers desc and losers asc, excludes zero-change rows", () => {
    const rows = [
      coin({ mint: "a", symbol: "A", change24h: 12, mcap: 100, volume24h: 10 }),
      coin({ mint: "b", symbol: "B", change24h: 250, mcap: 200, volume24h: 20 }),
      coin({ mint: "c", symbol: "C", change24h: -40, mcap: 300, volume24h: 30 }),
      coin({ mint: "d", symbol: "D", change24h: -5, mcap: 400, volume24h: 40 }),
      coin({ mint: "e", symbol: "E", change24h: 0, mcap: 500, volume24h: 50 }),
    ];
    const { gainers, losers } = rankMovers(rows, 5);
    expect(gainers.map((g) => g.symbol)).toEqual(["B", "A"]);
    expect(losers.map((g) => g.symbol)).toEqual(["C", "D"]);
  });

  it("respects the limit", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      coin({ mint: `m${i}`, symbol: `S${i}`, change24h: i + 1, mcap: 1, volume24h: 1 }),
    );
    expect(rankMovers(rows, 3).gainers).toHaveLength(3);
    expect(rankMovers(rows, 3).gainers[0].change24h).toBe(8);
  });

  it("returns empty movers for an empty market", () => {
    expect(rankMovers([], 5)).toEqual({ gainers: [], losers: [] });
  });
});

describe("countNewPairs", () => {
  it("counts only pairs created within the window", () => {
    const rows = [
      { createdAt: new Date(NOW - 1 * 3_600_000).toISOString() },
      { createdAt: new Date(NOW - 23 * 3_600_000).toISOString() },
      { createdAt: new Date(NOW - 25 * 3_600_000).toISOString() },
      { createdAt: null },
    ];
    expect(countNewPairs(rows, 24, NOW)).toBe(2);
  });

  it("returns null when no row reports createdAt", () => {
    expect(countNewPairs([{ createdAt: null }, {}], 24, NOW)).toBeNull();
    expect(countNewPairs([], 24, NOW)).toBeNull();
  });
});

describe("computeMarketOverview", () => {
  it("totals volume/liquidity and counts gainers/losers/flat", () => {
    const rows = [
      coin({ mint: "a", symbol: "A", change24h: 10, volume24h: 100, liquidity: 50 }),
      coin({ mint: "b", symbol: "B", change24h: -3, volume24h: 200, liquidity: 70 }),
      coin({ mint: "c", symbol: "C", change24h: 0, volume24h: 0, liquidity: 0 }),
    ];
    const o = computeMarketOverview(rows, [{ createdAt: new Date(NOW - 3_600_000).toISOString() }], NOW);
    expect(o.hasData).toBe(true);
    expect(o.tokenCount).toBe(3);
    expect(o.totalVolume24h).toBe(300);
    expect(o.totalLiquidity).toBe(120);
    expect(o.gainers).toBe(1);
    expect(o.losers).toBe(1);
    expect(o.flat).toBe(1);
    expect(o.newPairs24h).toBe(1);
    expect(o.newPairsFeed).toBe(1);
  });

  it("flags an empty market so the UI shows 'no data', not zeros as fact", () => {
    const o = computeMarketOverview([], [], NOW);
    expect(o.hasData).toBe(false);
    expect(o.totalVolume24h).toBe(0);
    expect(o.topGainers).toEqual([]);
    expect(o.newPairs24h).toBeNull();
  });
});

describe("computeTokenAnalytics", () => {
  it("splits 5m buys/sells and computes the buy share", () => {
    const a = computeTokenAnalytics({
      volume5m: 12000,
      volume24h: 900000,
      buys5m: 30,
      sells5m: 10,
      buyVol5m: 9000,
      sellVol5m: 3000,
    });
    expect(a.volume5m).toBe(12000);
    expect(a.volume24h).toBe(900000);
    expect(a.volume1h).toBeNull(); // no desk source reports 1h volume
    expect(a.buyShare5m).toBeCloseTo(0.75);
  });

  it("aggregates the trade tape and surfaces whale prints", () => {
    const a = computeTokenAnalytics({
      trades: [
        { side: "buy", value: 15000, time: 1000, wallet: "w1" },
        { side: "buy", value: 100, time: 1001, wallet: "w2" },
        { side: "sell", value: 25000, time: 1002, wallet: "w3" },
        { side: "sell", value: 50, time: 1003, wallet: "w4" },
      ],
    });
    expect(a.tapeCount).toBe(4);
    expect(a.tapeBuys).toBe(2);
    expect(a.tapeSells).toBe(2);
    expect(a.tapeBuyUsd).toBe(15100);
    expect(a.tapeSellUsd).toBe(25050);
    expect(a.largeTrades).toBe(2); // >= $10k
    expect(a.largestTrades.map((t) => t.value)).toEqual([25000, 15000, 100]);
    expect(a.largestTrades[0].side).toBe("sell");
  });

  it("ranks holders and sums the top-5 share only when pcts exist", () => {
    const a = computeTokenAnalytics({
      holderCount: 1234,
      top10Pct: 42.5,
      devPct: 3.1,
      holders: [
        { owner: "h1", pct: 12, usdValue: 5000 },
        { owner: "h2", pct: 8, usdValue: 3000 },
        { owner: "h3", pct: null, usdValue: 1000 },
      ],
    });
    expect(a.holderCount).toBe(1234);
    expect(a.top10Pct).toBe(42.5);
    expect(a.devPct).toBe(3.1);
    expect(a.topHolders.map((h) => h.owner)).toEqual(["h1", "h2", "h3"]);
    // h3 has no pct, so the top-5 share is unknown, not a partial sum.
    expect(a.top5SharePct).toBeNull();
  });

  it("returns nulls (unknown) for everything missing", () => {
    const a = computeTokenAnalytics({});
    expect(a.volume5m).toBeNull();
    expect(a.volume24h).toBeNull();
    expect(a.buys5m).toBeNull();
    expect(a.buyShare5m).toBeNull();
    expect(a.tapeCount).toBe(0);
    expect(a.largestTrades).toEqual([]);
    expect(a.holderCount).toBeNull();
    expect(a.topHolders).toEqual([]);
    expect(a.top5SharePct).toBeNull();
  });
});
