import { describe, expect, it } from "vitest";
import {
  buildMinuteSeries,
  deriveMarkers,
  detectGaps,
  normalizeOhlcvList,
  normalizeTradeList,
  pickReplayPair,
} from "./hooks/useLaunchReplay";
import type { DexPair } from "./api/client";

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

  it("flags pair creation, first buy, big buys and dev sells only", () => {
    const markers = deriveMarkers({ trades, devWallet: "DEVWALLET", launchAtMs: T0, tradesCoverLaunch: true });
    expect(markers.map((m) => m.kind)).toEqual(["pair-created", "first-buy", "big-buy", "dev-sell"]);
    expect(markers.find((m) => m.kind === "dev-sell")?.txHash).toBe("dev");
    expect(markers.find((m) => m.kind === "first-buy")?.label).toBe("First buy");
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
