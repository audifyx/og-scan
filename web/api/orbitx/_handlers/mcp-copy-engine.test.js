/**
 * Copy-engine unit tests — parseSwap against realistic Helius enhanced SWAP
 * payloads, theirTrades dedupe + 200-cap, and mirrorNewSwaps idempotency.
 *
 * NEVER executes a real trade: _mcp-app-wallet.js is fully mocked (trade,
 * claim, pricing, and db modules). We exercise parse/persist/dedupe by
 * importing the engine directly.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  tokenInfo: vi.fn(),
  walletRow: vi.fn(),
  tokenBalance: vi.fn(),
  appWalletBuy: vi.fn(),
  appWalletSell: vi.fn(),
  claimFillRow: vi.fn(),
  resolveFillRow: vi.fn(),
  sb: vi.fn(),
}));

vi.mock("./_mcp-app-wallet.js", () => ({
  tokenInfo: mocks.tokenInfo,
  walletRow: mocks.walletRow,
  tokenBalance: mocks.tokenBalance,
  appWalletBuy: mocks.appWalletBuy,
  appWalletSell: mocks.appWalletSell,
  USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  claimFillRow: mocks.claimFillRow,
  resolveFillRow: mocks.resolveFillRow,
  isFillOpen: (meta, openValue = "open") => (meta?.status ?? openValue) === openValue,
  FILL_STATUS: "filling",
  sb: mocks.sb,
}));

import {
  parseSwap,
  recordTheirTrades,
  mirrorNewSwaps,
  THEIR_TRADES_CAP,
} from "./_mcp-copy-engine.js";

const WALLET = "9CNyLECt2j8tnDhqxtjYk5HUhZ2b8Nwnyb7sfYN7vND2";
const TOKENX = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const SOL = "So11111111111111111111111111111111111111112";
const JUP = "JUP6LkbZVeYwSMM5G8hEfgb5qfxAPK8Q4vGpKq7XyZ12";

function swapTx({ signature, from, to, fromMint, toMint, fromAmt, toAmt, type = "SWAP" }) {
  return {
    signature,
    type,
    slot: 345678901,
    tokenTransfers: [
      { fromUserAccount: from, toUserAccount: "JUPpool111111111111111111111111111111111", mint: fromMint, tokenAmount: fromAmt },
      { fromUserAccount: "JUPpool111111111111111111111111111111111", toUserAccount: to, mint: toMint, tokenAmount: toAmt },
    ],
  };
}

const buyTx = swapTx({
  signature: "3j284jFMD9jVxMzCT2uakCZSEYd67m3tAYcsLbaatfikuPCTHz8qrAmyPEbNddxvrUftnDJc15C6MjNhkzgScxme",
  from: WALLET, to: WALLET, fromMint: SOL, toMint: TOKENX, fromAmt: 0.42, toAmt: 15010.5,
});
const sellTx = swapTx({
  signature: "UDm9KMFk473uwRHZJf9LZXnrzDDCTpheMGA4kCYUpF2u7XwcR8aZ9i697c3theD1krMJrfgbmqYvGKMUgf9HrYe",
  from: WALLET, to: WALLET, fromMint: TOKENX, toMint: SOL, fromAmt: 15010.5, toAmt: 0.41,
});

/* ------------------------------------------------------------------ */

