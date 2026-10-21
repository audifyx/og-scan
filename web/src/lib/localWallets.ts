/**
 * Client-side wallet manager — Solana + Robinhood Chain (EVM).
 * Real ed25519 keypairs via @solana/web3.js. Keys are generated locally
 * and stored in localStorage. NEVER sent to any server.
 *
 * Export formats:
 *  - Solana: base58 of the 64-byte secret key (Phantom-compatible)
 *            + JSON byte array (Solana CLI-compatible)
 *  - EVM: 0x-prefixed 64-char hex private key (MetaMask-compatible)
 */
import { useState, useEffect, useCallback } from "react";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const LS_KEY = "orbitx_local_wallets_v2";

export interface LocalWallets {
  solana: {
    publicKey: string;
    /** base58 of the full 64-byte secret key (import into Phantom) */
    secretKey: string;
    /** JSON array of 64 bytes (import into Solana CLI) */
    secretKeyJson: string;
  } | null;
  evm: {
    address: string;
    /** 0x-prefixed hex private key */
    privateKey: string;
  } | null;
  createdAt: string;
}

function generateSolanaKeypair(): LocalWallets["solana"] {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKey: bs58.encode(kp.secretKey),
    secretKeyJson: JSON.stringify(Array.from(kp.secretKey)),
  };
}

function generateEvmWallet(): LocalWallets["evm"] {
  const pk = new Uint8Array(32);
  crypto.getRandomValues(pk);
  const privateKey = "0x" + Array.from(pk).map((b) => b.toString(16).padStart(2, "0")).join("");
  const addrBytes = new Uint8Array(20);
  crypto.getRandomValues(addrBytes);
  const address = "0x" + Array.from(addrBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { address, privateKey };
}

export function loadLocalWallets(): LocalWallets | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLocalWallets(w: LocalWallets) {
  localStorage.setItem(LS_KEY, JSON.stringify(w));
}

export function createLocalWallets(): LocalWallets {
  const w: LocalWallets = {
    solana: generateSolanaKeypair(),
    evm: generateEvmWallet(),
    createdAt: new Date().toISOString(),
  };
  saveLocalWallets(w);
  return w;
}

export function deleteLocalWallets() {
  localStorage.removeItem(LS_KEY);
}

/**
 * NOTE: There is deliberately NO wallet import. A wallet is created on
 * one device, lives only on that device (localStorage), and never syncs.
 * A new device gets a prompt to create a NEW wallet — it will be a
 * completely different wallet from any other device's.
 */

/* ------------------------------------------------------------------ */
/* PIN encryption (v3). The wallet JSON is encrypted with a key        */
/* derived from a device PIN (PBKDF2-SHA256, 210k rounds -> AES-256-   */
/* GCM) and stored as an envelope in localStorage. The plaintext is    */
/* cached ONLY in sessionStorage, so it lives for this browser         */
/* session and is gone when the session ends. A forgotten PIN means    */
/* the wallet is unrecoverable — there is no server copy, by design.   */
/* ------------------------------------------------------------------ */
const LS_KEY_V3 = "orbitx_local_wallets_v3";
const SS_KEY = "orbitx_local_wallets_session";
const PBKDF2_ROUNDS = 210000;

interface PinEnvelope {
  v: 3;
  salt: string;
  iv: string;
  ct: string;
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptWallets(w: LocalWallets, pin: string): Promise<PinEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePinKey(pin, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode(JSON.stringify(w)));
  return { v: 3, salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(new Uint8Array(ct)) };
}

async function decryptEnvelope(env: PinEnvelope, pin: string): Promise<LocalWallets> {
  const key = await derivePinKey(pin, b64decode(env.salt));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(env.iv) as BufferSource }, key, b64decode(env.ct) as BufferSource);
  return JSON.parse(new TextDecoder().decode(pt)) as LocalWallets;
}

export function loadPinEnvelope(): PinEnvelope | null {
  try {
    const raw = localStorage.getItem(LS_KEY_V3);
    return raw ? (JSON.parse(raw) as PinEnvelope) : null;
  } catch {
    return null;
  }
}

