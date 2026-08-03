/**
 * Local trading wallets for OrbitX Trade — separate from Phantom / OrbitX login.
 *
 * Secrets are AES-GCM encrypted at rest in localStorage (wrap key also browser-local).
 * This is obfuscation against casual inspection, not protection against XSS.
 * Never log secret material.
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const STORE_KEY = "orbitx.trade.localWallets.v1";
const WRAP_KEY = "orbitx.trade.localWallets.wrapKey";
const MODE_KEY = "orbitx.trade.walletMode";
export const LOCAL_WALLETS_CHANGED = "orbitx.trade.localWallets.changed";

export type TradingWalletMode = "connected" | "local";

export type LocalTradingWalletMeta = {
  id: string;
  label: string;
  publicKey: string;
  createdAt: number;
};

type EncRecord = LocalTradingWalletMeta & {
  ciphertext: string;
  iv: string;
};

type StoreV1 = {
  v: 1;
  wallets: EncRecord[];
  defaultId: string | null;
};

function notify(): void {
  try {
    window.dispatchEvent(new Event(LOCAL_WALLETS_CHANGED));
  } catch {
    /* ignore */
  }
}

function b64Encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getWrapKey(): Promise<CryptoKey> {
  let raw = localStorage.getItem(WRAP_KEY);
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    raw = b64Encode(bytes);
    localStorage.setItem(WRAP_KEY, raw);
  }
  return crypto.subtle.importKey("raw", b64Decode(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSecret(secret: Uint8Array): Promise<{ ciphertext: string; iv: string }> {
  const key = await getWrapKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, secret);
  return { ciphertext: b64Encode(new Uint8Array(ct)), iv: b64Encode(iv) };
}

async function decryptSecret(ciphertext: string, iv: string): Promise<Uint8Array> {
  const key = await getWrapKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64Decode(iv) },
    key,
    b64Decode(ciphertext),
  );
  return new Uint8Array(pt);
}

function readStore(): StoreV1 {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { v: 1, wallets: [], defaultId: null };
    const parsed = JSON.parse(raw) as StoreV1;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.wallets)) {
      return { v: 1, wallets: [], defaultId: null };
    }
    return {
      v: 1,
      wallets: parsed.wallets,
      defaultId: typeof parsed.defaultId === "string" ? parsed.defaultId : null,
    };
  } catch {
    return { v: 1, wallets: [], defaultId: null };
  }
}

function writeStore(store: StoreV1): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  notify();
}

function toMeta(w: EncRecord): LocalTradingWalletMeta {
  return { id: w.id, label: w.label, publicKey: w.publicKey, createdAt: w.createdAt };
}

/** Parse Solana secret: base58 or JSON / comma-separated byte array (64 bytes). */
export function parseSecretKeyInput(input: string): Uint8Array {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a secret key");

  if (trimmed.startsWith("[")) {
    let arr: unknown;
    try {
      arr = JSON.parse(trimmed);
    } catch {
      throw new Error("Invalid JSON secret key array");
    }
    if (!Array.isArray(arr) || arr.length < 32) throw new Error("Secret key array must be 64 bytes (or 32 seed)");
    const bytes = Uint8Array.from(arr.map((n) => Number(n)));
    if (bytes.some((b) => !Number.isFinite(b) || b < 0 || b > 255)) {
      throw new Error("Secret key array contains invalid bytes");
    }
    if (bytes.length !== 64 && bytes.length !== 32) {
      throw new Error("Secret key must be 64 bytes (or 32-byte seed)");
    }
    return bytes.length === 32 ? Keypair.fromSeed(bytes).secretKey : bytes;
  }

  // Comma / space separated decimals
  if (/^[\d,\s]+$/.test(trimmed) && trimmed.includes(",")) {
    const parts = trimmed.split(/[,\s]+/).filter(Boolean).map(Number);
    if (parts.length !== 64 && parts.length !== 32) {
      throw new Error("Secret key must be 64 bytes (or 32-byte seed)");
    }
    const bytes = Uint8Array.from(parts);
    return bytes.length === 32 ? Keypair.fromSeed(bytes).secretKey : bytes;
  }

  try {
    const decoded = bs58.decode(trimmed);
    if (decoded.length === 64) return decoded;
    if (decoded.length === 32) return Keypair.fromSeed(decoded).secretKey;
    throw new Error("Base58 secret must decode to 64 bytes (or 32-byte seed)");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid secret key";
    if (msg.includes("64") || msg.includes("32")) throw e;
    throw new Error("Invalid base58 secret key");
  }
}

