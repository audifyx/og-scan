/**
 * Active trading identity for OrbitX Trade tools.
 *
 * When walletMode === "local" and a default local wallet exists, tools use that
 * pubkey + local keypair signing. Otherwise Phantom / extension adapter.
 *
 * Critical: in Local mode we NEVER fall back to the adapter pubkey for identity
 * or signing — that was the bug that made claim/trade ignore imported wallets.
 */
import { useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { toast } from "sonner";
import { useLocalTradingWallets } from "@/hooks/useLocalTradingWallets";
import {
  getTradingWalletMode,
  loadDefaultLocalKeypair,
} from "@/lib/tradeWallets/localTradingWallets";
import {
  sendWalletTransaction,
  sendWithKeypair,
  type WalletSendOptions,
} from "@/lib/orbitx/sendWalletTx";
import { connectSolanaWallet } from "@/lib/connectSolanaWallet";

function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

export function useActiveTradingWallet() {
  const {
    publicKey: adapterPk,
    connected,
    signTransaction,
    sendTransaction,
    signMessage: adapterSignMessage,
    wallets,
    select,
    connect,
  } = useWallet();
  const {
    mode,
    setMode,
    defaultWallet,
    loadDefaultKeypair,
    wallets: localWallets,
  } = useLocalTradingWallets();

  /** Prefer live localStorage so sign path can't drift from a stale React render. */
  const modeNow = getTradingWalletMode();
  const localActive = mode === "local" || modeNow === "local";

  const publicKey = useMemo(() => {
    if (localActive) {
      if (!defaultWallet?.publicKey) return null;
      try {
        return new PublicKey(defaultWallet.publicKey);
      } catch {
        return null;
      }
    }
    return adapterPk;
  }, [localActive, defaultWallet, adapterPk]);

  const address = publicKey?.toBase58() ?? null;
  const ready = localActive
    ? Boolean(publicKey && defaultWallet)
    : Boolean(connected && adapterPk);

  const label = useMemo(() => {
    if (!address) return null;
    return localActive ? `Local ${shortAddr(address)}` : `Ext ${shortAddr(address)}`;
  }, [address, localActive]);

  /** Connect a specific extension by name (Phantom / Jupiter / Solflare). No auto-fallback. */
  const connectNamedWallet = useCallback(
    async (name: string) => {
      setMode("connected");
      try {
        await connectSolanaWallet({
          wallets,
          select,
          connect,
          preferredName: name,
        });
        toast.success(`${name} connected`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || "Could not connect wallet");
        toast.error(msg);
        throw err;
      }
    },
    [wallets, select, connect, setMode],
  );

  /**
   * @deprecated Prefer Trade wallet picker (`useTradeWalletPicker`) so the user
   * chooses Phantom / Jupiter / Solflare. Kept for non-Trade call sites; connects
   * Phantom only (no Solflare fallback).
   */
  const connectPhantom = useCallback(async () => {
    return connectNamedWallet("Phantom");
  }, [connectNamedWallet]);

  const sendTx = useCallback(
    async (
      connection: Connection,
      tx: Transaction | VersionedTransaction,
      options?: WalletSendOptions,
    ): Promise<string> => {
      // Re-read mode at call time — never trust a stale closure over Phantom.
      const useLocal = getTradingWalletMode() === "local";
      if (useLocal) {
        const kp = await loadDefaultLocalKeypair();
        if (!kp) {
          throw new Error("No default local trading wallet — set one in Trading wallets");
        }
        try {
          return await sendWithKeypair(connection, kp, tx, options);
        } finally {
          kp.secretKey.fill(0);
        }
      }
      if (!sendTransaction && !signTransaction) {
        throw new Error("This wallet can't sign here — connect Phantom or Jupiter");
      }
      return sendWalletTransaction(
        connection,
        {
          sendTransaction: sendTransaction ?? undefined,
          signTransaction: signTransaction ?? undefined,
        },
        tx,
        options,
      );
    },
    [sendTransaction, signTransaction],
  );

  /** Sign an arbitrary message for wallet-proof APIs (alerts CRUD). */
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      const useLocal = getTradingWalletMode() === "local";
      if (useLocal) {
        const kp = await loadDefaultLocalKeypair();
        if (!kp) {
          throw new Error("No default local trading wallet — set one in Trading wallets");
        }
        try {
          // Solana secretKey is 64 bytes (seed||pubkey); ed25519.sign wants 32-byte seed.
          const seed = kp.secretKey.slice(0, 32);
          return ed25519.sign(message, seed);
        } finally {
          kp.secretKey.fill(0);
        }
      }
      if (!adapterSignMessage) {
        throw new Error("This wallet can't sign messages — connect Phantom, Jupiter, or Solflare");
      }
      const raw = await adapterSignMessage(message);
      return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    },
    [adapterSignMessage],
  );

  return {
    mode,
    setMode,
    localActive,
    publicKey,
    address,
    ready,
    label,
    shortAddress: address ? shortAddr(address) : null,
    defaultWallet,
    localWallets,
    connected,
    adapterPublicKey: adapterPk,
    sendTx,
    signMessage,
    loadDefaultKeypair,
    connectNamedWallet,
    connectPhantom,
    signingSource: (localActive ? "local" : "connected") as "local" | "connected",
  };
}
