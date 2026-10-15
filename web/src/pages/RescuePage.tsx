/**
 * Rescue page wrapper with wallet-adapter providers.
 * Rescue needs a real connected wallet (Phantom) to sign custom transactions
 * (rent refunds, burns, unwraps, fee claims). The in-app wallet is backend-signed
 * and cannot sign these.
 */
import { type FC, type ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import LaunchpadRescue from "./orbitx/LaunchpadRescue";

const ENDPOINT = clusterApiUrl("mainnet-beta");

export const RescueWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default function RescuePage() {
  return (
    <RescueWalletProvider>
      <LaunchpadRescue />
    </RescueWalletProvider>
  );
}
