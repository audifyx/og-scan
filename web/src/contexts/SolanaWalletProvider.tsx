import { FC, ReactNode, useCallback, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletError, WalletNotReadyError } from "@solana/wallet-adapter-base";
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
 */
export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const wallets = useMemo(
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

  const onError = useCallback((error: WalletError) => {
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
