/**
 * Active trading identity for OrbitX Trade tools.
 *
 * When walletMode === "local" and a default local wallet exists, tools use that
 * pubkey + local keypair signing. Otherwise Phantom / extension adapter.
 */
import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { useLocalTradingWallets } from "@/hooks/useLocalTradingWallets";
import {
  sendWalletTransaction,
  sendWithKeypair,
  type WalletSendOptions,
} from "@/lib/orbitx/sendWalletTx";

function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

export function useActiveTradingWallet() {
  const {
    publicKey: adapterPk,
    connected,
    signTransaction,
    sendTransaction,
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

  const localActive = mode === "local";

  const publicKey = useMemo(() => {
    if (localActive && defaultWallet?.publicKey) {
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

  const connectPhantom = async () => {
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) select(phantom.adapter.name as never);
    setTimeout(() => {
      connect().catch(() => {});
    }, 120);
  };

  const sendTx = async (
    connection: Connection,
    tx: Transaction | VersionedTransaction,
    options?: WalletSendOptions,
  ): Promise<string> => {
    if (localActive) {
      const kp = await loadDefaultKeypair();
      if (!kp) throw new Error("No default local trading wallet — set one in Trading wallets");
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
  };

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
    loadDefaultKeypair,
    connectPhantom,
  };
}
