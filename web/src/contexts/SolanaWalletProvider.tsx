import { FC, ReactNode, useCallback, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletError, WalletNotReadyError } from "@solana/wallet-adapter-base";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import {
  LedgerWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { HELIUS_RPC } from "@/lib/og";
import { BackpackWalletAdapter } from "@/lib/wallets/backpackWalletAdapter";
import { JupiterWalletAdapter } from "@/lib/wallets/jupiterWalletAdapter";

interface Props {
  children: ReactNode;
}

/**
 * Default WalletProvider onError opens adapter.url in a new tab on WalletNotReadyError.
 * JupiterWalletAdapter.url was https://jup.ag — so autoConnect / connect() on a
 * missing Jupiter extension yanked users to the Jupiter website instead of signing
 * in-app. Never navigate away from OrbitX for wallet errors.
 *
 * useStandardWalletAdapters discovers Phantom / Jupiter Wallet Extension via the
 * Solana Wallet Standard (required for reliable browser signMessage / signTransaction).
 * Legacy inject adapters remain as fallbacks when Standard isn't registered yet.
 */
export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const adapters = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new JupiterWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [],
  );

  // Prefer Wallet Standard adapters (Phantom, Jupiter V2, Solflare, …) when present.
  const wallets = useStandardWalletAdapters(adapters);

  const onError = useCallback((error: WalletError) => {
    // Critical: do NOT window.open(adapter.url). Default WalletProvider does that
    // on WalletNotReadyError (was yanking users to jup.ag). Toast/UI handles UX.
    if (error instanceof WalletNotReadyError) {
      console.warn(
        "[wallet]",
        error.message || "Wallet not ready — install the extension or open OrbitX in the wallet app browser.",
      );
      return;
    }
    console.error("[wallet]", error);
  }, []);

  return (
    <ConnectionProvider endpoint={HELIUS_RPC}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};
