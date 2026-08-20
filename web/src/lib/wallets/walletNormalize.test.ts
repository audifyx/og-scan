import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { coercePublicKey, normalizeSignatureBytes, normalizeTxSignatureBase58 } from "./walletNormalize";

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

  it("converts Phantom base64 sendTransaction signatures to base58", () => {
    const bytes = new Uint8Array(64).fill(7);
    const b64 = btoa(String.fromCharCode(...bytes));
    expect(b64).toMatch(/[+/=]/);
    expect(normalizeTxSignatureBase58(b64)).toBe(bs58.encode(bytes));
    expect(normalizeTxSignatureBase58({ signature: b64 })).toBe(bs58.encode(bytes));
    expect(normalizeTxSignatureBase58(bs58.encode(bytes))).toBe(bs58.encode(bytes));
  });

  it("converts the live Phantom error payload (base64 with / and padding)", () => {
    const b64 = "8PvSwdSdJolsD2ZiJY5JfVhExLStfXb1pCB/NX9GbSiAsYlJJDX/ANflaT0eCtNmPFzV0G2XYzc2mRDFjW4QBA==";
    const sig = normalizeTxSignatureBase58(b64);
    expect(sig).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(bs58.decode(sig).length).toBe(64);
    expect(sig).not.toContain("/");
    expect(sig).not.toContain("=");
  });
});
