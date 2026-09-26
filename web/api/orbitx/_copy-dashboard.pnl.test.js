/**
 * Copy-dashboard PnL builder — average-cost reconstruction unit tests.
 * Pure functions, no DB, no network.
 */
import { describe, it, expect } from "vitest";
import { buildBook, finalize } from "./_copy-dashboard.js";

const T = "So11111111111111111111111111111111111111112";
const prices = new Map([[T, { price: 1.5, symbol: "TOK" }]]);

describe("buildBook average-cost PnL", () => {
  it("books a partial sell as a win with correct remaining cost", () => {
    const book = buildBook([
      { side: "buy", mint: T, symbol: "TOK", amount: 100, priceUsd: 1, at: "2026-09-26T00:00:00Z" },
      { side: "sell", mint: T, symbol: "TOK", fraction: 0.5, priceUsd: 2, at: "2026-09-26T01:00:00Z" },
    ]);
    const s = finalize(book, prices);
    expect(s.totalBuys).toBe(1);
    expect(s.totalSells).toBe(1);
    expect(s.totalRealized).toBeCloseTo(50, 6); // 50*2 proceeds - 50*1 cost
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(0);
    const t = s.perToken[0];
    expect(t.openAmount).toBeCloseTo(50, 6);
    expect(t.unrealizedPnl).toBeCloseTo(50 * 1.5 - 50, 6); // open value - remaining cost
    expect(t.openValueUsd).toBeCloseTo(75, 6);
    expect(s.openPositions).toBe(1);
  });

  it("books a loss when the sell is underwater", () => {
    const book = buildBook([
      { side: "buy", mint: T, symbol: "TOK", amount: 100, priceUsd: 1, at: 1 },
      { side: "sell", mint: T, symbol: "TOK", fraction: 1, priceUsd: 0.4, at: 2 },
    ]);
    const s = finalize(book, prices);
    expect(s.totalRealized).toBeCloseTo(-60, 6);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBe(0);
    expect(s.openPositions).toBe(0);
  });

  it("skips priceUsd=0 without NaN", () => {
    const book = buildBook([
      { side: "buy", mint: T, symbol: "TOK", amount: 100, priceUsd: 0, at: 1 },
      { side: "buy", mint: T, symbol: "TOK", amount: 100, priceUsd: 1, at: 2 },
    ]);
    const s = finalize(book, prices);
    expect(Number.isNaN(s.totalRealized)).toBe(false);
    expect(s.perToken[0].openAmount).toBeCloseTo(100, 6);
  });

  it("derives fraction from amount for theirTrades (no fraction field)", () => {
    const book = buildBook([
      { side: "buy", mint: T, symbol: "TOK", amount: 200, priceUsd: 1, at: 1 },
      { side: "sell", mint: T, symbol: "TOK", amount: 200, priceUsd: 1.25, at: 2 },
    ]);
    const s = finalize(book, prices);
    expect(s.totalRealized).toBeCloseTo(50, 6);
    expect(s.wins).toBe(1);
  });

  it("ignores sells when there is no open position", () => {
    const book = buildBook([{ side: "sell", mint: T, symbol: "TOK", fraction: 1, priceUsd: 5, at: 1 }]);
    const s = finalize(book, prices);
    expect(s.totalRealized).toBe(0);
    expect(s.totalSells).toBe(1);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(0);
  });

  it("clamps oversized fraction to 1", () => {
    const book = buildBook([
      { side: "buy", mint: T, symbol: "TOK", amount: 10, priceUsd: 1, at: 1 },
      { side: "sell", mint: T, symbol: "TOK", fraction: 5, priceUsd: 2, at: 2 },
    ]);
    const s = finalize(book, prices);
    expect(s.totalRealized).toBeCloseTo(10, 6);
    expect(s.openPositions).toBe(0);
  });
});
