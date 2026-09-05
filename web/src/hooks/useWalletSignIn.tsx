import { useCallback, useEffect, useMemo, useState } from "react";
import { signInWithInjectWallet, connectInjectWallet, isInjectWalletReady, hubWalletFromName, subscribeInjectWallets, type InjectWallet } from "@/lib/injectWallets";
import { WalletReadyState } from "@/wallets/hub";

export interface PickableWallet {
  name: string;
  icon: string;
  readyState: WalletReadyState;
  adapter: { name: string; icon: string; url: string };
}

const HUB: Array<{ id: InjectWallet; name: string; url: string }> = [
  { id: "phantom", name: "Phantom", url: "https://phantom.app" },
  { id: "jupiter", name: "Jupiter", url: "https://jup.ag" },
];

export function useWalletSignIn() {
  const [busy, setBusy] = useState<string | null>(null);
  const [readyAt, setReadyAt] = useState(0);

  useEffect(() => subscribeInjectWallets(() => setReadyAt((n) => n + 1)), []);

  const pickable: PickableWallet[] = useMemo(() => HUB.map((w) => ({
    name: w.name,
    icon: "",
    readyState: isInjectWalletReady(w.id) ? WalletReadyState.Installed : WalletReadyState.Loadable,
    adapter: { name: w.name, icon: "", url: w.url },
  })), [readyAt]);

  const signInWith = useCallback(async (name: string, opts?: { replaceEmailSession?: boolean; connectOnly?: boolean }): Promise<{ isNew: boolean }> => {
    const id = hubWalletFromName(name);
    if (!id) throw new Error("OrbitX wallet connect supports Phantom and Jupiter only.");
    setBusy(name);
    try {
      if (opts?.connectOnly) {
        await connectInjectWallet(id);
        return { isNew: false };
      }
      return await signInWithInjectWallet(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/reject|cancel|denied/i.test(msg)) throw new Error(`${id === "jupiter" ? "Jupiter" : "Phantom"} signature was rejected`);
      throw err instanceof Error ? err : new Error(msg || "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const disconnect = useCallback(async () => {
    /* hub disconnect is owned by OrbitxWalletHub */
  }, []);

  return { pickable, signInWith, busy, disconnect };
}
