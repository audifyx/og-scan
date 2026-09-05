/**
 * OrbitX custom wallet hub — Phantom + Jupiter via extension inject only.
 * Replaces @solana/wallet-adapter-react for connect, login, and signing.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { HELIUS_RPC } from "@/lib/og";
import {
  connectInjectWallet,
  hubWalletFromName,
  injectInstallHint,
  isInjectWalletReady,
  subscribeHubWalletSession,
  subscribeInjectWallets,
  type InjectWallet,
  type InjectWalletSession,
} from "@/lib/injectWallets";
import { normalizeTxSignatureBase58 } from "@/lib/wallets/walletNormalize";

export const WalletReadyState = {
  Installed: "Installed",
  Loadable: "Loadable",
  NotDetected: "NotDetected",
} as const;

export type WalletReadyState = (typeof WalletReadyState)[keyof typeof WalletReadyState];

export type HubWalletName = "Phantom" | "Jupiter";

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

const INSTALL = {
  phantom: "https://phantom.app",
  jupiter: "https://jup.ag",
} as const;

function displayName(name: InjectWallet): HubWalletName {
  return name === "jupiter" ? "Jupiter" : "Phantom";
}

export function OrbitxWalletHub({ children }: { children: ReactNode }) {
  const connection = useMemo(() => new Connection(HELIUS_RPC, "confirmed"), []);
  const [selected, setSelected] = useState<InjectWallet>("phantom");
  const [session, setSession] = useState<InjectWalletSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [phantomOn, setPhantomOn] = useState(() => isInjectWalletReady("phantom"));
  const [jupiterOn, setJupiterOn] = useState(() => isInjectWalletReady("jupiter"));

  useEffect(() => subscribeInjectWallets(() => {
    setPhantomOn(isInjectWalletReady("phantom"));
    setJupiterOn(isInjectWalletReady("jupiter"));
  }), []);

  useEffect(() => subscribeHubWalletSession((next) => {
    setSelected(next.name);
    setSession(next);
  }), []);

  const connectNamed = useCallback(async (name: InjectWallet) => {
    setConnecting(true);
    try {
      const next = await connectInjectWallet(name);
      setSelected(name);
      setSession(next);
    } finally {
      setConnecting(false);
    }
  }, []);

  const select = useCallback((name: string) => {
    const mapped = hubWalletFromName(name);
    if (!mapped) {
      throw new Error("OrbitX wallet connect supports Phantom and Jupiter only.");
    }
    setSelected(mapped);
  }, []);

  const connect = useCallback(async () => {
    await connectNamed(selected);
  }, [connectNamed, selected]);

  const disconnect = useCallback(async () => {
    try {
      await session?.disconnect();
    } catch {
      /* already gone */
    }
    setSession(null);
  }, [session]);

  const publicKey = useMemo(() => {
    if (!session?.publicKey) return null;
    try {
      return new PublicKey(session.publicKey);
    } catch {
      return null;
    }
  }, [session]);

  const makeAdapter = useCallback((name: InjectWallet, ready: boolean): HubAdapter => {
    const label = displayName(name);
    const active = session?.name === name ? session : null;
    let pk: PublicKey | null = null;
    if (active?.publicKey) {
      try { pk = new PublicKey(active.publicKey); } catch { pk = null; }
    }
    return {
      name: label,
      icon: "",
      url: INSTALL[name],
      publicKey: pk,
      connected: Boolean(active),
      connecting: connecting && selected === name,
      readyState: ready ? WalletReadyState.Installed : WalletReadyState.Loadable,
      connect: () => connectNamed(name),
      disconnect,
      signMessage: active?.signMessage,
      signTransaction: active?.signTransaction,
      signAllTransactions: active?.signAllTransactions,
    };
  }, [connectNamed, connecting, disconnect, selected, session]);

  const wallets: HubWallet[] = useMemo(() => [
    { adapter: makeAdapter("phantom", phantomOn), readyState: phantomOn ? WalletReadyState.Installed : WalletReadyState.Loadable },
    { adapter: makeAdapter("jupiter", jupiterOn), readyState: jupiterOn ? WalletReadyState.Installed : WalletReadyState.Loadable },
  ], [jupiterOn, makeAdapter, phantomOn]);

  const wallet = wallets.find((w) => w.adapter.name === displayName(selected)) ?? wallets[0];

  const sendTransaction = useCallback(async (
    transaction: Tx,
    conn: Connection,
    options?: { skipPreflight?: boolean; maxRetries?: number },
  ) => {
    if (!session) throw new Error("Connect Phantom or Jupiter first");
    const signed = await session.signTransaction(transaction);
    const raw = "version" in signed
      ? (signed as VersionedTransaction).serialize()
      : (signed as Transaction).serialize();
    return normalizeTxSignatureBase58(await conn.sendRawTransaction(raw, {
      skipPreflight: options?.skipPreflight ?? false,
      maxRetries: options?.maxRetries ?? 3,
    }));
  }, [session]);

  const value = useMemo<WalletContextValue>(() => ({
    publicKey,
    connected: Boolean(session && publicKey),
    connecting,
    disconnecting: false,
    wallet,
    wallets,
    select,
    connect,
    disconnect,
    signMessage: session?.signMessage,
    signTransaction: session?.signTransaction,
    signAllTransactions: session?.signAllTransactions,
    sendTransaction,
  }), [connect, connecting, disconnect, publicKey, select, sendTransaction, session, wallet, wallets]);

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
      throw new Error("Connect Phantom or Jupiter from the wallet hub");
    },
    disconnect: async () => {},
    signMessage: undefined,
    signTransaction: undefined,
    signAllTransactions: undefined,
    sendTransaction: async () => {
      throw new Error("Connect Phantom or Jupiter from the wallet hub");
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

export async function connectHubWallet(name?: string | null): Promise<string> {
  const mapped = hubWalletFromName(name);
  if (name && !mapped) {
    throw new Error("OrbitX wallet connect supports Phantom and Jupiter only.");
  }
  const session = await connectInjectWallet(mapped ?? "phantom");
  return session.publicKey;
}

export { injectInstallHint, isInjectWalletReady };
