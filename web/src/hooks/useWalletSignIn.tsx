// Shared wallet connect + Sign-In-With-Solana hook. Works with any wallet the
// adapter detects (Phantom, Jupiter, Solflare, Backpack, …) via Wallet Standard.
import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Adapter, WalletReadyState } from "@solana/wallet-adapter-base";
import { signInWithWallet } from "@/lib/walletAuth";

export interface PickableWallet { name: string; icon: string; readyState: WalletReadyState; adapter: Adapter }

type SignMessageAdapter = Adapter & {
  signMessage?: (m: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
};

async function signMessageBytes(adapter: SignMessageAdapter, message: Uint8Array): Promise<Uint8Array> {
  if (typeof adapter.signMessage !== "function") {
    throw new Error("wallet does not support message signing");
  }
  const result = await adapter.signMessage(message);
  if (result instanceof Uint8Array) return result;
  if (result && typeof result === "object" && result.signature instanceof Uint8Array) {
    return result.signature;
  }
  throw new Error("wallet returned an invalid signature");
}

export function useWalletSignIn() {
  const { wallets, select, disconnect, connect } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);

  // Installed / loadable wallets first, then the rest.
  const pickable: PickableWallet[] = useMemo(() => {
    const rank = (s: string) => (s === "Installed" ? 0 : s === "Loadable" ? 1 : 2);
    return [...wallets]
      .map((w) => ({ name: w.adapter.name, icon: w.adapter.icon, readyState: w.readyState, adapter: w.adapter }))
      .sort((a, b) => rank(a.readyState) - rank(b.readyState) || a.name.localeCompare(b.name));
  }, [wallets]);

  const signInWith = useCallback(async (name: string, opts?: { replaceEmailSession?: boolean; connectOnly?: boolean }): Promise<{ isNew: boolean }> => {
    const w = wallets.find((x) => x.adapter.name === name);
    if (!w) throw new Error(`${name} not found`);
    const adapter = w.adapter as SignMessageAdapter;
    const rs = String(w.readyState);
    if (rs !== "Installed" && rs !== "Loadable") {
      throw new Error(`${name} isn't detected in this browser. Install the ${name} extension (or open OrbitX inside the ${name} app), then try again.`);
    }
    setBusy(name);
    try {
      select(adapter.name);
      await new Promise((r) => setTimeout(r, 120));
      if (!adapter.connected) {
        try {
          await connect();
        } catch {
          await adapter.connect();
        }
      }
      if (opts?.connectOnly) {
        if (!adapter.publicKey) throw new Error("wallet did not return a public key");
        return { isNew: false };
      }
      if (typeof adapter.signMessage !== "function") {
        throw new Error(`${name} can't sign the login message here. Open OrbitX inside the ${name} app, or try another wallet.`);
      }
      const pubkey = adapter.publicKey?.toBase58();
      if (!pubkey) throw new Error("wallet did not return a public key");
      return await signInWithWallet(pubkey, (m) => signMessageBytes(adapter, m), {
        replaceEmailSession: opts?.replaceEmailSession,
      });
    } finally {
      setBusy(null);
    }
  }, [wallets, select, connect]);

  return { pickable, signInWith, busy, disconnect };
}
