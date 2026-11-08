import { describe, expect, it, vi, afterEach } from "vitest";
import {
  analyzeEarlyBuyers,
  analyzePriceExtremes,
  buildMinuteSeries,
  deriveMarkers,
  detectGaps,
  fetchReplayTradesServer,
  normalizeOhlcvList,
  normalizeTradeList,
  pickReplayPair,
} from "./hooks/useLaunchReplay";
import type { DexPair } from "./api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

const T0 = 1_700_000_400_000; // minute-aligned base (divisible by 60_000)

function pair(partial: Partial<DexPair> & { pairAddress: string }): DexPair {
  return { dexId: "raydium", liquidityUsd: 0, ...partial };
}

describe("pickReplayPair", () => {
  it("picks the highest-liquidity pair", () => {
    const pairs = [pair({ pairAddress: "A", liquidityUsd: 100 }), pair({ pairAddress: "B", liquidityUsd: 500 })];
    expect(pickReplayPair(pairs)?.pairAddress).toBe("B");
  });
  it("honours an explicit pairAddress", () => {
    const pairs = [pair({ pairAddress: "A", liquidityUsd: 100 }), pair({ pairAddress: "B", liquidityUsd: 500 })];
    expect(pickReplayPair(pairs, "A")?.pairAddress).toBe("A");
  });
  it("returns null with no pairs", () => {
    expect(pickReplayPair([])).toBeNull();
  });
});

describe("normalizeOhlcvList", () => {
  it("parses GeckoTerminal rows and sorts oldest-first", () => {
    const raw = {
      data: {
        attributes: {
          ohlcv_list: [
            [T0 / 1000 + 60, 2, 2.1, 1.9, 2.05, 10],
            [T0 / 1000, 1, 1.2, 0.9, 1.1, 5],
          ],
        },
      },
    };
    const out = normalizeOhlcvList(raw);
    expect(out).toHaveLength(2);
    expect(out[0].timeMs).toBe(T0);
    expect(out[0].close).toBe(1.1);
    expect(out[1].close).toBe(2.05);
  });
  it("drops malformed rows and never invents a price", () => {
    const raw = { data: { attributes: { ohlcv_list: [[T0 / 1000, 0, 0, 0, 0, 0], "junk", [T0 / 1000 + 60, 1, 1, 1, 1, 1]] } } };
    expect(normalizeOhlcvList(raw)).toHaveLength(1);
    expect(normalizeOhlcvList(null)).toEqual([]);
  });
});

describe("normalizeTradeList", () => {
  it("parses buy/sell trades with maker + volume", () => {
    const raw = {
      data: [
        { attributes: { block_timestamp: "2026-01-01T00:01:00Z", kind: "buy", tx_hash: "h1", tx_from_address: "W1", volume_in_usd: "12.5", price_to_in_usd: "0.01" } },
        { attributes: { block_timestamp: "2026-01-01T00:00:00Z", kind: "sell", tx_hash: "h2", tx_from_address: "W2", volume_in_usd: "3", price_to_in_usd: "0.009" } },
      ],
    };
    const out = normalizeTradeList(raw);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe("sell"); // sorted oldest-first
    expect(out[1].maker).toBe("W1");
    expect(out[1].volumeUsd).toBe(12.5);
  });
  it("drops trades with no timestamp or unknown kind", () => {
    const raw = { data: [{ attributes: { kind: "buy" } }, { attributes: { block_timestamp: "2026-01-01T00:00:00Z", kind: "swap" } }] };
    expect(normalizeTradeList(raw)).toEqual([]);
  });
});

