/**
 * OrbitX wallet hub — the in-app (desk) wallet is the ONLY wallet.
 *
 * Previously Phantom + Jupiter via extension inject. Per owner order, all
 * extension wallets are removed: one wallet, one address, everywhere.
 *
 * Identity comes from `useOrbitxBilling()` (backend-signed desk wallet).
 * `connect()` runs the one-time dashboard auth-code link flow (`beginAuth`).
 * The desk wallet signs on the backend — there is no client-side signer, so
 * `signTransaction` / `signMessage` / `sendTransaction` are intentionally
 * unavailable here. Backend-enabled flows (trades via orbitx_app_buy/sell,
 * burns via burnPurchase/spend) call the supercomputer MCP directly.
 *
 * This module keeps the historical wallet-adapter-shaped interface because
 * vite.config.ts aliases `@solana/wallet-adapter-react` to this file — every
 * `useWallet()` / `useConnection()` call site in the app resolves here.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { getBillingAuthCode, requestBillingAuth } from "@/tokenomics/auth";
import { fetchDeskWallet } from "@/tokenomics/mcpClient";

export const WalletReadyState = {
  Installed: "Installed",
  Loadable: "Loadable",
  NotDetected: "NotDetected",
} as const;

export type WalletReadyState = (typeof WalletReadyState)[keyof typeof WalletReadyState];

/** Single wallet identity across OrbitX. */
export type HubWalletName = "In-App";

type Tx = Transaction | VersionedTransaction;

export type HubAdapter = {
  name: HubWalletName;
  icon: string;
  url: string;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  readyState: WalletReadyState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage?: (m: Uint8Array) => Promise<Uint8Array>;
  signTransaction?: <T extends Tx>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends Tx>(txs: T[]) => Promise<T[]>;
};

export type HubWallet = {
  adapter: HubAdapter;
  readyState: WalletReadyState;
};

type WalletContextValue = {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  wallet: HubWallet | null;
  wallets: HubWallet[];
  select: (name: string) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined;
  signTransaction: (<T extends Tx>(tx: T) => Promise<T>) | undefined;
  signAllTransactions: (<T extends Tx>(txs: T[]) => Promise<T[]>) | undefined;
  sendTransaction: (
    transaction: Tx,
    connection: Connection,
    options?: { skipPreflight?: boolean; maxRetries?: number },
  ) => Promise<string>;
};

const WalletCtx = createContext<WalletContextValue | null>(null);
const ConnectionCtx = createContext<{ connection: Connection } | null>(null);

/** The desk wallet signs on the backend — no client-side signing exists. */
function backendSigningError(action = "This action"): Error {
  return new Error(
    `${action} needs the in-app wallet's backend signer, which isn't enabled for custom transactions yet. ` +
      "Trades run through the Trade tab and burns through the Shop — both are backend-signed. " +
      "Link your in-app wallet once to use them.",
  );
}

export function OrbitxWalletHub({ children }: { children: ReactNode }) {
  const connection = useMemo(() => new Connection(browserWalletRpcUrl(), "confirmed"), []);
  const billing = useOrbitxBilling();

  const publicKey = useMemo(() => {
    if (!billing.wallet) return null;
    try {
      return new PublicKey(billing.wallet);
    } catch {
      return null;
    }
  }, [billing.wallet]);

  const connected = billing.ready && Boolean(publicKey);

  const connect = useCallback(async () => {
    // One-time dashboard auth-code link — after this the desk wallet is the identity.
    billing.beginAuth();
  }, [billing]);

  const disconnect = useCallback(async () => {
    billing.resetAuth();
  }, [billing]);

  const select = useCallback((_name: string) => {
    // One wallet — nothing to select.
  }, []);

  const sendTransaction = useCallback(async () => {
    throw backendSigningError("Sending this transaction");
  }, []);

  const adapter: HubAdapter = useMemo(() => ({
    name: "In-App",
    icon: "",
    url: "",
    publicKey,
    connected,
    connecting: false,
    readyState: WalletReadyState.Installed,
    connect,
    disconnect,
    signMessage: undefined,
    signTransaction: undefined,
    signAllTransactions: undefined,
  }), [publicKey, connected, connect, disconnect]);

  const hubWallet: HubWallet = useMemo(() => ({
    adapter,
    readyState: WalletReadyState.Installed,
  }), [adapter]);

  const value = useMemo<WalletContextValue>(() => ({
    publicKey,
    connected,
    connecting: false,
    disconnecting: false,
    wallet: hubWallet,
    wallets: [hubWallet],
    select,
    connect,
    disconnect,
    signMessage: undefined,
    signTransaction: undefined,
    signAllTransactions: undefined,
    sendTransaction,
  }), [publicKey, connected, select, connect, disconnect, hubWallet, sendTransaction]);

  return (
    <ConnectionCtx.Provider value={{ connection }}>
      <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
    </ConnectionCtx.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletCtx);
  if (ctx) return ctx;
  return {
    publicKey: null,
    connected: false,
    connecting: false,
    disconnecting: false,
    wallet: null,
    wallets: [],
    select: () => {},
    connect: async () => {
      throw new Error("Link your in-app wallet first");
    },
    disconnect: async () => {},
    signMessage: undefined,
    signTransaction: undefined,
    signAllTransactions: undefined,
    sendTransaction: async () => {
      throw backendSigningError("Sending this transaction");
    },
  };
}

export function useConnection(): { connection: Connection } {
  const ctx = useContext(ConnectionCtx);
  if (!ctx) {
    throw new Error("useConnection must be used inside OrbitxWalletHub");
  }
  return ctx;
}

/**
 * Link (or re-resolve) the in-app wallet outside React. Runs the dashboard
 * auth-code flow when no code is stored, then returns the desk wallet address.
 */
export async function connectHubWallet(_name?: string | null): Promise<string> {
  let code = getBillingAuthCode();
  if (!code) {
    code = await requestBillingAuth();
  }
  const info = await fetchDeskWallet(code);
  if (!info.ok || !info.exists || !info.publicKey) {
    throw new Error(info.message || "No in-app wallet found for this auth.");
  }
  return info.publicKey;
}

/** @deprecated Extension wallets are removed — the in-app wallet is always ready. */
export function isInjectWalletReady(_name?: string | null): boolean {
  return false;
}

/** @deprecated Extension wallets are removed — no install needed. */
export function injectInstallHint(_name?: string | null): string {
  return "OrbitX now uses your in-app wallet — no extension needed. Link it once and you're set.";
}

/** @deprecated Phantom/Jupiter inject names — kept for import compatibility. */
export type InjectWallet = "phantom" | "jupiter";
