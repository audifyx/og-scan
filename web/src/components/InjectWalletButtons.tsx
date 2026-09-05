import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { isInjectWalletReady, signInWithInjectWallet, type InjectWallet } from "@/lib/injectWallets";
import "@/pages/auth.css";

export function InjectWalletButtons({
  onSignedIn,
  disabled,
}: {
  onSignedIn?: (isNew: boolean) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<InjectWallet | null>(null);
  const [phantomOn, setPhantomOn] = useState(() => isInjectWalletReady("phantom"));
  const [jupiterOn, setJupiterOn] = useState(() => isInjectWalletReady("jupiter"));

  useEffect(() => {
    const tick = () => {
      setPhantomOn(isInjectWalletReady("phantom"));
      setJupiterOn(isInjectWalletReady("jupiter"));
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, []);

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
        onClick={() => {
          if (!phantomOn) {
            window.open("https://phantom.app", "_blank", "noopener,noreferrer");
            return;
          }
          void run("phantom");
        }}
      >
        {busy === "phantom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {phantomOn ? "Connect Phantom" : "Install Phantom"}
      </button>
      <button
        type="button"
        className="ox-auth-btn"
        disabled={disabled || !!busy}
        onClick={() => {
          if (!jupiterOn) {
            window.open("https://jup.ag/mobile", "_blank", "noopener,noreferrer");
            return;
          }
          void run("jupiter");
        }}
      >
        {busy === "jupiter" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {jupiterOn ? "Connect Jupiter" : "Install Jupiter"}
      </button>
      <p className="ox-auth-sub" style={{ margin: "12px 0 0" }}>
        Uses the Phantom / Jupiter extension directly — no wallet adapter.
      </p>
      {(!phantomOn || !jupiterOn) && (
        <div className="ox-auth-links" style={{ marginTop: 10 }}>
          {!phantomOn && <a href="https://phantom.app" target="_blank" rel="noreferrer">Get Phantom</a>}
          {!jupiterOn && <a href="https://jup.ag/mobile" target="_blank" rel="noreferrer">Get Jupiter</a>}
        </div>
      )}
    </div>
  );
}