describe("parseSwap vs realistic Helius enhanced SWAP payloads", () => {
  it("parses a buy: SOL out (quote leg skipped), TOKENX in", () => {
    const s = parseSwap(buyTx, WALLET);
    expect(s).toMatchObject({
      signature: buyTx.signature,
      bought: { mint: TOKENX, amount: 15010.5 },
      sold: null,
    });
  });

  it("parses a sell: TOKENX out, SOL in (quote leg skipped)", () => {
    const s = parseSwap(sellTx, WALLET);
    expect(s).toMatchObject({
      signature: sellTx.signature,
      bought: null,
      sold: { mint: TOKENX, amount: 15010.5 },
    });
  });

  it("detects a swap from transfer direction even without type=SWAP", () => {
    const tx = { ...buyTx, type: undefined };
    const s = parseSwap(tx, WALLET);
    expect(s?.bought).toMatchObject({ mint: TOKENX, amount: 15010.5 });
  });

  it("returns null for a plain transfer that only touches the wallet one way", () => {
    const tx = {
      signature: "abc",
      type: "TRANSFER",
      tokenTransfers: [{ fromUserAccount: WALLET, toUserAccount: JUP, mint: TOKENX, tokenAmount: 5 }],
    };
    expect(parseSwap(tx, WALLET)).toBeNull();
  });

  it("returns null when only quote legs moved", () => {
    const tx = swapTx({
      signature: "q", from: WALLET, to: WALLET,
      fromMint: SOL, toMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", fromAmt: 1, toAmt: 100,
    });
    expect(parseSwap(tx, WALLET)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("recordTheirTrades: dedupe + 200-cap", () => {
  it("dedupes by signature+side, keeps both legs of one tx", () => {
    const existing = [{ signature: "A", side: "buy", mint: "m", symbol: "S", amount: 1, theirUsd: 1, priceUsd: 1, at: "t" }];
    const out = recordTheirTrades(existing, [
      { signature: "A", side: "buy", mint: "m", symbol: "S", amount: 1, theirUsd: 1, priceUsd: 1, at: "t" }, // dup
      { signature: "A", side: "sell", mint: "m2", symbol: "S2", amount: 2, theirUsd: 2, priceUsd: 1, at: "t" },
      { signature: "B", side: "buy", mint: "m3", symbol: "S3", amount: 3, theirUsd: 3, priceUsd: 1, at: "t" },
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((t) => `${t.signature}|${t.side}`)).toEqual(["A|buy", "A|sell", "B|buy"]);
  });

  it("caps at 200, dropping the oldest", () => {
    expect(THEIR_TRADES_CAP).toBe(200);
    const existing = Array.from({ length: 200 }, (_, i) => ({
      signature: `old${i}`, side: "buy", mint: "m", symbol: "S", amount: 1, theirUsd: 1, priceUsd: 1, at: "t",
    }));
    const out = recordTheirTrades(existing, [
      { signature: "new0", side: "buy", mint: "m", symbol: "S", amount: 1, theirUsd: 1, priceUsd: 1, at: "t" },
    ]);
    expect(out).toHaveLength(200);
    expect(out[0].signature).toBe("old1"); // oldest dropped
    expect(out[199].signature).toBe("new0");
  });
});

/* ------------------------------------------------------------------ */

const fakeClient = {
  from: () => ({
    update: () => ({
      eq: () => ({
        neq: async () => ({ data: [{ id: "row1" }], error: null }),
        eq: async () => ({ data: [{ id: "row1" }], error: null }),
      }),
    }),
  }),
};

function followRow(overrides = {}) {
  return {
    id: "row1",
    meta: {
      followedWallet: WALLET,
      mode: "percent_of_their_size",
      sizeValue: 100,
      maxPerTradeUsd: 0.5,
      status: "active",
      seenSigs: [],
      fills: [],
      ...overrides,
    },
  };
}

describe("mirrorNewSwaps idempotency (mocked trade path — no live trades)", () => {
  let resolvedPatches;
  beforeEach(() => {
    vi.clearAllMocks();
    resolvedPatches = [];
    mocks.tokenInfo.mockImplementation(async (mint) => ({ mint, symbol: "TKN", priceUsd: 0.0001 }));
    mocks.appWalletBuy.mockImplementation(async () => ({ ok: true, signature: "M".repeat(88) }));
    mocks.claimFillRow.mockImplementation(async (client, rowId, meta) => ({
      ...meta,
      status: "filling",
      fillingAt: new Date().toISOString(),
    }));
    mocks.resolveFillRow.mockImplementation(async (client, rowId, patch) => {
      resolvedPatches.push(patch);
      return true;
    });
  });

  it("delivering the same signature twice yields one mirror record and one theirTrade", async () => {
    const s = parseSwap(buyTx, WALLET);
    // theirUsd = 0.0001 * 15010.5 = 1.50105 -> 100% -> capped to maxPerTradeUsd 0.5 -> executes
    const r1 = await mirrorNewSwaps("user1", followRow(), fakeClient, [s], {});
    expect(r1.status).toBe("ok");
    expect(mocks.claimFillRow).toHaveBeenCalledTimes(1);
    expect(mocks.appWalletBuy).toHaveBeenCalledTimes(1);
    expect(mocks.appWalletBuy).toHaveBeenCalledWith(
      { userId: "user1", source: "tick" },
      { mint: TOKENX, usd: 0.5 }
    );

    const patch1 = resolvedPatches[0];
    expect(patch1.seenSigs).toContain(buyTx.signature);
    expect(patch1.fills).toHaveLength(1);
    expect(patch1.fills[0]).toMatchObject({ side: "buy", mint: TOKENX, ok: true, sig: "M".repeat(88) });
    expect(patch1.theirTrades).toHaveLength(1);
    expect(patch1.theirTrades[0]).toMatchObject({
      signature: buyTx.signature,
      side: "buy",
      mint: TOKENX,
      symbol: "TKN",
      amount: 15010.5,
      theirUsd: 1.50105,
      priceUsd: 0.0001,
    });
    expect(typeof patch1.theirTrades[0].at).toBe("string");

    // Second delivery of the SAME signature — as if Helius redelivered or the
    // tick re-polled: row re-read from DB carries the updated meta.
    const r2 = await mirrorNewSwaps("user1", { id: "row1", meta: patch1 }, fakeClient, [s], {});
    expect(r2.status).toBe("ok");
    expect(r2.mirrors).toHaveLength(0);
    expect(mocks.claimFillRow).toHaveBeenCalledTimes(1); // no re-claim: nothing new
    expect(mocks.appWalletBuy).toHaveBeenCalledTimes(1); // NO second trade
    expect(mocks.resolveFillRow).toHaveBeenCalledTimes(1); // no second resolve
  });

  it("a dust-skipped mirror still records theirTrade exactly once", async () => {
    mocks.tokenInfo.mockImplementation(async (mint) => ({ mint, symbol: "TKN", priceUsd: 0 })); // theirUsd 0 -> below $0.50 floor
    const s = parseSwap(buyTx, WALLET);
    const r1 = await mirrorNewSwaps("user1", followRow(), fakeClient, [s], {});
    expect(r1.status).toBe("ok");
    expect(mocks.appWalletBuy).not.toHaveBeenCalled();
    const patch1 = resolvedPatches[0];
    expect(patch1.fills).toHaveLength(1);
    expect(patch1.fills[0]).toMatchObject({ side: "buy", ok: false, error: "dust", skipped: true });
    expect(patch1.theirTrades).toHaveLength(1);
    expect(patch1.theirTrades[0]).toMatchObject({ signature: buyTx.signature, side: "buy", amount: 15010.5 });

    const r2 = await mirrorNewSwaps("user1", { id: "row1", meta: patch1 }, fakeClient, [s], {});
    expect(r2.mirrors).toHaveLength(0);
    expect(mocks.appWalletBuy).not.toHaveBeenCalled();
  });
});
