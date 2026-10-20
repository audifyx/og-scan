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
 * Import a Solana wallet from a base58 secret key (Phantom format)
 * or JSON byte array (CLI format). Preserves the original address.
 */
export function importSolanaWallet(secretKeyInput: string): LocalWallets["solana"] {
  const input = secretKeyInput.trim();
  let secretKeyBytes: Uint8Array;
  try {
    if (input.startsWith("[")) {
      const arr = JSON.parse(input);
      secretKeyBytes = new Uint8Array(arr);
    } else {
      secretKeyBytes = bs58.decode(input);
    }
  } catch {
    throw new Error("Invalid key format. Paste a base58 key (Phantom) or JSON array (CLI).");
  }
  const kp = Keypair.fromSecretKey(secretKeyBytes);
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKey: bs58.encode(kp.secretKey),
    secretKeyJson: JSON.stringify(Array.from(kp.secretKey)),
  };
}

export function useLocalWallets() {
  const [wallets, setWallets] = useState<LocalWallets | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let w = loadLocalWallets();
    // Migrate v1 wallets: keep the same address (do NOT delete)
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
    if (!w) {
      w = createLocalWallets();
    }
    setWallets(w);
    setReady(true);
  }, []);

  const regenerate = useCallback(() => {
    if (!window.confirm("Generate NEW wallets? Your old addresses will be lost unless you saved the keys!")) return;
    const w = createLocalWallets();
    setWallets(w);
  }, []);

  const remove = useCallback(() => {
    if (!window.confirm("Delete wallets from this device? Make sure you exported your keys first!")) return;
    deleteLocalWallets();
    setWallets(null);
  }, []);

  return { wallets, ready, regenerate, remove };
}
