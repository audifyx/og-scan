/**
 * /replay-trades regression tests.
 *
 * The Birdeye calls are keyed in production, so every path here runs against
 * mocked fetch: V3 paging, the 422 → legacy seek fallback (both-bounds then
 * after_time-only), the empty window, and the GeckoTerminal recent fallback.
 * Response shapes are copied from the live Birdeye docs (2026-11-08):
 *  - V3 /defi/v3/token/txs: snake_case items, `side` + `tx_type`, `volume_usd`,
 *    `from`/`to` legs with `address` + `price`, `has_next` on data.
 *  - Legacy /defi/txs/token/seek_by_time: camelCase items, `side`, `txType`,
 *    `base`/`quote` legs, `basePrice`, NO volume_usd (value = leg uiAmount × price).
 */
import { describe, it, expect } from "vitest";
import {
  normalizeBirdeyeV3Trade,
  normalizeBirdeyeSeekTrade,
  normalizeBirdeyeList,
  normalizeGeckoTradeList,
  dedupeTrades,
  buildCacheKey,
  fetchBirdeyeTrades,
  fetchGeckoRecentTrades,
} from "./_replay.js";

const MINT = "Mint111111111111111111111111111111111111111";
const T0 = 1_769_900_400; // unix seconds

function v3Item(over = {}) {
  return {
    tx_type: "buy",
    tx_hash: "hash1",
    block_unix_time: T0,
    volume_usd: 12.5,
    volume: 100,
    owner: "Wallet11111111111111111111111111111111111",
    source: "raydium",
    side: "buy",
    from: { symbol: "TEST", address: MINT, price: 0.01, ui_amount: 1250 },
    to: { symbol: "SOL", address: "So11111111111111111111111111111111111111112", price: 150, ui_amount: 0.00008 },
    pool_id: "Pool11111111111111111111111111111111111111",
    ...over,
  };
}

function seekItem(over = {}) {
  return {
    txHash: "seekhash1",
    blockUnixTime: T0,
    txType: "swap",
    side: "sell",
    owner: "Wallet22222222222222222222222222222222222",
    source: "pump_dot_fun",
    base: { symbol: "TEST", address: MINT, price: 0.02, uiAmount: 500 },
    quote: { symbol: "SOL", address: "So11111111111111111111111111111111111111112", price: 150, uiAmount: 0.00006 },
    basePrice: 0.02,
    quotePrice: 150,
    poolId: "Pool11111111111111111111111111111111111111",
    ...over,
  };
}

const noSleep = async () => {};
const fastDeps = { sleepImpl: noSleep, pageDelayMs: 0, budgetMs: 60_000 };

/** Mock fetch that answers from a URL → { status, body } map (or function). */
function mockFetch(routes) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const route = typeof routes === "function" ? routes(url) : routes[url];
    const r = route ?? { status: 404, body: { success: false } };
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => r.body,
    };
  };
  fn.calls = calls;
  return fn;
}

describe("normalizeBirdeyeV3Trade", () => {
  it("parses a buy with maker, price from the mint leg, and USD volume", () => {
    const t = normalizeBirdeyeV3Trade(v3Item(), MINT);
    expect(t).toMatchObject({ txHash: "hash1", timeMs: T0 * 1000, maker: "Wallet11111111111111111111111111111111111", kind: "buy", priceUsd: 0.01, volumeUsd: 12.5 });
  });
  it("takes the price from whichever leg holds the mint (sell side)", () => {
    const t = normalizeBirdeyeV3Trade(
      v3Item({ tx_type: "sell", side: "sell", from: { address: "So11111111111111111111111111111111111111112", price: 150 }, to: { address: MINT, price: 0.03 } }),
      MINT,
    );
    expect(t?.kind).toBe("sell");
    expect(t?.priceUsd).toBe(0.03);
  });
  it("drops add/remove trades and items with no side or time — never guesses a side", () => {
    expect(normalizeBirdeyeV3Trade(v3Item({ tx_type: "add", side: "add" }), MINT)).toBeNull();
    expect(normalizeBirdeyeV3Trade(v3Item({ side: undefined, tx_type: "swap" }), MINT)).toBeNull();
    expect(normalizeBirdeyeV3Trade(v3Item({ block_unix_time: 0 }), MINT)).toBeNull();
    expect(normalizeBirdeyeV3Trade(null, MINT)).toBeNull();
  });
});

