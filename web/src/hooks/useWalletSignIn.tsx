// Shared wallet connect + Sign-In-With-Solana hook. Works with any wallet the
// adapter detects (Phantom, Jupiter, Solflare, Backpack, …) via Wallet Standard.
import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Adapter, WalletReadyState } from "@solana/wallet-adapter-base";
import { signInWithWallet } from "@/lib/walletAuth";

export interface PickableWallet { name: string; icon: string; readyState: WalletReadyState; adapter: Adapter }

export function useWalletSignIn() {
  const { wallets, select, disconnect } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);

  // Installed / loadable wallets first, then the rest.
  const pickable: PickableWallet[] = useMemo(() => {
    const rank = (s: string) => (s === "Installed" ? 0 : s === "Loadable" ? 1 : 2);
    return [...wallets]
      .map((w) => ({ name: w.adapter.name, icon: w.adapter.icon, readyState: w.readyState, adapter: w.adapter }))
      .sort((a, b) => rank(a.readyState) - rank(b.readyState) || a.name.localeCompare(b.name));
  }, [wallets]);

  const signInWith = useCallback(async (name: string): Promise<{ isNew: boolean }> => {
    const w = wallets.find((x) => x.adapter.name === name);
    if (!w) throw new Error(`${name} not found`);
    const adapter = w.adapter as Adapter & { signMessage?: (m: Uint8Array) => Promise<Uint8Array> };
    if (!adapter.signMessage) throw new Error(`${name} does not support message signing`);
    const rs = String((w as any).readyState);
    if (rs !== "Installed" && rs !== "Loadable") {
      throw new Error(`${name} isn't detected in this browser. Install the ${name} extension (or open OrbitX inside the ${name} app), then try again.`);
    }
    setBusy(name);
    try {
      select(adapter.name);
      if (!adapter.connected) await adapter.connect();
      const pubkey = adapter.publicKey?.toBase58();
      if (!pubkey) throw new Error("wallet did not return a public key");
      return await signInWithWallet(pubkey, (m) => adapter.signMessage!(m));
    } finally {
      setBusy(null);
    }
  }, [wallets, select]);

  return { pickable, signInWith, busy, disconnect };
}