describe("buildMinuteSeries + detectGaps", () => {
  it("leaves missing minutes as null candles — never interpolates", () => {
    const candles = [
      { timeMs: T0, open: 1, high: 1, low: 1, close: 1, volumeUsd: 0 },
      { timeMs: T0 + 3 * 60_000, open: 1, high: 1, low: 1, close: 2, volumeUsd: 0 },
    ];
    const minutes = buildMinuteSeries(candles, [], T0, T0 + 3 * 60_000);
    expect(minutes).toHaveLength(4);
    expect(minutes[0].candle?.close).toBe(1);
    expect(minutes[1].candle).toBeNull();
    expect(minutes[2].candle).toBeNull();
    expect(minutes[3].candle?.close).toBe(2);
    const gaps = detectGaps(minutes);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].minutes).toBe(2);
    expect(gaps[0].startMs).toBe(T0 + 60_000);
  });

  it("buckets trades into their minute for the tape", () => {
    const candles = [
      { timeMs: T0, open: 1, high: 1, low: 1, close: 1, volumeUsd: 0 },
      { timeMs: T0 + 60_000, open: 1, high: 1, low: 1, close: 1, volumeUsd: 0 },
    ];
    const trades = [
      { txHash: "a", timeMs: T0 + 10_000, maker: "W1", kind: "buy" as const, priceUsd: 1, volumeUsd: 5 },
      { txHash: "b", timeMs: T0 + 70_000, maker: "W2", kind: "sell" as const, priceUsd: 1, volumeUsd: 7 },
    ];
    const minutes = buildMinuteSeries(candles, trades, T0, T0 + 60_000);
    expect(minutes[0].buys).toBe(1);
    expect(minutes[0].buyVolumeUsd).toBe(5);
    expect(minutes[1].sells).toBe(1);
    expect(minutes[1].sellVolumeUsd).toBe(7);
  });
});

describe("deriveMarkers", () => {
  const trades = [
    { txHash: "first", timeMs: T0, maker: "B1", kind: "buy" as const, priceUsd: 0.01, volumeUsd: 10 },
    { txHash: "big", timeMs: T0 + 60_000, maker: "B2", kind: "buy" as const, priceUsd: 0.02, volumeUsd: 5000 },
    { txHash: "dev", timeMs: T0 + 120_000, maker: "DEVWALLET", kind: "sell" as const, priceUsd: 0.03, volumeUsd: 900 },
    { txHash: "other", timeMs: T0 + 180_000, maker: "SOMEONE", kind: "sell" as const, priceUsd: 0.03, volumeUsd: 50 },
  ];

  it("flags pair creation, first buy, big buys, largest sell and dev sells", () => {
    const markers = deriveMarkers({ trades, devWallet: "DEVWALLET", launchAtMs: T0, tradesCoverLaunch: true });
    expect(markers.map((m) => m.kind)).toEqual(["pair-created", "first-buy", "big-buy", "dev-sell", "big-sell"]);
    expect(markers.find((m) => m.kind === "dev-sell")?.txHash).toBe("dev");
    expect(markers.find((m) => m.kind === "first-buy")?.label).toBe("First buy");
    // The 900-sell is the dev sell, so the largest-sell marker is the 50-sell.
    expect(markers.find((m) => m.kind === "big-sell")?.txHash).toBe("other");
  });

  it("skips the largest-sell marker when the largest sell is already a dev sell", () => {
    const onlyDevSell = [
      { txHash: "first", timeMs: T0, maker: "B1", kind: "buy" as const, priceUsd: 0.01, volumeUsd: 10 },
      { txHash: "dev", timeMs: T0 + 120_000, maker: "DEVWALLET", kind: "sell" as const, priceUsd: 0.03, volumeUsd: 900 },
    ];
    const markers = deriveMarkers({ trades: onlyDevSell, devWallet: "DEVWALLET", launchAtMs: T0, tradesCoverLaunch: true });
    expect(markers.some((m) => m.kind === "big-sell")).toBe(false);
    expect(markers.some((m) => m.kind === "dev-sell")).toBe(true);
  });

  it("adds ATH + peak-volume markers from real candles only", () => {
    const candles = [
      { timeMs: T0, open: 1, high: 1, low: 1, close: 1, volumeUsd: 10 },
      { timeMs: T0 + 60_000, open: 1, high: 3, low: 1, close: 3, volumeUsd: 500 },
      { timeMs: T0 + 120_000, open: 3, high: 3, low: 2, close: 2, volumeUsd: 40 },
    ];
    const markers = deriveMarkers({ trades, devWallet: null, launchAtMs: T0, tradesCoverLaunch: true, candles });
    expect(markers.find((m) => m.kind === "ath")?.timeMs).toBe(T0 + 60_000);
    expect(markers.find((m) => m.kind === "peak-volume")?.timeMs).toBe(T0 + 60_000);
    expect(markers.find((m) => m.kind === "peak-volume")?.volumeUsd).toBe(500);
  });

  it("adds no ATH / peak-volume markers without candles", () => {
    const markers = deriveMarkers({ trades, devWallet: null, launchAtMs: T0, tradesCoverLaunch: true });
    expect(markers.some((m) => m.kind === "ath" || m.kind === "peak-volume")).toBe(false);
  });

  it("labels the first buy honestly when trades do not reach launch", () => {
    const markers = deriveMarkers({ trades, devWallet: null, launchAtMs: T0, tradesCoverLaunch: false });
    expect(markers.find((m) => m.kind === "first-buy")?.label).toBe("First buy in available data");
  });

  it("never flags a dev sell without a dev wallet", () => {
    const markers = deriveMarkers({ trades, devWallet: null, launchAtMs: null, tradesCoverLaunch: false });
    expect(markers.some((m) => m.kind === "dev-sell")).toBe(false);
  });

  it("never flags a sell from another wallet as a dev sell", () => {
    const markers = deriveMarkers({ trades, devWallet: "SOMEONE-ELSE", launchAtMs: null, tradesCoverLaunch: false });
    expect(markers.some((m) => m.kind === "dev-sell")).toBe(false);
  });
});

