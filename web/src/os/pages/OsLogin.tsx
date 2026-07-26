import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { OxButton, OxPanel } from "../components/primitives";

export function OsLoginPage() {
  const { user, loading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/os/dashboard";
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true });
  }, [user, loading, next, navigate]);

  const onPick = async (name: string) => {
    try {
      await signInWith(name);
      setPicker(false);
      toast.success("Wallet connected");
      navigate(next, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70dvh" }}>
      <OxPanel>
        <div style={{ textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
          <div className="ox-kicker">Secure gateway</div>
          <h1 className="ox-title" style={{ fontSize: "1.8rem" }}>
            Connect to OrbitX
          </h1>
          <p className="ox-lead" style={{ margin: "0.5rem auto 1.25rem" }}>
            Your Solana wallet is your login. One connection unlocks the City, DEX, launchpad, social, and rewards.
          </p>
          <OxButton type="button" variant="primary" block disabled={loading || Boolean(busy)} onClick={() => setPicker(true)}>
            {loading || busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Log in with wallet
          </OxButton>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.85rem", color: "var(--ox-muted)", fontSize: "0.78rem" }}>
            <ShieldCheck className="h-3.5 w-3.5" /> Sign-in with Solana · no password
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Link to="/auth" style={{ color: "var(--ox-cyan)", fontSize: "0.85rem" }}>
              Classic auth screen
            </Link>
          </div>
        </div>
      </OxPanel>
      <WalletPickerModal open={picker} wallets={pickable} busy={busy} onClose={() => setPicker(false)} onPick={onPick} />
    </div>
  );
}