describe("normalizeBirdeyeSeekTrade", () => {
  it("parses a camelCase seek item and computes USD volume from the mint leg", () => {
    const t = normalizeBirdeyeSeekTrade(seekItem(), MINT);
    expect(t).toMatchObject({ txHash: "seekhash1", timeMs: T0 * 1000, kind: "sell", priceUsd: 0.02 });
    expect(t?.volumeUsd).toBeCloseTo(500 * 0.02, 10);
  });
  it("drops items with no side", () => {
    expect(normalizeBirdeyeSeekTrade(seekItem({ side: undefined, txType: "swap" }), MINT)).toBeNull();
  });
});

describe("normalizeBirdeyeList + dedupeTrades", () => {
  it("reads data.items and drops unclassifiable rows", () => {
    const out = normalizeBirdeyeList(
      { success: true, data: { items: [v3Item(), v3Item({ tx_type: "add", side: "add" }), v3Item({ tx_hash: "hash2", block_unix_time: T0 + 60 })], has_next: false } },
      MINT,
      normalizeBirdeyeV3Trade,
    );
    expect(out).toHaveLength(2);
    expect(out.map((t) => t.txHash)).toEqual(["hash1", "hash2"]);
  });
  it("returns [] for a missing data.items", () => {
    expect(normalizeBirdeyeList({ success: false }, MINT, normalizeBirdeyeV3Trade)).toEqual([]);
    expect(normalizeBirdeyeList(null, MINT, normalizeBirdeyeV3Trade)).toEqual([]);
  });
  it("dedupes by txHash and sorts oldest-first", () => {
    const a = { txHash: "x", timeMs: T0 * 1000 + 60_000, maker: null, kind: "buy", priceUsd: 1, volumeUsd: 1 };
    const b = { txHash: "x", timeMs: T0 * 1000 + 60_000, maker: null, kind: "buy", priceUsd: 1, volumeUsd: 1 };
    const c = { txHash: "y", timeMs: T0 * 1000, maker: null, kind: "sell", priceUsd: 1, volumeUsd: 1 };
    const out = dedupeTrades([a, b, c]);
    expect(out).toHaveLength(2);
    expect(out[0].txHash).toBe("y");
  });
});

describe("buildCacheKey", () => {
  it("buckets from/to to 5 minutes so repeat loads hit the same key", () => {
    // Both `to` values sit inside the 1_769_903_700_000 bucket.
    const k1 = buildCacheKey(MINT, "P", 1_769_900_400_000, 1_769_903_700_000);
    const k2 = buildCacheKey(MINT, "P", 1_769_900_410_000, 1_769_903_999_000);
    expect(k1).toBe(k2);
    expect(k1).toContain(MINT);
  });
  it("separates different pairs", () => {
    expect(buildCacheKey(MINT, "P1", 1_000_000, 2_000_000)).not.toBe(buildCacheKey(MINT, "P2", 1_000_000, 2_000_000));
  });
});