export function listLocalTradingWallets(): LocalTradingWalletMeta[] {
  return readStore().wallets.map(toMeta);
}

export function getDefaultLocalWalletId(): string | null {
  const s = readStore();
  if (s.defaultId && s.wallets.some((w) => w.id === s.defaultId)) return s.defaultId;
  return s.wallets[0]?.id ?? null;
}

export function getDefaultLocalWallet(): LocalTradingWalletMeta | null {
  const s = readStore();
  const id = getDefaultLocalWalletId();
  if (!id) return null;
  const w = s.wallets.find((x) => x.id === id);
  return w ? toMeta(w) : null;
}

export function getTradingWalletMode(): TradingWalletMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === "local" ? "local" : "connected";
  } catch {
    return "connected";
  }
}

export function setTradingWalletMode(mode: TradingWalletMode): void {
  localStorage.setItem(MODE_KEY, mode);
  notify();
}

export async function importLocalTradingWallet(
  secretInput: string,
  label?: string,
): Promise<LocalTradingWalletMeta> {
  const secret = parseSecretKeyInput(secretInput);
  const kp = Keypair.fromSecretKey(secret);
  const publicKey = kp.publicKey.toBase58();
  const store = readStore();
  if (store.wallets.some((w) => w.publicKey === publicKey)) {
    throw new Error("This wallet is already imported");
  }
  const enc = await encryptSecret(kp.secretKey);
  // Clear local refs — do not retain plaintext longer than needed
  secret.fill(0);
  kp.secretKey.fill(0);

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record: EncRecord = {
    id,
    label: (label || "").trim() || `Wallet ${shortPk(publicKey)}`,
    publicKey,
    createdAt: Date.now(),
    ciphertext: enc.ciphertext,
    iv: enc.iv,
  };
  store.wallets.push(record);
  if (!store.defaultId) store.defaultId = id;
  writeStore(store);
  return toMeta(record);
}

export async function createLocalTradingWallet(label?: string): Promise<LocalTradingWalletMeta> {
  const kp = Keypair.generate();
  const publicKey = kp.publicKey.toBase58();
  const store = readStore();
  const enc = await encryptSecret(kp.secretKey);
  kp.secretKey.fill(0);

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record: EncRecord = {
    id,
    label: (label || "").trim() || "New wallet",
    publicKey,
    createdAt: Date.now(),
    ciphertext: enc.ciphertext,
    iv: enc.iv,
  };
  store.wallets.push(record);
  if (!store.defaultId) store.defaultId = id;
  writeStore(store);
  return toMeta(record);
}

export function setDefaultLocalWallet(id: string): void {
  const store = readStore();
  if (!store.wallets.some((w) => w.id === id)) throw new Error("Wallet not found");
  store.defaultId = id;
  writeStore(store);
}

export function renameLocalTradingWallet(id: string, label: string): void {
  const store = readStore();
  const w = store.wallets.find((x) => x.id === id);
  if (!w) throw new Error("Wallet not found");
  w.label = label.trim() || w.label;
  writeStore(store);
}

export function removeLocalTradingWallet(id: string): void {
  const store = readStore();
  store.wallets = store.wallets.filter((w) => w.id !== id);
  if (store.defaultId === id) store.defaultId = store.wallets[0]?.id ?? null;
  writeStore(store);
}

/** Export secret as base58. Caller must handle UI warnings / confirm. */
export async function exportLocalTradingWalletSecret(id: string): Promise<string> {
  const store = readStore();
  const w = store.wallets.find((x) => x.id === id);
  if (!w) throw new Error("Wallet not found");
  const secret = await decryptSecret(w.ciphertext, w.iv);
  try {
    return bs58.encode(secret);
  } finally {
    secret.fill(0);
  }
}

export async function loadLocalTradingKeypair(id: string): Promise<Keypair> {
  const store = readStore();
  const w = store.wallets.find((x) => x.id === id);
  if (!w) throw new Error("Wallet not found");
  const secret = await decryptSecret(w.ciphertext, w.iv);
  try {
    return Keypair.fromSecretKey(secret);
  } finally {
    secret.fill(0);
  }
}

export async function loadDefaultLocalKeypair(): Promise<Keypair | null> {
  const id = getDefaultLocalWalletId();
  if (!id) return null;
  return loadLocalTradingKeypair(id);
}

function shortPk(pk: string): string {
  return pk.length > 8 ? `${pk.slice(0, 4)}…${pk.slice(-4)}` : pk;
}
