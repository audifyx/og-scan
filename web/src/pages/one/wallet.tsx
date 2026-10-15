import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SOLANA_RPC } from "../config";

interface InjectedProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toBase58(): string } | null;
  connect(opts?: any): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
}

declare global {
  interface Window {
    phantom?: { solana?: InjectedProvider };
    solflare?: InjectedProvider;
  }
}

interface WalletCtx {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  providerName: string | null;
  connect: (which: "phantom" | "solflare") => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  connection: Connection;
  hasPhantom: boolean;
  hasSolflare: boolean;
}

const Ctx = createContext<WalletCtx | null>(null);

function getProvider(which: "phantom" | "solflare"): InjectedProvider | null {
  if (which === "phantom") return window.phantom?.solana ?? null;
  return window.solflare ?? null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [provider, setProvider] = useState<InjectedProvider | null>(null);
  const connection = useMemo(() => new Connection(SOLANA_RPC, "confirmed"), []);

  const connect = useCallback(async (which: "phantom" | "solflare") => {
    const p = getProvider(which);
    if (!p) {
      window.open(which === "phantom" ? "https://phantom.app" : "https://solflare.com", "_blank");
      return;
    }
    setConnecting(true);
    try {
      const { publicKey: pk } = await p.connect();
      setPublicKey(new PublicKey(pk.toBase58()));
      setProvider(p);
      setProviderName(which);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try { await provider?.disconnect(); } catch { /* noop */ }
    setPublicKey(null); setProvider(null); setProviderName(null);
  }, [provider]);

  const signTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction) => {
      if (!provider) throw new Error("No wallet connected");
      return provider.signTransaction(tx);
    },
    [provider]
  );

  const value: WalletCtx = {
    publicKey,
    connected: !!publicKey,
    connecting,
    providerName,
    connect,
    disconnect,
    signTransaction,
    connection,
    hasPhantom: !!window.phantom?.solana,
    hasSolflare: !!window.solflare,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function useConnection() {
  const { connection } = useWallet();
  return { connection };
}
