// Shared wallet connect + Sign-In-With-Solana hook. Works with any wallet the
// adapter detects (Phantom, Jupiter, Solflare, Backpack, …) via Wallet Standard.
import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Adapter, WalletName, WalletReadyState } from "@solana/wallet-adapter-base";
import { signInWithWallet } from "@/lib/walletAuth";
import { connectSolanaWallet } from "@/lib/connectSolanaWallet";
import { normalizeSignatureBytes } from "@/lib/wallets/walletNormalize";

export interface PickableWallet { name: string; icon: string; readyState: WalletReadyState; adapter: Adapter }

type SignMessageAdapter = Adapter & {
  signMessage?: (m: Uint8Array) => Promise<unknown>;
};

async function signMessageBytes(adapter: SignMessageAdapter, message: Uint8Array): Promise<Uint8Array> {
  if (typeof adapter.signMessage !== "function") {
    throw new Error("wallet does not support message signing");
  }
  return normalizeSignatureBytes(await adapter.signMessage(message));
}

function findAdapter(wallets: ReturnType<typeof useWallet>["wallets"], name: string): SignMessageAdapter | null {
  const exact = wallets.find((x) => x.adapter.name === name)?.adapter as SignMessageAdapter | undefined;
  if (exact) return exact;
  // Standard wallets sometimes register with a slightly different display name.
  const soft = wallets.find((x) => String(x.adapter.name).toLowerCase() === name.toLowerCase())?.adapter as
    | SignMessageAdapter
    | undefined;
  return soft ?? null;
}

export function useWalletSignIn() {
  const { wallets, select, disconnect, connect } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);

  // Installed / loadable wallets first, then the rest.
  const pickable: PickableWallet[] = useMemo(() => {
    const rank = (s: string) => (s === "Installed" ? 0 : s === "Loadable" ? 1 : 2);
    const seen = new Set<string>();
    return [...wallets]
      .map((w) => ({ name: w.adapter.name, icon: w.adapter.icon, readyState: w.readyState, adapter: w.adapter }))
      .filter((w) => {
        const key = String(w.name).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => rank(String(a.readyState)) - rank(String(b.readyState)) || a.name.localeCompare(b.name));
  }, [wallets]);

  const signInWith = useCallback(async (name: string, opts?: { replaceEmailSession?: boolean; connectOnly?: boolean }): Promise<{ isNew: boolean }> => {
    const adapter = findAdapter(wallets, name);
    if (!adapter) throw new Error(`${name} not found`);
    const listed = wallets.find((x) => x.adapter === adapter);
    const rs = String(listed?.readyState ?? "");
    if (rs !== "Installed" && rs !== "Loadable") {
      throw new Error(`${name} isn't detected in this browser. Install the ${name} extension (or open OrbitX inside the ${name} app), then try again.`);
    }
    setBusy(name);
    try {
      // Reliable select → connect (handles WalletProvider race + adapter fallback).
      await connectSolanaWallet({
        wallets,
        select: select as (n: WalletName) => void,
        connect,
        preferredName: adapter.name,
      });

      // Give WalletProvider a tick to expose connected publicKey / signMessage.
      await new Promise((r) => setTimeout(r, 60));

      const live = findAdapter(wallets, adapter.name) ?? adapter;
      if (!live.connected) {
        try {
          await live.connect();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/reject|cancel|denied/i.test(msg)) throw new Error(`${name} connection was rejected`);
          throw err;
        }
      }

      const pubkey = live.publicKey?.toBase58();
      if (!pubkey) throw new Error("wallet did not return a public key — unlock the extension and try again");

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