describe("fetchBirdeyeTrades", () => {
  it("pages V3 with offset until a short page, covers the window", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => v3Item({ tx_hash: `h${i}`, block_unix_time: T0 + 100 - i }));
    const page2 = [v3Item({ tx_hash: "last", block_unix_time: T0 })];
    const fetchImpl = mockFetch((url) => {
      if (url.includes("/defi/v3/token/txs")) {
        if (url.includes("offset=0")) return { status: 200, body: { success: true, data: { items: page1, has_next: true } } };
        if (url.includes("offset=100")) return { status: 200, body: { success: true, data: { items: page2, has_next: false } } };
      }
      return { status: 404, body: {} };
    });
    const r = await fetchBirdeyeTrades({ mint: MINT, pair: "Pool1", fromSec: T0 - 3600, toSec: T0 + 3600 }, { ...fastDeps, fetchImpl });
    expect(r.error).toBeNull();
    expect(r.coversWindow).toBe(true);
    expect(r.truncated).toBe(false);
    expect(r.trades).toHaveLength(101);
    expect(r.trades[0].txHash).toBe("last"); // oldest-first
    expect(fetchImpl.calls).toHaveLength(2);
    expect(fetchImpl.calls[0]).toContain("before_time=");
    expect(fetchImpl.calls[0]).toContain("after_time=");
    expect(fetchImpl.calls[0]).toContain("pool_id=Pool1");
  });

  it("returns an empty covered window when Birdeye answers with no trades", async () => {
    const fetchImpl = mockFetch(() => ({ status: 200, body: { success: true, data: { items: [], has_next: false } } }));
    const r = await fetchBirdeyeTrades({ mint: MINT, fromSec: T0 - 3600, toSec: T0 + 3600 }, { ...fastDeps, fetchImpl });
    expect(r).toMatchObject({ error: null, coversWindow: true, truncated: false });
    expect(r.trades).toEqual([]);
  });

  it("falls back to seek_by_time when V3 422s, then to after_time-only when seek-both 422s", async () => {
    const seekItems = [seekItem({ txHash: "s1" }), seekItem({ txHash: "s2", blockUnixTime: T0 + 30 })];
    const fetchImpl = mockFetch((url) => {
      if (url.includes("/defi/v3/token/txs")) return { status: 422, body: { success: false, message: "invalid params" } };
      if (url.includes("/defi/txs/token/seek_by_time") && url.includes("before_time=")) {
        return { status: 422, body: { success: false, message: "both bounds not allowed" } };
      }
      if (url.includes("/defi/txs/token/seek_by_time")) {
        return { status: 200, body: { success: true, data: { items: seekItems, hasNext: false } } };
      }
      return { status: 404, body: {} };
    });
    const r = await fetchBirdeyeTrades({ mint: MINT, fromSec: T0 - 60, toSec: T0 + 3600 }, { ...fastDeps, fetchImpl });
    expect(r.error).toBeNull();
    expect(r.coversWindow).toBe(true);
    expect(r.trades).toHaveLength(2);
    expect(r.trades.map((t) => t.txHash)).toEqual(["s1", "s2"]);
    // V3 tried, seek-both tried, seek after-only succeeded.
    expect(fetchImpl.calls.some((u) => u.includes("/defi/v3/token/txs"))).toBe(true);
    expect(fetchImpl.calls.some((u) => u.includes("seek_by_time") && u.includes("before_time="))).toBe(true);
    const afterOnly = fetchImpl.calls.filter((u) => u.includes("seek_by_time") && !u.includes("before_time="));
    expect(afterOnly.length).toBe(1);
    expect(afterOnly[0]).toContain("after_time=");
  });

  it("reports a Birdeye error instead of fake trades when Birdeye is down", async () => {
    const fetchImpl = mockFetch(() => ({ status: 500, body: { success: false } }));
    const r = await fetchBirdeyeTrades({ mint: MINT, fromSec: T0 - 60, toSec: T0 + 60 }, { ...fastDeps, fetchImpl });
    expect(r.trades).toEqual([]);
    expect(r.coversWindow).toBe(false);
    expect(r.error).toContain("birdeye HTTP 500");
  });

  it("caps at maxTrades and flags truncated (never claims full coverage)", async () => {
    const page = Array.from({ length: 100 }, (_, i) => v3Item({ tx_hash: `h${i}`, block_unix_time: T0 + 100 - i }));
    const fetchImpl = mockFetch(() => ({ status: 200, body: { success: true, data: { items: page, has_next: true } } }));
    const r = await fetchBirdeyeTrades(
      { mint: MINT, fromSec: T0 - 3600, toSec: T0 + 3600 },
      { ...fastDeps, fetchImpl, maxTrades: 150, maxPages: 50 },
    );
    expect(r.trades.length).toBeLessThanOrEqual(150);
    expect(r.truncated).toBe(true);
    expect(r.coversWindow).toBe(false);
  });
});

describe("fetchGeckoRecentTrades", () => {
  it("fetches recent pages, dedupes identical pages, stops on a short page", async () => {
    const gtRow = (hash, ts) => ({
      id: hash,
      attributes: { block_timestamp: ts, kind: "buy", tx_hash: hash, tx_from_address: "W1", volume_in_usd: "5", price_to_in_usd: "0.01" },
    });
    const page = { data: [gtRow("g1", "2026-01-01T00:01:00Z"), gtRow("g2", "2026-01-01T00:00:00Z")] };
    const fetchImpl = mockFetch(() => ({ status: 200, body: page }));
    const out = await fetchGeckoRecentTrades("Pool1", { fetchImpl });
    // Same 2-row page repeats; short page (<100) stops after page 1.
    expect(out).toHaveLength(2);
    expect(out[0].txHash).toBe("g2");
    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0]).toContain("/networks/solana/pools/Pool1/trades?page=1");
  });

  it("returns [] when GeckoTerminal is down", async () => {
    const fetchImpl = mockFetch(() => ({ status: 429, body: {} }));
    expect(await fetchGeckoRecentTrades("Pool1", { fetchImpl })).toEqual([]);
  });
});

describe("normalizeGeckoTradeList", () => {
  it("parses GT rows and drops unclassifiable ones", () => {
    const raw = {
      data: [
        { attributes: { block_timestamp: "2026-01-01T00:00:00Z", kind: "sell", tx_hash: "s1", volume_in_usd: "3" } },
        { attributes: { kind: "buy" } },
      ],
    };
    const out = normalizeGeckoTradeList(raw);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("sell");
  });
});
