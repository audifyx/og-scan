/**
 * In-app wallet link button — the wallet half of sign-in.
 * Previously "Connect Phantom" / "Connect Jupiter". Now one button, one wallet.
 */
import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import "@/pages/auth.css";

export function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

export function InjectWalletButtons({
  onSignedIn,
  disabled,
}: {
  onSignedIn?: (isNew: boolean) => void;
  disabled?: boolean;
}) {
  const billing = useOrbitxBilling();
  const [busy, setBusy] = useState(false);
  const linked = billing.ready && !!billing.wallet;

  const run = async () => {
    if (linked) {
      onSignedIn?.(false);
      return;
    }
    setBusy(true);
    try {
      billing.beginAuth();
      // The billing hook resolves the wallet once the auth code lands.
      onSignedIn?.(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet link failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ox-auth-wallet">
      <button
        type="button"
        className="ox-auth-btn ox-auth-btn--blue"
        disabled={disabled || busy}
        onClick={() => void run()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {linked && billing.wallet ? `In-app wallet ${shortAddr(billing.wallet)}` : "Link in-app wallet"}
      </button>
      <p className="ox-auth-sub" style={{ margin: "12px 0 0" }}>
        {billing.error
          ? billing.error
          : "Your OrbitX in-app wallet — the only wallet across OrbitX. One link, then trades and burns are seamless with no popups."}
      </p>
    </div>
  );
}