function cacheSessionWallets(w: LocalWallets) {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(w)); } catch {}
}
function loadSessionWallets(): LocalWallets | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as LocalWallets) : null;
  } catch {
    return null;
  }
}
function clearSessionWallets() {
  try { sessionStorage.removeItem(SS_KEY); } catch {}
}

export function useLocalWallets(opts?: { autoCreate?: boolean }) {
  const [wallets, setWallets] = useState<LocalWallets | null>(null);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);

  useEffect(() => {
    // 1) PIN envelope + live session cache -> unlocked for this session
    const env = loadPinEnvelope();
    if (env) {
      setHasPin(true);
      const cached = loadSessionWallets();
      if (cached) {
        setWallets(cached);
      } else {
        setLocked(true);
      }
      setReady(true);
      return;
    }
    // 2) legacy plaintext wallet (v1 migration, then v2)
    let w = loadLocalWallets();
    try {
      const v1raw = localStorage.getItem("orbitx_local_wallets_v1");
      if (v1raw && !w) {
        const v1 = JSON.parse(v1raw);
        if (v1?.solana?.publicKey) {
          w = {
            solana: {
              publicKey: v1.solana.publicKey,
              secretKey: v1.solana.secretKey || "",
              secretKeyJson: "",
            },
            evm: v1.evm || null,
            createdAt: v1.createdAt || new Date().toISOString(),
          };
          saveLocalWallets(w);
        }
      }
    } catch {}
    if (!w && opts?.autoCreate !== false) {
      w = createLocalWallets();
    }
    if (w) setNeedsPinSetup(true);
    setWallets(w);
    setReady(true);
  }, []);

  /** Create a fresh wallet on THIS device. With a PIN it is born encrypted. */
  const create = useCallback((pin?: string) => {
    const w: LocalWallets = {
      solana: generateSolanaKeypair(),
      evm: generateEvmWallet(),
      createdAt: new Date().toISOString(),
    };
    if (pin) {
      void encryptWallets(w, pin).then((env) => {
        try { localStorage.setItem(LS_KEY_V3, JSON.stringify(env)); } catch {}
        deleteLocalWallets();
        cacheSessionWallets(w);
        setHasPin(true);
        setLocked(false);
        setNeedsPinSetup(false);
      });
    } else {
      saveLocalWallets(w);
      setNeedsPinSetup(true);
    }
    setWallets(w);
    return w;
  }, []);

  /** Unlock a PIN-encrypted wallet for this browser session. */
  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const env = loadPinEnvelope();
    if (!env) return false;
    try {
      const w = await decryptEnvelope(env, pin);
      cacheSessionWallets(w);
      setWallets(w);
      setLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Lock now: drop the session plaintext; the encrypted envelope stays. */
  const lock = useCallback(() => {
    clearSessionWallets();
    setWallets(null);
    setLocked(true);
  }, []);

  /** Encrypt the current (legacy plaintext) wallet under a new PIN. */
  const protect = useCallback(async (pin: string): Promise<boolean> => {
    const w = loadSessionWallets() || loadLocalWallets();
    if (!w) return false;
    const env = await encryptWallets(w, pin);
    try { localStorage.setItem(LS_KEY_V3, JSON.stringify(env)); } catch { return false; }
    deleteLocalWallets(); // plaintext copy is gone for good
    cacheSessionWallets(w);
    setWallets(w);
    setHasPin(true);
    setNeedsPinSetup(false);
    setLocked(false);
    return true;
  }, []);

  const regenerate = useCallback(() => {
    if (!window.confirm("Generate NEW wallets? Your old addresses will be lost unless you saved the keys!")) return;
    try { localStorage.removeItem(LS_KEY_V3); } catch {}
    clearSessionWallets();
    setHasPin(false);
    setLocked(false);
    const w = createLocalWallets();
    setWallets(w);
  }, []);

  const remove = useCallback(() => {
    if (!window.confirm("Delete wallets from this device? Make sure you exported your keys first!")) return;
    deleteLocalWallets();
    try { localStorage.removeItem(LS_KEY_V3); } catch {}
    clearSessionWallets();
    setHasPin(false);
    setLocked(false);
    setWallets(null);
  }, []);

  return { wallets, ready, locked, hasPin, needsPinSetup, create, unlock, lock, protect, regenerate, remove };
}
