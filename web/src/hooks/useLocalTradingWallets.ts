/**
 * RETIRED — local trading-wallet key import is removed.
 *
 * Per owner order the in-app (desk) wallet is the only wallet across OrbitX:
 * one wallet, one address, everywhere. Importing private keys into the
 * browser fragments that identity, so the local-wallet feature is gone.
 *
 * This module keeps the old export shape so existing imports don't break at
 * build time; every mutating call throws a clear error.
 */
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";

export type LocalTradingWalletMeta = {
  id: string;
  label: string;
  publicKey: string;
};

export type TradingWalletMode = "connected" | "local";

function retired(what: string): Error {
  return new Error(
    `${what} is retired — the in-app wallet is now the only wallet across OrbitX. ` +
      "Link it once and trade from there.",
  );
}

export function useLocalTradingWallets() {
  const billing = useOrbitxBilling();
  const inApp: LocalTradingWalletMeta | null = billing.wallet
    ? { id: "in-app", label: "In-App Wallet", publicKey: billing.wallet }
    : null;

  const no = () => {
    throw retired("Local trading wallets");
  };

  return {
    wallets: inApp ? [inApp] : [],
    defaultId: inApp ? inApp.id : null,
    defaultWallet: inApp,
    mode: "connected" as TradingWalletMode,
    setMode: (_mode: TradingWalletMode) => {},
    importWallet: async (_secret: string, _label?: string) => { throw no(); },
    createWallet: async (_label?: string) => { throw no(); },
    setDefault: (_id: string) => {},
    rename: (_id: string, _label: string) => {},
    remove: (_id: string) => {},
    exportSecret: (_id: string) => { throw no(); },
    loadKeypair: (_id: string) => { throw no(); },
    loadDefaultKeypair: async () => { throw no(); },
    refresh: () => {},
  };
}
