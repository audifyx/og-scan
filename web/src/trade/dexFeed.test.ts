import { describe, expect, it, vi, afterEach } from "vitest";
import {
  applyDexFilters,
  countActiveFilters,
  DEFAULT_DEX_FILTERS,
  fetchNewListings,
  isNewPair,
  mapDexPairToCoin,
  mapTokenProfileToCoin,
  rankTrending,
  resolveTokenImage,
  tokenInitials,
} from "./dexFeed";
import type { MarketCoin } from "./tradeApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

const pair = {
  chainId: "solana",
  dexId: "raydium",
  pairAddress: "pair123",
  pairCreatedAt: Date.now() - 30 * 60 * 1000,
  baseToken: { address: "Mint111111111111111111111111111111111111", symbol: "TEST", name: "Test Token" },
  priceUsd: "0.5",
  marketCap: 1000000,
  priceChange: { h24: 12.5, h1: 1.2 },
  volume: { h24: 500000 },
  liquidity: { usd: 200000 },
  txns: { h24: { buys: 800, sells: 200 } },
  info: { imageUrl: "https://example.com/img.png" },
};

function coin(over: Partial<MarketCoin>): MarketCoin {
  return {
    mint: "Mint111111111111111111111111111111111111",
    symbol: "TEST",
    name: "Test",
    price: 1,
    mcap: 1000,
    change24h: 0,
    volume24h: 100,
    liquidity: 100,
    ...over,
  };
}

describe("mapDexPairToCoin", () => {
  it("maps all DexScreener pair fields onto MarketCoin", () => {
    const c = mapDexPairToCoin(pair);
    expect(c).not.toBeNull();
    expect(c!.mint).toBe("Mint111111111111111111111111111111111111");
    expect(c!.symbol).toBe("TEST");
    expect(c!.image).toBe("https://example.com/img.png");
    expect(c!.price).toBe(0.5);
    expect(c!.mcap).toBe(1000000);
    expect(c!.change24h).toBe(12.5);
    expect(c!.volume24h).toBe(500000);
    expect(c!.liquidity).toBe(200000);
    expect(c!.chain).toBe("solana");
    expect(c!.dexId).toBe("raydium");
    expect(c!.txns24h).toBe(1000);
    expect(c!.createdAt).not.toBeNull();
  });

  it("returns null without a base token address", () => {
    expect(mapDexPairToCoin({ baseToken: {} })).toBeNull();
    expect(mapDexPairToCoin(null)).toBeNull();
  });
});

describe("mapTokenProfileToCoin", () => {
  it("maps profile address/chain/icon, leaves market data empty", () => {
    const c = mapTokenProfileToCoin({
      tokenAddress: "Mint222222222222222222222222222222222222",
      chainId: "solana",
      icon: "https://example.com/icon.png",
    });
    expect(c).not.toBeNull();
    expect(c!.mint).toBe("Mint222222222222222222222222222222222222");
    expect(c!.chain).toBe("solana");
    expect(c!.image).toBe("https://example.com/icon.png");
    expect(c!.price).toBe(0);
    expect(c!.symbol).toBe("");
  });
});

describe("resolveTokenImage / tokenInitials", () => {
  it("prefers info.imageUrl, then icon, then null", () => {
    expect(resolveTokenImage(pair)).toBe("https://example.com/img.png");
    expect(resolveTokenImage({ icon: "https://example.com/i.png" })).toBe("https://example.com/i.png");
    expect(resolveTokenImage({})).toBeNull();
    expect(resolveTokenImage("  ")).toBeNull();
    expect(resolveTokenImage("https://example.com/x.png")).toBe("https://example.com/x.png");
  });

  it("falls back to symbol then mint initials", () => {
    expect(tokenInitials("bonk", "abc")).toBe("BO");
    expect(tokenInitials("", "abcdef")).toBe("AB");
    expect(tokenInitials(null, null)).toBe("?");
  });
});

describe("rankTrending", () => {
  it("ranks high-volume + high-txn coins above thin ones", () => {
    const thin = coin({ mint: "a", volume24h: 10, txns24h: 2, change24h: 300 });
    const busy = coin({ mint: "b", volume24h: 900000, txns24h: 50000, change24h: 5 });
    const ranked = rankTrending([thin, busy]);
    expect(ranked[0].mint).toBe("b");
  });
});

describe("applyDexFilters / countActiveFilters", () => {
  const now = Date.now();
  const fresh = coin({
    mint: "fresh",
    chain: "solana",
    dexId: "raydium",
    liquidity: 50000,
    mcap: 200000,
    volume24h: 80000,
    txns24h: 400,
    createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
  });
  const oldEth = coin({
    mint: "old",
    chain: "ethereum",
    dexId: "uniswap",
    liquidity: 5,
    mcap: 100,
    volume24h: 10,
    txns24h: 1,
    createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const list = [fresh, oldEth];

  it("passes everything with default filters", () => {
    expect(applyDexFilters(list, DEFAULT_DEX_FILTERS, now)).toHaveLength(2);
    expect(countActiveFilters(DEFAULT_DEX_FILTERS)).toBe(0);
  });

  it("filters by chain, dex, minimums and max age", () => {
    expect(applyDexFilters(list, { ...DEFAULT_DEX_FILTERS, chain: "solana" }, now)).toEqual([fresh]);
    expect(applyDexFilters(list, { ...DEFAULT_DEX_FILTERS, dexId: "uniswap" }, now)).toEqual([oldEth]);
    expect(applyDexFilters(list, { ...DEFAULT_DEX_FILTERS, minLiquidity: 1000 }, now)).toEqual([fresh]);
    expect(applyDexFilters(list, { ...DEFAULT_DEX_FILTERS, maxAgeHours: 1 }, now)).toEqual([fresh]);
    expect(applyDexFilters(list, { ...DEFAULT_DEX_FILTERS, minTxns24h: 100 }, now)).toEqual([fresh]);
    expect(
      countActiveFilters({ ...DEFAULT_DEX_FILTERS, chain: "solana", minLiquidity: 1, maxAgeHours: 24 }),
    ).toBe(3);
  });

  it("drops coins with unknown age when a max-age filter is set", () => {
    const ageless = coin({ mint: "ageless", createdAt: null });
    expect(applyDexFilters([ageless], { ...DEFAULT_DEX_FILTERS, maxAgeHours: 24 }, now)).toEqual([]);
  });
});

describe("isNewPair", () => {
  it("is true only for pairs created under 1h ago", () => {
    const now = Date.now();
    expect(isNewPair(coin({ createdAt: new Date(now - 10 * 60 * 1000).toISOString() }), now)).toBe(true);
    expect(isNewPair(coin({ createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() }), now)).toBe(false);
    expect(isNewPair(coin({ createdAt: null }), now)).toBe(false);
  });
});

describe("fetchNewListings failure honesty", () => {
  it("returns an error state — never fake rows — when the feed is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const r = await fetchNewListings(5);
    expect(r.coins).toEqual([]);
    expect(r.error).toMatch(/unreachable/i);
  });
});
