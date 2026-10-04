/**
 * In-app wallet sign-in — the wallet half of auth across OrbitX.
 *
 * Previously Phantom/Jupiter extension pickers. Now: one wallet (the in-app
 * desk wallet), linked once via the dashboard auth-code flow. Sign-in session
 * (Supabase) is separate — this hook only links the wallet identity.
 */
import { useCallback, useMemo, useState } from "react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { WalletReadyState } from "@/wallets/hub";

export interface PickableWallet {
  name: string;
  icon: string;
  readyState: WalletReadyState;
  adapter: { name: string; icon: string; url: string };
}

const IN_APP: PickableWallet = {
  name: "In-App",
  icon: "",
  readyState: WalletReadyState.Installed,
  adapter: { name: "In-App", icon: "", url: "" },
};

export function useWalletSignIn() {
  const billing = useOrbitxBilling();
  const [busy, setBusy] = useState<string | null>(null);

  const pickable: PickableWallet[] = useMemo(() => [IN_APP], []);

  /**
   * Link the in-app wallet (dashboard auth-code flow, one-time). The name arg
   * is accepted for call-site compatibility and ignored — there is only one wallet.
   */
  const signInWith = useCallback(async (
    _name: string,
    _opts?: { replaceEmailSession?: boolean; connectOnly?: boolean },
  ): Promise<{ isNew: boolean }> => {
    setBusy("In-App");
    try {
      // Kicks the one-time dashboard auth-code link. The billing hook resolves
      // the wallet address + balances on its own once the code lands; any
      // failure surfaces on billing.error for the UI.
      billing.beginAuth();
      return { isNew: false };
    } catch (err) {
      throw err instanceof Error ? err : new Error("In-app wallet link failed");
    } finally {
      setBusy(null);
    }
  }, [billing]);

  const disconnect = useCallback(async () => {
    billing.resetAuth();
  }, [billing]);

  return { pickable, signInWith, busy, disconnect };
}
