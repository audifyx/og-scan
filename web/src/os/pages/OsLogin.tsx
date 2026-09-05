import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { InjectWalletButtons } from "@/components/InjectWalletButtons";
import { XSignInButton } from "@/components/XSignInButton";
import { OxButton, OxPanel } from "../components/primitives";

export function OsLoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/os/dashboard";

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true });
  }, [user, loading, next, navigate]);

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70dvh" }}>
      <OxPanel>
        <div style={{ textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
          <div className="ox-kicker">Secure gateway</div>
          <h1 className="ox-title" style={{ fontSize: "1.8rem" }}>
            Connect to OrbitX
          </h1>
          <p className="ox-lead" style={{ margin: "0.5rem auto 1.25rem" }}>
            X, Phantom / Jupiter, or email.
          </p>
          <div style={{ marginBottom: "0.75rem" }}>
            <XSignInButton next={next} disabled={loading} />
          </div>
          <InjectWalletButtons disabled={loading} />
          <OxButton type="button" variant="ghost" block disabled={loading} onClick={() => navigate(`/auth?next=${encodeURIComponent(next)}`)} style={{ marginTop: "0.65rem" }}>
            <Mail className="h-4 w-4" /> Sign in with email
          </OxButton>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.85rem", color: "var(--ox-muted)", fontSize: "0.78rem" }}>
            <ShieldCheck className="h-3.5 w-3.5" /> X · Web3 wallet · email
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Link to="/auth" style={{ color: "var(--ox-cyan)", fontSize: "0.85rem" }}>
              Full sign-in screen
            </Link>
          </div>
        </div>
      </OxPanel>
    </div>
  );
}
