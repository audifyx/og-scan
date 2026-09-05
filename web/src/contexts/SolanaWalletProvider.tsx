import { type FC, type ReactNode } from "react";
import { OrbitxWalletHub } from "@/wallets/hub";

/**
 * Custom Phantom + Jupiter hub. Wallet-adapter is not used for connect or login.
 */
export const SolanaWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return <OrbitxWalletHub>{children}</OrbitxWalletHub>;
};
