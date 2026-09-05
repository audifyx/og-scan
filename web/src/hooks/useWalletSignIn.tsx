// Shared wallet connect + Sign-In-With-Solana hook. Works with any wallet the
// adapter detects (Phantom, Jupiter, Solflare, Backpack, …) via Wallet Standard.
import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Adapter, WalletName, WalletReadyState } from "@solana/wallet-adapter-base";
import { signInWithWallet } from "@/lib/walletAuth";
import { adapterNameMatches, collapseDuplicateWallets, connectSolanaWallet, findConnectableWallet } from "@/lib/connectSolanaWallet";
import { normalizeSignatureBytes } from "@/lib/wallets/walletNormalize";

export interface PickableWallet { name: string; icon: string; readyState: WalletReadyState; adapter: Adapter }

type SignMessageAdapter = Adapter & {
  signMessage?: (m: Uint8Array) => Promise<unknown>;
};

async function signMessageBytes(adapter: SignMessageAdapter, message: Uint8Array): Promise<Uint8Array> {
  if (typeof adapter.signMessage !== "function") {
    throw new Error("wallet does not support message signing");
  }
  const signature = await Promise.race([
    adapter.signMessage(message),
    new Promise<never>((_, reject) => globalThis.setTimeout(() => reject(new Error(`${adapter.name} signature request timed out. Reopen the wallet and try again.`)), 30000)),
  ]);
  return normalizeSignatureBytes(signature);
}

function findAdapter(wallets: ReturnType<typeof useWallet>["wallets"], name: string): SignMessageAdapter | null {
  const hit = wallets.find((x) => adapterNameMatches(String(x.adapter.name), name));
  return (hit?.adapter as SignMessageAdapter | undefined) ?? null;
}

export function useWalletSignIn() {
  const { wallets, select, disconnect, connect } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);

  // Installed / loadable wallets first. Collapse Phantom/Jupiter duplicates so
  // the picker shows the Wallet Standard instance (Installed) instead of the
  // legacy inject adapter (NotDetected) that used to win by list order.
  const pickable: PickableWallet[] = useMemo(() => {
    const rank = (s: string) => (s === "Installed" ? 0 : s === "Loadable" ? 1 : 2);
    return collapseDuplicateWallets(wallets)
      .map((w) => ({ name: w.adapter.name, icon: w.adapter.icon, readyState: w.readyState, adapter: w.adapter }))
      .sort((a, b) => rank(String(a.readyState)) - rank(String(b.readyState)) || a.name.localeCompare(b.name));
  }, [wallets]);

  const signInWith = useCallback(async (name: string, opts?: { replaceEmailSession?: boolean; connectOnly?: boolean }): Promise<{ isNew: boolean }> => {
    // Wallet Standard and legacy injection can expose duplicate adapters with the
    // same name. Select the same preferred instance that the connection helper
    // will connect, otherwise signing may run against the disconnected duplicate.
    const selected = findConnectableWallet(wallets, name);
    const adapter = (selected?.adapter as SignMessageAdapter | undefined) ?? findAdapter(wallets, name);
    if (!adapter) throw new Error(`${name} not found`);
    const listed = wallets.find((x) => x.adapter === adapter);
    const rs = String(listed?.readyState ?? "");
    if (rs !== "Installed" && rs !== "Loadable") {
      throw new Error(`${name} isn't detected in this browser. Install the ${name} extension (or open OrbitX inside the ${name} app), then try again.`);
    }
    setBusy(name);
    try {
      // Reliable select → connect (handles WalletProvider race + adapter fallback).
      const pubkey = await connectSolanaWallet({
        wallets,
        select: select as (n: WalletName) => void,
        connect,
        preferredName: adapter.name,
      });

      // Give WalletProvider a tick to expose connected publicKey / signMessage.
      await new Promise((r) => setTimeout(r, 60));

      const live = (findConnectableWallet(wallets, adapter.name)?.adapter as SignMessageAdapter | undefined) ?? adapter;

      if (opts?.connectOnly) return { isNew: false };

      if (typeof live.signMessage !== "function") {
        throw new Error(`${name} can't sign the login message here. Open OrbitX in a normal browser tab with the ${name} extension enabled.`);
      }

      try {
        return await signInWithWallet(pubkey, (m) => signMessageBytes(live, m), {
          replaceEmailSession: opts?.replaceEmailSession,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/reject|cancel|denied/i.test(msg)) throw new Error(`${name} signature was rejected`);
        if (/invalid signature/i.test(msg)) {
          throw new Error(`${name} signed, but verification failed — reconnect ${name} and try again`);
        }
        throw err instanceof Error ? err : new Error(msg || "Sign-in failed");
      }
    } finally {
      setBusy(null);
    }
  }, [wallets, select, connect]);

  return { pickable, signInWith, busy, disconnect };
}