describe("analyzePriceExtremes", () => {
  it("finds ATH, max drawdown from ATH, and the peak-volume minute", () => {
    const candles = [
      { timeMs: T0, open: 1, high: 1, low: 1, close: 1, volumeUsd: 10 },
      { timeMs: T0 + 60_000, open: 1, high: 2, low: 1, close: 2, volumeUsd: 500 },
      { timeMs: T0 + 120_000, open: 2, high: 2, low: 1, close: 1, volumeUsd: 40 },
      { timeMs: T0 + 180_000, open: 1, high: 1.5, low: 1, close: 1.5, volumeUsd: 20 },
    ];
    const ex = analyzePriceExtremes(candles);
    expect(ex.athPrice).toBe(2);
    expect(ex.athTimeMs).toBe(T0 + 60_000);
    expect(ex.maxDrawdownPct).toBeCloseTo(50, 10);
    expect(ex.troughTimeMs).toBe(T0 + 120_000);
    expect(ex.peakVolumeMinute).toEqual({ timeMs: T0 + 60_000, volumeUsd: 500 });
  });

  it("reports 0% drawdown when the price never falls, and nulls with no candles", () => {
    const rising = [
      { timeMs: T0, open: 1, high: 1, low: 1, close: 1, volumeUsd: 0 },
      { timeMs: T0 + 60_000, open: 1, high: 2, low: 1, close: 2, volumeUsd: 0 },
    ];
    const ex = analyzePriceExtremes(rising);
    expect(ex.maxDrawdownPct).toBe(0);
    expect(ex.troughTimeMs).toBeNull();
    expect(analyzePriceExtremes([])).toEqual({
      athPrice: null,
      athTimeMs: null,
      maxDrawdownPct: null,
      troughTimeMs: null,
      peakVolumeMinute: null,
    });
  });
});

