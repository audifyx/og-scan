/**
 * Normalize public keys + signatures across Phantom, Jupiter, Solflare, Backpack.
 * Providers disagree on shapes (PublicKey | string | { toBytes } | { signature }).
 */
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export function coercePublicKey(
  value: unknown,
  fallback?: unknown,
): PublicKey {
  const candidates = [value, fallback];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      if (raw instanceof PublicKey) return raw;
      if (typeof raw === "string") return new PublicKey(raw);
      if (typeof raw === "object") {
        const obj = raw as {
          toBase58?: () => string;
          toBytes?: () => Uint8Array;
          toString?: () => string;
          publicKey?: unknown;
        };
        if (obj.publicKey != null && obj.publicKey !== raw) {
          return coercePublicKey(obj.publicKey);
        }
        if (typeof obj.toBytes === "function") {
          return new PublicKey(obj.toBytes());
        }
        if (typeof obj.toBase58 === "function") {
          return new PublicKey(obj.toBase58());
        }
        if (typeof obj.toString === "function") {
          const s = obj.toString();
          if (s && s !== "[object Object]") return new PublicKey(s);
        }
      }
    } catch {
      /* try next */
    }
  }
  throw new Error("wallet returned an invalid public key");
}

export function normalizeSignatureBytes(result: unknown): Uint8Array {
  if (result instanceof Uint8Array) return result;
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (ArrayBuffer.isView(result)) {
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  }
  if (Array.isArray(result) && result.every((n) => typeof n === "number")) {
    return Uint8Array.from(result);
  }
  if (typeof result === "string") {
    // Some wallets return base58; others hex. Prefer base58 (Solana default).
    try {
      return bs58.decode(result);
    } catch {
      const hex = result.startsWith("0x") ? result.slice(2) : result;
      if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        return out;
      }
    }
  }
  if (result && typeof result === "object") {
    const obj = result as { signature?: unknown; sig?: unknown };
    if (obj.signature != null) return normalizeSignatureBytes(obj.signature);
    if (obj.sig != null) return normalizeSignatureBytes(obj.sig);
  }
  throw new Error("wallet returned an invalid signature");
}
