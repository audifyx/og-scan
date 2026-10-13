// @vitest-environment node
// Regression tests — wallet-data audit (2026-10-13).
// Exact repro wallet: 4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu
// Exact repro mint:  13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9 (ORBITX)
//
// Covers: swap vs transfer classification (program-based), USDC-leg swaps,
// lamports->SOL, token decimals, no-silent-zero balance responses, live
// exact-wallet verification (holdings via tx-derived fallback, swaps,
// tx history), genuine zero-balance wallets, and pagination.
import { describe, expect, it } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import { parseSwap, parseTx, DEX_PROGRAMS } from "../_swap.js";
import {
  lamportsToSol,
  rawToUi,
  parseTokenAccountData,
  parseMintDecimals,
  scanWalletTxs,
} from "../_txscan.js";
import { buildBalanceResponse } from "./_balance.js";
import balanceHandler from "./_balance.js";
import swapsHandler from "./_swaps.js";
import walletTxHandler from "./_wallet-tx.js";
import walletHandler from "./_wallet.js";

const WALLET = "4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu";
const ORBITX = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MEME = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn"; // PUMP mint, used as a stand-in test token
const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function fakeTx({ programs, preSol, postSol, preToken = [], postToken = [], err = null, fee = 5000 }) {
  return {
    blockTime: 1700000000,
    meta: {
      err,
      fee,
      preBalances: [preSol],
      postBalances: [postSol],
      preTokenBalances: preToken,
      postTokenBalances: postToken,
    },
    transaction: {
      signatures: ["sig-test"],
      message: {
        accountKeys: [{ pubkey: WALLET }],
        instructions: programs.map((programId) => ({ programId, innerInstructions: [] })),
      },
    },
  };
}
const tok = (mint, uiAmount) => ({ owner: WALLET, mint, uiTokenAmount: { uiAmount, decimals: 6 } });

function mockRes() {
  const headers = {};
  const res = {
    headers,
    body: null,
    statusCode: null,
    setHeader(k, v) { headers[k] = v; },
    getHeader(k) { return headers[k]; },
    status(code) {
      this.statusCode = code;
      return { send: (b) => { this.body = b; } };
    },
    end(b) { this.body = b; },
  };
  return res;
}
const bodyOf = (res) => JSON.parse(res.body);

describe("swap vs transfer classification (program-based)", () => {
  it("Jupiter swap (SOL out, token in, DEX program) is a buy swap", () => {
    const tx = fakeTx({
      programs: [JUPITER],
      preSol: 1_100_000_000,
      postSol: 1_000_000_000,
      postToken: [tok(MEME, 1000)],
    });
    const c = parseTx(tx, WALLET);
    expect(c.kind).toBe("swap");
    expect(c.side).toBe("buy");
    expect(c.mint).toBe(MEME);
    expect(c.tokenAmount).toBe(1000);
    expect(parseSwap(tx, WALLET)).not.toBeNull();
  });

  it("USDC-leg swap (stable out, token in, SOL delta 0) is still a swap", () => {
    const tx = fakeTx({
      programs: [JUPITER],
      preSol: 1_000_000_000,
      postSol: 1_000_000_000, // fee paid by someone else — solAmount exactly 0
      preToken: [tok(USDC, 50)],
      postToken: [tok(MEME, 1000)],
    });
    const c = parseTx(tx, WALLET);
    expect(c.kind).toBe("swap");
    expect(c.side).toBe("buy");
    expect(c.solAmount).toBe(0);
    // The old solAmount > 0 filter dropped this real swap.
    expect(parseSwap(tx, WALLET)).not.toBeNull();
  });

  it("plain transfer-in (token in, no DEX program) is a transfer, NOT a swap", () => {
    const tx = fakeTx({
      programs: [SPL_TOKEN],
      preSol: 1_000_000_000,
      postSol: 999_995_000, // fee only
      postToken: [tok(MEME, 1000)],
    });
    const c = parseTx(tx, WALLET);
    expect(c.kind).toBe("transfer");
    expect(parseSwap(tx, WALLET)).toBeNull();
  });

  it("plain transfer-out (token out, no DEX program) is a transfer, NOT a swap", () => {
    const tx = fakeTx({
      programs: [SPL_TOKEN],
      preSol: 1_000_000_000,
      postSol: 999_995_000,
      preToken: [tok(USDC, 4.8188)],
    });
    const c = parseTx(tx, WALLET);
    expect(c.kind).toBe("transfer");
    expect(parseSwap(tx, WALLET)).toBeNull();
  });

  it("failed tx reports kind failed with the error", () => {
    const tx = fakeTx({
      programs: [JUPITER],
      preSol: 1_000_000_000,
      postSol: 999_995_000,
      err: { InstructionError: [0, "Custom"] },
    });
    const c = parseTx(tx, WALLET);
    expect(c.kind).toBe("failed");
    expect(c.failed).toBe(true);
    expect(c.error).toEqual({ InstructionError: [0, "Custom"] });
  });

  it("DEX program set includes the verified Jupiter v6 ID", () => {
    expect(DEX_PROGRAMS.has(JUPITER)).toBe(true);
  });
});

