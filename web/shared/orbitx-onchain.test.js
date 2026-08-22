import { describe, expect, it } from "vitest";
import {
  ATTEST_PREFIX,
  TARGET_LAMPORTS,
  TYPICAL_MEMO_LAMPORTS,
  canonicalize,
  contentHash,
  costNote,
  encodeMemo,
  extractMemosFromTx,
  isLikelySignature,
  meetsCostTarget,
  parseMemo,
  isAttestKind,
  solscanTokenUrl,
  solscanTxUrl,
} from "./orbitx-onchain.js";

describe("canonicalize + contentHash", () => {
  it("hashes the same object regardless of key order", async () => {
    const a = await contentHash({ mint: "Abc", kind: "launch" });
    const b = await contentHash({ kind: "launch", mint: "Abc" });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("canonicalizes nested objects stably", () => {
    expect(canonicalize({ b: 1, a: { z: 2, y: 3 } })).toBe('{"a":{"y":3,"z":2},"b":1}');
  });
});

describe("memo encode/parse", () => {
  it("round-trips a launch hash", async () => {
    const hash = await contentHash({ mint: "So11111111111111111111111111111111111111112" });
    const memo = encodeMemo({ kind: "launch", hash });
    expect(memo.startsWith(`${ATTEST_PREFIX}|launch|`)).toBe(true);
    expect(parseMemo(memo)).toEqual({ kind: "launch", hash, raw: memo });
  });

  it("rejects unknown kinds and short hashes", () => {
    expect(() => encodeMemo({ kind: "nope", hash: "ab".repeat(32) })).toThrow();
    expect(() => encodeMemo({ kind: "post", hash: "abc" })).toThrow();
    expect(parseMemo("random memo")).toBeNull();
  });
});

describe("extractMemosFromTx", () => {
  it("reads a memo instruction by program id", async () => {
    const hash = await contentHash({ x: 1 });
    const memo = encodeMemo({ kind: "post", hash });
    const tx = {
      transaction: {
        message: {
          accountKeys: ["11111111111111111111111111111111", "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"],
          instructions: [{ programIdIndex: 1, data: Buffer.from(memo, "utf8").toString("base64") }],
        },
      },
    };
    expect(extractMemosFromTx(tx)[0].kind).toBe("post");
    expect(extractMemosFromTx(tx)[0].hash).toBe(hash);
  });
});

describe("cost + solscan", () => {
  it("treats a typical memo fee as under target", () => {
    expect(TYPICAL_MEMO_LAMPORTS).toBeLessThan(TARGET_LAMPORTS);
    expect(meetsCostTarget(TYPICAL_MEMO_LAMPORTS)).toBe(true);
    expect(meetsCostTarget(50_000)).toBe(false);
    expect(costNote(TYPICAL_MEMO_LAMPORTS)).toContain("under");
  });

  it("exposes every attestation kind the indexer accepts", () => {
    expect(isAttestKind("launch")).toBe(true);
    expect(isAttestKind("burn")).toBe(true);
    expect(isAttestKind("claim")).toBe(true);
    expect(isAttestKind("swap")).toBe(true);
    expect(isAttestKind("bagwork")).toBe(true);
    expect(isAttestKind("nope")).toBe(false);
  });

  it("builds a solscan url only for real signatures", () => {
    const sig = "5".repeat(64);
    expect(isLikelySignature(sig)).toBe(true);
    expect(solscanTxUrl(sig)).toBe(`https://solscan.io/tx/${sig}`);
    expect(solscanTxUrl("")).toBeNull();
    expect(solscanTokenUrl("So11111111111111111111111111111111111111112")).toContain("/token/");
    expect(isLikelySignature("not a sig")).toBe(false);
  });
});
