/**
 * Wallet Standard discovery (Phantom / Jupiter Chrome extensions).
 * Extensions often never set window.phantom / window.jupiter — they only fire
 * wallet-standard:register-wallet after wallet-standard:app-ready.
 */
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { coercePublicKey, normalizeSignatureBytes } from "@/lib/wallets/walletNormalize";

export type StandardAccount = {
  address: string;
  publicKey?: Uint8Array;
  chains?: readonly string[];
  features?: readonly string[];
};

export type StandardWallet = {
  name: string;
  icon?: string;
  accounts: readonly StandardAccount[];
  features: Record<string, unknown>;
};

const wallets = new Map<string, StandardWallet>();
const listeners = new Set<() => void>();
let started = false;

function notify(): void {
  for (const cb of listeners) {
    try { cb(); } catch { /* ignore subscriber errors */ }
  }
}

function saveWallet(wallet: StandardWallet): void {
  if (!wallet || typeof wallet !== "object" || !wallet.name) return;
  wallets.set(wallet.name, wallet);
  notify();
}

function onRegister(event: Event): void {
  const detail = (event as CustomEvent<(cb: (wallet: StandardWallet) => void) => void>).detail;
  if (typeof detail === "function") {
    try { detail(saveWallet); } catch { /* wallet callback threw */ }
  }
}

export function startWalletStandardDiscovery(): void {
  if (typeof window === "undefined" || started) return;
  started = true;
  window.addEventListener("wallet-standard:register-wallet", onRegister as EventListener);
  try {
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: saveWallet }));
  } catch {
    try { window.dispatchEvent(new Event("wallet-standard:app-ready")); } catch { /* ignore */ }
  }
}

export function subscribeWalletStandard(cb: () => void): () => void {
  startWalletStandardDiscovery();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function listStandardWallets(): StandardWallet[] {
  startWalletStandardDiscovery();
  return [...wallets.values()];
}

export function standardNameMatches(walletName: string, target: "phantom" | "jupiter"): boolean {
  const n = String(walletName || "").toLowerCase();
  if (target === "phantom") return n.includes("phantom");
  return n.includes("jupiter") || n.includes("mobile wallet adapter");
}

export function findStandardWallet(name: "phantom" | "jupiter"): StandardWallet | null {
  return listStandardWallets().find((w) => standardNameMatches(w.name, name)) ?? null;
}

export function resetWalletStandardForTests(): void {
  wallets.clear();
}

type ConnectFeature = {
  connect?: (opts?: { silent?: boolean }) => Promise<{ accounts?: StandardAccount[] }>;
};
type SignMessageFeature = {
  signMessage?: (input: { account: unknown; message: Uint8Array }) => Promise<unknown>;
};
type SignTxFeature = {
  signTransaction?: (input: {
    account: unknown;
    transaction: Uint8Array;
    chain?: string;
  }) => Promise<unknown>;
};
type SignAllTxFeature = {
  signAllTransactions?: (inputs: Array<{ account: unknown; transaction: Uint8Array }>) => Promise<unknown>;
};
type DisconnectFeature = {
  disconnect?: () => Promise<void>;
};

function feature<T>(wallet: StandardWallet, name: string): T | null {
  const f = wallet.features?.[name];
  return f && typeof f === "object" ? (f as T) : null;
}

function serializeTx(tx: unknown): Uint8Array {
  if (tx instanceof VersionedTransaction) return tx.serialize();
  if (tx instanceof Transaction) {
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  }
  if (tx && typeof tx === "object" && typeof (tx as { serialize?: unknown }).serialize === "function") {
    try {
      return (tx as VersionedTransaction).serialize();
    } catch {
      return (tx as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false });
    }
  }
  throw new Error("wallet cannot serialize this transaction");
}

function deserializeTx<T>(original: T, signed: Uint8Array): T {
  const looksVersioned = original instanceof VersionedTransaction
    || (original !== null && typeof original === "object" && "version" in (original as object) && "message" in (original as object));
  if (looksVersioned) return VersionedTransaction.deserialize(signed) as T;
  return Transaction.from(signed) as T;
}

export type WrappedStandardSession = {
  publicKey: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
  disconnect: () => Promise<void>;
};

export async function connectStandardWallet(wallet: StandardWallet): Promise<WrappedStandardSession> {
  const connectFeat = feature<ConnectFeature>(wallet, "standard:connect");
  let accounts = [...(wallet.accounts || [])];
  if (typeof connectFeat?.connect === "function") {
    const result = await connectFeat.connect();
    if (result?.accounts?.length) accounts = [...result.accounts];
  }
  const account = accounts[0];
  if (!account) {
    throw new Error(`${wallet.name} connected but returned no account. Unlock the extension and retry.`);
  }
  const publicKey = coercePublicKey(account.address, account.publicKey).toBase58();
  const signFeat = feature<SignMessageFeature>(wallet, "solana:signMessage");
  const signTxFeat = feature<SignTxFeature>(wallet, "solana:signTransaction");
  const signAllFeat = feature<SignAllTxFeature>(wallet, "solana:signAllTransactions");
  const discFeat = feature<DisconnectFeature>(wallet, "standard:disconnect");

  const signOne = async <T>(tx: T): Promise<T> => {
    if (typeof signTxFeat?.signTransaction !== "function") {
      throw new Error(`${wallet.name} can't sign transactions in this tab.`);
    }
    const raw = await signTxFeat.signTransaction({
      account,
      transaction: serializeTx(tx),
      chain: "solana:mainnet",
    });
    const first = Array.isArray(raw) ? raw[0] : raw;
    const signed = first && typeof first === "object" && "signedTransaction" in first
      ? (first as { signedTransaction: Uint8Array }).signedTransaction
      : raw as Uint8Array;
    return deserializeTx(tx, signed);
  };

  return {
    publicKey,
    signMessage: async (message: Uint8Array) => {
      if (typeof signFeat?.signMessage !== "function") {
        throw new Error(`${wallet.name} can't sign the login message in this tab.`);
      }
      const raw = await signFeat.signMessage({ account, message });
      const first = Array.isArray(raw) ? raw[0] : raw;
      const sig = first && typeof first === "object" && "signature" in first
        ? (first as { signature: unknown }).signature
        : raw;
      return normalizeSignatureBytes(sig);
    },
    signTransaction: signOne,
    signAllTransactions: async <T>(txs: T[]) => {
      if (typeof signAllFeat?.signAllTransactions === "function") {
        const raw = await signAllFeat.signAllTransactions(
          txs.map((tx) => ({ account, transaction: serializeTx(tx) })),
        );
        const list = Array.isArray(raw) ? raw : [];
        return txs.map((tx, i) => {
          const entry = list[i];
          const signed = entry && typeof entry === "object" && "signedTransaction" in entry
            ? (entry as { signedTransaction: Uint8Array }).signedTransaction
            : null;
          if (!signed) throw new Error(`${wallet.name} returned no signed transaction`);
          return deserializeTx(tx, signed);
        });
      }
      const out: T[] = [];
      for (const tx of txs) out.push(await signOne(tx));
      return out;
    },
    disconnect: async () => {
      if (typeof discFeat?.disconnect === "function") await discFeat.disconnect();
    },
  };
}
