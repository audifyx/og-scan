/**
 * Trades-record validation + volume ranking tests (offline, pure helpers).
 * The record endpoint's auth/ownership checks are server-side (Supabase JWT
 * + profiles.wallet_address) and are verified live after deploy, not here.
 */
import { describe, it, expect } from "vitest";
import { validateTrade, rankVolume } from "./_trades.js";

const WALLET = "DYviQ3ytKT4o5oCP5Ueo8jthyXweNgBxajhQjBKAJeKW";
const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const SIG = "5U7Z1v8kQm2x9pL4wR6tY3uH8jK1nB5vC2dF7gH9jK3mN6pQ8rS4tU7vW2xY5zA9bC1dE3fG6hJ8kL";

const base = (over = {}) => ({
  wallet_address: WALLET,
  mint: MINT,
  symbol: "ORBITX",
  side: "buy",
  token_amount: 1000,
  sol_amount: 0.05,
  usd_amount: 12.5,
  fee_usd: 0.06,
  tx_signature: SIG,
  ...over,
});

describe("validateTrade", () => {
  it("accepts a well-formed buy", () => {
    const v = validateTrade(base());
    expect(v.ok).toBe(true);
    expect(v.trade.side).toBe("buy");
    expect(v.trade.source).toBe("app");
    expect(v.trade.fee_usd).toBe(0.06);
  });

  it("rejects a bad wallet address", () => {
    expect(validateTrade(base({ wallet_address: "not-an-address" })).ok).toBe(false);
  });

  it("rejects a bad mint", () => {
    expect(validateTrade(base({ mint: "xyz" })).ok).toBe(false);
  });

  it("rejects a side other than buy/sell", () => {
    expect(validateTrade(base({ side: "hold" })).ok).toBe(false);
  });

  it("rejects zero or negative token_amount", () => {
    expect(validateTrade(base({ token_amount: 0 })).ok).toBe(false);
    expect(validateTrade(base({ token_amount: -5 })).ok).toBe(false);
  });

  it("rejects negative usd_amount but allows zero (dust / failed quote)", () => {
    expect(validateTrade(base({ usd_amount: -1 })).ok).toBe(false);
    expect(validateTrade(base({ usd_amount: 0 })).ok).toBe(true);
  });

  it("rejects a missing tx_signature (idempotency key is required)", () => {
    expect(validateTrade(base({ tx_signature: "" })).ok).toBe(false);
  });

  it("defaults source to app and normalises web", () => {
    expect(validateTrade(base()).trade.source).toBe("app");
    expect(validateTrade(base({ source: "web" })).trade.source).toBe("web");
    expect(validateTrade(base({ source: "bogus" })).trade.source).toBe("app");
  });
});

describe("rankVolume", () => {
  it("ranks by 30d volume desc, then all-time, and numbers ranks from 1", () => {
    const rows = [
      { wallet_address: "A", volume_usd_30d: "10", trade_count_30d: 1, volume_usd_all: "100", trade_count_all: 5 },
      { wallet_address: "B", volume_usd_30d: "50", trade_count_30d: 3, volume_usd_all: "50", trade_count_all: 3 },
      { wallet_address: "C", volume_usd_30d: "50", trade_count_30d: 2, volume_usd_all: "999", trade_count_all: 9 },
    ];
    const ranked = rankVolume(rows);
    expect(ranked.map((r) => r.wallet_address)).toEqual(["C", "B", "A"]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[2].rank).toBe(3);
    expect(ranked[0].volume_usd_30d).toBe(50);
  });

  it("returns an empty board for no rows and respects the limit", () => {
    expect(rankVolume([])).toEqual([]);
    const rows = Array.from({ length: 60 }, (_, i) => ({
      wallet_address: `W${i}`, volume_usd_30d: String(60 - i), volume_usd_all: "0",
    }));
    expect(rankVolume(rows, 50)).toHaveLength(50);
  });
});
