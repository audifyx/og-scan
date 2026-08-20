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

function base64ToBytes(value: string): Uint8Array | null {
  const raw = value.trim();
  if (!raw || raw.length < 8) return null;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) return null;
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? normalized : `${normalized}${"=".repeat(4 - (normalized.length % 4))}`;
    if (typeof atob === "function") {
      const bin = atob(pad);
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
  } catch {
    return null;
  }
  return null;
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
    // Phantom often returns tx signatures as base64 (`…/…==`). Solana RPCs want base58.
    if (/[+/=_-]/.test(result)) {
      const b64 = base64ToBytes(result);
      if (b64 && b64.length > 0) return b64;
    }
    try {
      return bs58.decode(result);
    } catch {
      const b64 = base64ToBytes(result);
      if (b64 && b64.length > 0) return b64;
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

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Phantom / WalletConnect `sendTransaction` often returns a base64 64-byte sig.
 * `@solana/web3.js` confirmTransaction then throws: "signature must be base58 encoded".
 */
export function normalizeTxSignatureBase58(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Uint8Array) && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) {
    const obj = value as { signature?: unknown; sig?: unknown };
    if (obj.signature != null) return normalizeTxSignatureBase58(obj.signature);
    if (obj.sig != null) return normalizeTxSignatureBase58(obj.sig);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) throw new Error("missing transaction signature");
    if (BASE58_RE.test(s)) return s;
    try {
      const bytes = normalizeSignatureBytes(s);
      if (bytes.length === 64) return bs58.encode(bytes);
    } catch {
      /* pass through mock / already-explorer signatures */
    }
    return s;
  }
  const bytes = normalizeSignatureBytes(value);
  return bs58.encode(bytes);
}
