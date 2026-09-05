import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { signInWithInjectWallet, type InjectWallet } from "@/lib/injectWallets";
import "@/pages/auth.css";

export function InjectWalletButtons({
  onSignedIn,
  disabled,
}: {
  onSignedIn?: (isNew: boolean) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<InjectWallet | null>(null);

  const run = async (name: InjectWallet) => {
    setBusy(name);
    try {
      const { isNew } = await signInWithInjectWallet(name);
      toast.success(`Signed in with ${name === "jupiter" ? "Jupiter" : "Phantom"}`);
      onSignedIn?.(isNew);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      if (/reject|cancel|denied/i.test(msg)) {
        toast.error(`${name === "jupiter" ? "Jupiter" : "Phantom"} signature was rejected`);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ox-auth-wallet">
      <button
        type="button"
        className="ox-auth-btn ox-auth-btn--blue"
        disabled={disabled || !!busy}
        onClick={() => void run("phantom")}
      >
        {busy === "phantom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        Connect Phantom
      </button>
      <button
        type="button"
        className="ox-auth-btn"
        disabled={disabled || !!busy}
        onClick={() => void run("jupiter")}
      >
        {busy === "jupiter" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        Connect Jupiter
      </button>
      <p className="ox-auth-sub" style={{ margin: "12px 0 0" }}>
        Connect Phantom or Jupiter. Supabase Web3 verifies a free Sign-in-with-Solana message — no transaction, no fees.
      </p>
    </div>
  );
}
