import { describe, expect, it } from "vitest";
import {
  ORBITX_MINT,
  classifyHeliusTx,
  classifyRpcTx,
  detectQueryKind,
  eventId,
  importanceScore,
  isLikelySignature,
  statusFromLag,
  summarizeEvents,
} from "./orbitx-chain-intel.js";

const SIG = "5".repeat(88);
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const OTHER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("orbitx-chain-intel", () => {
  it("detects search kinds without inventing addresses", () => {
    expect(detectQueryKind("").kind).toBe("empty");
    expect(detectQueryKind("392481920").kind).toBe("slot");
    expect(detectQueryKind("$orbitx").kind).toBe("symbol");
    expect(detectQueryKind(SIG).kind).toBe("signature");
    expect(detectQueryKind(WALLET).kind).toBe("address");
    expect(isLikelySignature("not-a-sig")).toBe(false);
  });

  it("classifies a Helius swap as an OrbitX buy when the mint matches", () => {
    const events = classifyHeliusTx({
      signature: SIG,
      timestamp: 1_724_500_000,
      slot: 392481920,
      fee: 5000,
      feePayer: WALLET,
      type: "SWAP",
      source: "JUPITER",
      nativeTransfers: [{ fromUserAccount: WALLET, toUserAccount: OTHER, amount: 2.41e9 }],
      tokenTransfers: [{ fromUserAccount: OTHER, toUserAccount: WALLET, mint: ORBITX_MINT, tokenAmount: 125420 }],
      events: {
        swap: {
          nativeInput: { amount: 2.41e9 },
          tokenOutputs: [{ mint: ORBITX_MINT, tokenAmount: 125420 }],
        },
      },
      accountData: [{ account: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" }],
    }, { solUsd: 180 });

    expect(events).toHaveLength(1);
    expect(events[0].signature).toBe(SIG);
    expect(events[0].event_type).toBe("ORBITX_BUY");
    expect(events[0].orbitx_related).toBe(true);
    expect(events[0].token_symbol).toBe("ORBITX");
    expect(events[0].amount).toBe(125420);
    expect(events[0].sol_amount).toBeCloseTo(2.41);
    expect(events[0].usd_value).toBeCloseTo(433.8);
    expect(events[0].attribution).toBe("DEX");
  });

  it("classifies an OrbitX burn and does not invent USD when price is missing", () => {
    const events = classifyHeliusTx({
      signature: SIG,
      timestamp: 1_724_500_100,
      slot: 12,
      fee: 5000,
      feePayer: WALLET,
      type: "BURN",
      tokenTransfers: [{
        fromUserAccount: WALLET,
        toUserAccount: "11111111111111111111111111111111",
        mint: ORBITX_MINT,
        tokenAmount: 42000,
      }],
    });
    expect(events[0].event_type).toBe("ORBITX_BURN");
    expect(events[0].amount).toBe(42000);
    expect(events[0].usd_value).toBeNull();
  });

  it("returns no events when the payload has no signature", () => {
    expect(classifyHeliusTx({ type: "SWAP" })).toEqual([]);
    expect(classifyRpcTx("", { slot: 1 })).toEqual([]);
  });

  it("does not label KOL unless the wallet is explicitly tagged KOL", () => {
    const events = classifyHeliusTx({
      signature: SIG,
      timestamp: 1,
      slot: 1,
      fee: 5000,
      feePayer: WALLET,
      type: "TRANSFER",
      nativeTransfers: [{ fromUserAccount: WALLET, toUserAccount: OTHER, amount: 1e9 }],
    }, { tracked: { [WALLET]: { label: "Desk", label_kind: "TRACKED WALLET" } }, solUsd: 200 });
    expect(events[0].event_type).toBe("SOL_TRANSFER");
    expect(events[0].kol_related).toBe(false);
  });

  it("marks indexing delay when ingest is stale", () => {
    expect(statusFromLag(0, null).live).toBe(false);
    expect(statusFromLag(200, new Date().toISOString()).label).toBe("INDEXING DELAY");
    expect(statusFromLag(2, new Date().toISOString()).live).toBe(true);
  });

  it("keeps event ids stable and importance higher for OrbitX burns", () => {
    const a = eventId({ signature: SIG, event_type: "ORBITX_BURN", wallet: WALLET, token_ca: ORBITX_MINT, amount: 1 });
    const b = eventId({ signature: SIG, event_type: "ORBITX_BURN", wallet: WALLET, token_ca: ORBITX_MINT, amount: 1 });
    expect(a).toBe(b);
    expect(importanceScore({ usd_value: 50, orbitx_related: true, event_type: "ORBITX_BURN" }))
      .toBeGreaterThan(importanceScore({ usd_value: 50, orbitx_related: false, event_type: "BUY" }));
  });

  it("summarizes only provided rows", () => {
    const sum = summarizeEvents([
      { event_type: "ORBITX_BUY", orbitx_related: true, wallet: WALLET, block_time: new Date().toISOString() },
    ]);
    expect(sum.orbitx_buys).toBe(1);
    expect(sum.active_wallets).toBe(1);
  });
});
