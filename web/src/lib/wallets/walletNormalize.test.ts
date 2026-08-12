import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { coercePublicKey, normalizeSignatureBytes } from "./walletNormalize";

const SAMPLE = "11111111111111111111111111111111";

describe("walletNormalize", () => {
  it("coerces string / PublicKey / toBytes / connect result", () => {
    const pk = new PublicKey(SAMPLE);
    expect(coercePublicKey(SAMPLE).equals(pk)).toBe(true);
    expect(coercePublicKey(pk).equals(pk)).toBe(true);
    expect(coercePublicKey({ toBytes: () => pk.toBytes() }).equals(pk)).toBe(true);
    expect(coercePublicKey(null, { publicKey: SAMPLE }).equals(pk)).toBe(true);
  });

  it("normalizes signature shapes wallets return in browsers", () => {
    const bytes = new Uint8Array(64).fill(7);
    expect(normalizeSignatureBytes(bytes)).toEqual(bytes);
    expect(normalizeSignatureBytes({ signature: bytes })).toEqual(bytes);
    expect(normalizeSignatureBytes(Array.from(bytes))).toEqual(bytes);
    expect(normalizeSignatureBytes(bs58.encode(bytes))).toEqual(bytes);
  });
});