describe("units: lamports, decimals, account parsing", () => {
  it("lamports -> SOL: 4432577 lamports = 0.004432577 SOL", () => {
    expect(lamportsToSol(4432577)).toBeCloseTo(0.004432577, 12);
    expect(lamportsToSol(1_000_000_000)).toBe(1);
    expect(lamportsToSol(0)).toBe(0);
  });

  it("raw -> ui with decimals: 1000000 raw @ 6 decimals = 1 token", () => {
    expect(rawToUi("1000000", 6)).toBe(1);
    expect(rawToUi("4818800", 6)).toBeCloseTo(4.8188, 10);
    expect(rawToUi("0", 6)).toBe(0);
  });

  it("parses SPL token-account bytes (mint / owner / amount)", () => {
    const mintPk = new PublicKey(ORBITX);
    const ownerPk = new PublicKey(WALLET);
    const buf = Buffer.alloc(165);
    Buffer.from(mintPk.toBytes()).copy(buf, 0);
    Buffer.from(ownerPk.toBytes()).copy(buf, 32);
    buf.writeBigUInt64LE(1234567n, 64);
    const parsed = parseTokenAccountData(buf);
    expect(parsed.amount).toBe(1234567n);
    expect(Buffer.from(parsed.mintBytes).equals(Buffer.from(mintPk.toBytes()))).toBe(true);
    expect(Buffer.from(parsed.ownerBytes).equals(Buffer.from(ownerPk.toBytes()))).toBe(true);
    expect(parseTokenAccountData(Buffer.alloc(10))).toBeNull();
  });

  it("parses mint decimals from byte 44", () => {
    const buf = Buffer.alloc(82);
    buf[44] = 6;
    expect(parseMintDecimals(buf)).toBe(6);
    expect(parseMintDecimals(Buffer.alloc(10))).toBeNull();
  });
});

