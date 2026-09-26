/**
 * Staleness-guard unit tests at the tick module level (_mcp-copy.js re-exports
 * markStaleBuys from the shared copy engine). markStaleBuys is pure: no
 * trades, no DB, no network. Sibling handler modules are mocked.
 *
 * Regression test for the 2026-09-26 SIFT incident: the leader bought SIFT at
 * 15:22:52, sold half at 15:25:05, and the tick mirrored the buy at 15:27:47 —
 * buying what the leader was already exiting. A buy flagged stale must never
 * reach mirrorSwap.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("./_mcp-app-wallet.js", () => ({
  needAuth: vi.fn(),
  sb: vi.fn(),
  tokenInfo: vi.fn(),
  walletRow: vi.fn(),
  tokenBalance: vi.fn(),
  appWalletBuy: vi.fn(),
  appWalletSell: vi.fn(),
  USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  claimFillRow: vi.fn(),
  resolveFillRow: vi.fn(),
  isFillOpen: (meta, openValue = "open") => (meta?.status ?? openValue) === openValue,
  FILL_STATUS: "filling",
}));

vi.mock("./_user-trading-wallet.js", () => ({
  SOL_MINT: "So11111111111111111111111111111111111111112",
  TICK_AUTH_SOURCE: "tick",
}));

import { markStaleBuys } from "./_mcp-copy.js";

const TOKENX = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const JUP = "JUP6LkbZVeYwSMM5G8hEfgb5qfxAPK8Q4vGpKq7XyZ12";

const mk = (signature, bought, sold) => ({
  signature,
  bought: bought ? { mint: bought, amount: 100 } : null,
  sold: sold ? { mint: sold, amount: 50 } : null,
});

describe("markStaleBuys: never mirror a buy the leader already exited", () => {
  it("flags a buy stale when the leader sold the same mint in a newer swap", () => {
    const swaps = [mk("buy1", TOKENX, null), mk("sell1", null, TOKENX)]; // oldest-first
    markStaleBuys(swaps);
    expect(swaps[0].staleBuy).toBe(true);
    expect(swaps[1].staleBuy).toBe(false); // sells are never "stale buys"
  });

  it("leaves a buy fresh when the leader never sold that mint after", () => {
    const swaps = [mk("buy1", TOKENX, null), mk("buy2", JUP, null)];
    markStaleBuys(swaps);
    expect(swaps[0].staleBuy).toBe(false);
    expect(swaps[1].staleBuy).toBe(false);
  });

  it("buy -> sell -> rebuy: first buy stale, rebuy fresh", () => {
    const swaps = [mk("buy1", TOKENX, null), mk("sell1", null, TOKENX), mk("buy2", TOKENX, null)];
    markStaleBuys(swaps);
    expect(swaps[0].staleBuy).toBe(true);
    expect(swaps[2].staleBuy).toBe(false);
  });

  it("a sell of another mint does not stale the buy", () => {
    const swaps = [mk("buy1", TOKENX, null), mk("sell1", null, JUP)];
    markStaleBuys(swaps);
    expect(swaps[0].staleBuy).toBe(false);
  });

  it("an older sell does not stale a newer buy", () => {
    const swaps = [mk("sell1", null, TOKENX), mk("buy1", TOKENX, null)];
    markStaleBuys(swaps);
    expect(swaps[1].staleBuy).toBe(false);
  });

  it("handles empty input", () => {
    expect(markStaleBuys([])).toEqual([]);
    expect(markStaleBuys(null)).toEqual(null);
  });
});