describe("analyzeEarlyBuyers", () => {
  const trades = [
    { txHash: "a", timeMs: T0 + 60_000, maker: "W1", kind: "buy" as const, priceUsd: 1, volumeUsd: 5 },
    { txHash: "b", timeMs: T0 + 120_000, maker: "W1", kind: "buy" as const, priceUsd: 1, volumeUsd: 5 },
    { txHash: "c", timeMs: T0 + 9 * 60_000, maker: "W2", kind: "buy" as const, priceUsd: 1, volumeUsd: 5 },
    { txHash: "d", timeMs: T0 + 11 * 60_000, maker: "W3", kind: "buy" as const, priceUsd: 1, volumeUsd: 5 },
    { txHash: "e", timeMs: T0 + 30 * 60_000, maker: "W1", kind: "sell" as const, priceUsd: 1, volumeUsd: 5 },
    { txHash: "f", timeMs: T0 + 40 * 60_000, maker: "W2", kind: "sell" as const, priceUsd: 1, volumeUsd: 5 },
  ];

  it("counts distinct makers in the first 10 minutes and who sold by the cursor", () => {
    const stats = analyzeEarlyBuyers(trades, T0, T0 + 35 * 60_000);
    expect(stats.count).toBe(2); // W1, W2 (W3 bought at T+11m — too late)
    expect(stats.makers).toEqual(["W1", "W2"]);
    expect(stats.soldCount).toBe(1); // W1 sold by T+35m; W2 sells at T+40m
  });

  it("counts 0 sold before any early buyer sells", () => {
    const stats = analyzeEarlyBuyers(trades, T0, T0 + 5 * 60_000);
    expect(stats.count).toBe(2);
    expect(stats.soldCount).toBe(0);
  });

  it("returns zeros with no start time", () => {
    expect(analyzeEarlyBuyers(trades, null, T0)).toEqual({ count: 0, soldCount: 0, makers: [] });
  });
});

describe("fetchReplayTradesServer", () => {
  it("calls /api/ogdex/replay-trades with mint/pair/window and maps the response", async () => {
    const body = {
      ok: true,
      source: "birdeye",
      coversWindow: true,
      trades: [
        { txHash: "b1", timeMs: T0 + 60_000, maker: "W1", kind: "buy", priceUsd: 0.01, volumeUsd: 10 },
        { txHash: "s1", timeMs: T0, maker: "W2", kind: "sell", priceUsd: 0.009, volumeUsd: 3 },
      ],
    };
    const fetchMock = vi.fn(async (_url: string, _init?: unknown) => ({ ok: true, status: 200, json: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchReplayTradesServer({ mint: "Mint111111111111111111111111111111111111111", pairAddress: "Pool1", fromMs: T0, toMs: T0 + 3_600_000 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/ogdex/replay-trades?mint=Mint111111111111111111111111111111111111111");
    expect(url).toContain("pair=Pool1");
    expect(url).toContain(`from=${T0}`);
    expect(r.source).toBe("birdeye");
    expect(r.coversWindow).toBe(true);
    expect(r.trades).toHaveLength(2);
    expect(r.trades[0].txHash).toBe("s1"); // oldest-first
  });

  it("throws on a non-OK response so the caller can fall back to GeckoTerminal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(
      fetchReplayTradesServer({ mint: "Mint111111111111111111111111111111111111111", pairAddress: "Pool1", fromMs: T0, toMs: T0 + 1000 }),
    ).rejects.toThrow("replay-trades → 500");
  });

  it("drops rows with an unknown kind instead of inventing a side", async () => {
    const body = {
      ok: true,
      source: "geckoterminal-recent",
      coversWindow: false,
      trades: [
        { txHash: "ok", timeMs: T0, maker: "W1", kind: "buy", priceUsd: 1, volumeUsd: 1 },
        { txHash: "bad", timeMs: T0, maker: "W1", kind: "swap", priceUsd: 1, volumeUsd: 1 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
    const r = await fetchReplayTradesServer({ mint: "Mint111111111111111111111111111111111111111", pairAddress: "Pool1", fromMs: T0, toMs: T0 + 1000 });
    expect(r.trades).toHaveLength(1);
    expect(r.source).toBe("geckoterminal-recent");
  });
});
