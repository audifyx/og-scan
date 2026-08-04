import { FC, ReactNode, useCallback, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletError, WalletNotReadyError } from "@solana/wallet-adapter-base";
import {
  LedgerWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { HELIUS_RPC } from "@/lib/og";
import { BackpackWalletAdapter } from "@/lib/wallets/backpackWalletAdapter";
import { JupiterWalletAdapter } from "@/lib/wallets/jupiterWalletAdapter";
import { PhantomWalletAdapter } from "@/lib/wallets/phantomWalletAdapter";

interface Props {
  children: ReactNode;
}

/**
 * Default WalletProvider onError opens adapter.url in a new tab on WalletNotReadyError.
 * JupiterWalletAdapter.url was https://jup.ag — so autoConnect / connect() on a
 * missing Jupiter extension yanked users to the Jupiter website instead of signing
 * in-app. Never navigate away from OrbitX for wallet errors.
 */
export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const wallets = useMemo(
    () => {
      // Debug: Log wallet detection
      if (typeof window !== "undefined") {
        const phantom = (window as any).phantom?.solana || (window as any).solana;
        console.log("[wallet] Phantom detected:", !!phantom, phantom?.isPhantom);
        console.log("[wallet] Jupiter detected:", !!(window as any).jupiter?.solana, (window as any).jupiter?.solana?.isJupiter);
      }
      return [
        new PhantomWalletAdapter(),
        new JupiterWalletAdapter(),
        new SolflareWalletAdapter(),
        new BackpackWalletAdapter(),
        new TorusWalletAdapter(),
        new LedgerWalletAdapter(),
      ];
    },
    [],
  );

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