describe("balance responses never silently zero", () => {
  it("null balance fetch -> error with sol null, never sol 0", () => {
    const r = buildBalanceResponse({ owner: WALLET, bal: null, balSource: null, tokenState: null, tokenSource: null, degradedSources: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("sol_balance_unavailable");
    expect(r.sol).toBeNull();
    expect(r.degraded).toBe(true);
  });

  it("valid balance fetch -> sol from lamports", () => {
    const r = buildBalanceResponse({ owner: WALLET, bal: { value: 4432577 }, balSource: "public-rpc", tokenState: { uiAmount: 0, decimals: 0, raw: "0" }, tokenSource: "ata-derived", degradedSources: [] });
    expect(r.ok).toBe(true);
    expect(r.sol).toBeCloseTo(0.004432577, 12);
    expect(r.degraded).toBe(false);
  });
});

describe("live: exact repro wallet + ORBITX mint", () => {
  it("scanWalletTxs: 15 txs, complete, 0 swaps, USDC net ~0", { timeout: 90000 }, async () => {
    const scan = await scanWalletTxs(WALLET, { limit: 100 });
    expect(scan.scanned).toBe(15);
    expect(scan.complete).toBe(true);
    expect(scan.hasMore).toBe(false);
    expect(scan.swaps.length).toBe(0);
    expect(scan.transfers.length).toBeGreaterThan(0);
    // USDC net -0.07599: the wallet received 4.818831 + 8.778888 and sent
    // the same, plus its 0.07599 USDC ATA was closed/swept as a route hop in
    // a Jupiter-routed tx it co-signed (KWi1EdWdTEVK). Net is negative
    // because the closed ATA's balance left the wallet; current USDC = 0.
    expect(scan.tokenDeltas[USDC]).toBeCloseTo(-0.07599, 4);
  });

  it("balance route: SOL > 0, ORBITX 0 via ata-derived", { timeout: 90000 }, async () => {
    const res = mockRes();
    await balanceHandler({ url: `/api/ogdex/balance?owner=${WALLET}&mint=${ORBITX}` }, res);
    const d = bodyOf(res);
    expect(d.ok).toBe(true);
    expect(d.sol).toBeGreaterThan(0);
    expect(d.sol).toBeLessThan(0.1);
    expect(d.token.uiAmount).toBe(0);
    expect(d.tokenSource).toBe("ata-derived");
  });

  it("wallet route: tx-derived holdings, complete scan, 0 holdings", { timeout: 120000 }, async () => {
    const res = mockRes();
    await walletHandler({ url: `/api/ogdex/wallet?address=${WALLET}` }, res);
    const d = bodyOf(res);
    expect(d.ok).toBe(true);
    expect(d.sol).toBeGreaterThan(0);
    expect(d.holdings).toEqual([]);
    expect(d.holdingsSource).toBe("tx-derived");
    expect(d.tokenListComplete).toBe(true);
    expect(d.txScan.complete).toBe(true);
    expect(d.trades).toEqual([]);
  });

  it("swaps route: 0 swaps with completeness (scanned 15, complete)", { timeout: 90000 }, async () => {
    const res = mockRes();
    await swapsHandler({ url: `/api/ogdex/swaps?address=${WALLET}&limit=25` }, res);
    const d = bodyOf(res);
    expect(d.ok).toBe(true);
    expect(d.count).toBe(0);
    expect(d.scanned).toBe(15);
    expect(d.complete).toBe(true);
  });

  it("wallet-tx route: 15 txs, complete, pagination cursor null", { timeout: 90000 }, async () => {
    const res = mockRes();
    await walletTxHandler({ url: `/api/ogdex/wallet-tx?address=${WALLET}&limit=50` }, res);
    const d = bodyOf(res);
    expect(d.ok).toBe(true);
    expect(d.count).toBe(15);
    expect(d.complete).toBe(true);
    expect(d.hasMore).toBe(false);
    expect(d.nextBefore).toBeNull();
    expect(d.swaps).toBe(0);
    expect(d.transactions.every((t) => t.txHash && t.kind)).toBe(true);
    expect(d.transactions.every((t) => t.feeLamports != null)).toBe(true);
  });

  it("wallet-tx pagination: limit 5 returns 5 + hasMore + cursor that pages", { timeout: 90000 }, async () => {
    const res1 = mockRes();
    await walletTxHandler({ url: `/api/ogdex/wallet-tx?address=${WALLET}&limit=5` }, res1);
    const p1 = bodyOf(res1);
    expect(p1.count).toBe(5);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextBefore).toBeTruthy();
    const res2 = mockRes();
    await walletTxHandler({ url: `/api/ogdex/wallet-tx?address=${WALLET}&limit=5&before=${p1.nextBefore}` }, res2);
    const p2 = bodyOf(res2);
    expect(p2.count).toBe(5);
    expect(p2.transactions[0].txHash).not.toBe(p1.transactions[0].txHash);
  });
});

describe("live: genuine zero-balance wallet", () => {
  it("fresh wallet: sol 0 (genuine), tx history complete + empty, no degradation lie", { timeout: 90000 }, async () => {
    const fresh = Keypair.generate().publicKey.toBase58();
    const resB = mockRes();
    await balanceHandler({ url: `/api/ogdex/balance?owner=${fresh}` }, resB);
    const b = bodyOf(resB);
    expect(b.ok).toBe(true);
    expect(b.sol).toBe(0);
    const resT = mockRes();
    await walletTxHandler({ url: `/api/ogdex/wallet-tx?address=${fresh}&limit=50` }, resT);
    const t = bodyOf(resT);
    expect(t.ok).toBe(true);
    expect(t.count).toBe(0);
    expect(t.complete).toBe(true);
  });
});
