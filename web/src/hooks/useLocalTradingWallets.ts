import { useCallback, useEffect, useState } from "react";
import {
  LOCAL_WALLETS_CHANGED,
  createLocalTradingWallet,
  exportLocalTradingWalletSecret,
  getDefaultLocalWalletId,
  getTradingWalletMode,
  importLocalTradingWallet,
  listLocalTradingWallets,
  loadDefaultLocalKeypair,
  loadLocalTradingKeypair,
  removeLocalTradingWallet,
  renameLocalTradingWallet,
  setDefaultLocalWallet,
  setTradingWalletMode,
  type LocalTradingWalletMeta,
  type TradingWalletMode,
} from "@/lib/tradeWallets/localTradingWallets";

function snapshot() {
  return {
    wallets: listLocalTradingWallets(),
    defaultId: getDefaultLocalWalletId(),
    mode: getTradingWalletMode(),
  };
}

export function useLocalTradingWallets() {
  const [state, setState] = useState(snapshot);

  const refresh = useCallback(() => setState(snapshot()), []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(LOCAL_WALLETS_CHANGED, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_WALLETS_CHANGED, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const defaultWallet =
    state.wallets.find((w) => w.id === state.defaultId) ?? state.wallets[0] ?? null;

  return {
    wallets: state.wallets as LocalTradingWalletMeta[],
    defaultId: state.defaultId,
    defaultWallet,
    mode: state.mode as TradingWalletMode,
    setMode: (mode: TradingWalletMode) => {
      setTradingWalletMode(mode);
      refresh();
    },
    importWallet: async (secret: string, label?: string) => {
      const meta = await importLocalTradingWallet(secret, label);
      // Importing a trading key implies Local mode — otherwise claim/trade keep using Phantom.
      setTradingWalletMode("local");
      refresh();
      return meta;
    },
    createWallet: async (label?: string) => {
      const meta = await createLocalTradingWallet(label);
      setTradingWalletMode("local");
      refresh();
      return meta;
    },
    setDefault: (id: string) => {
      setDefaultLocalWallet(id);
      setTradingWalletMode("local");
      refresh();
    },
    rename: (id: string, label: string) => {
      renameLocalTradingWallet(id, label);
      refresh();
    },
    remove: (id: string) => {
      removeLocalTradingWallet(id);
      refresh();
    },
    exportSecret: (id: string) => exportLocalTradingWalletSecret(id),
    loadKeypair: (id: string) => loadLocalTradingKeypair(id),
    loadDefaultKeypair: () => loadDefaultLocalKeypair(),
    refresh,
  };
}
