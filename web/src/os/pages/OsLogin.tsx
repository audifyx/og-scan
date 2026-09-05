import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { OxButton, OxPanel } from "../components/primitives";

export function OsLoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/os/dashboard";
  const [soon, setSoon] = useState(false);

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
            Sign in with email. Wallet login is coming soon.
          </p>
          <OxButton type="button" variant="primary" block disabled={loading} onClick={() => navigate(`/auth?next=${encodeURIComponent(next)}`)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Sign in with email
          </OxButton>
          <OxButton type="button" variant="ghost" block disabled={loading} onClick={() => setSoon(true)} style={{ marginTop: "0.65rem" }}>
            Wallet login
          </OxButton>
          {soon && (
            <p className="ox-lead" style={{ marginTop: "0.75rem" }}>
              Wallet login — coming soon. Use email for now.
            </p>
          )}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.85rem", color: "var(--ox-muted)", fontSize: "0.78rem" }}>
            <ShieldCheck className="h-3.5 w-3.5" /> Supabase email login
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Link to="/auth" style={{ color: "var(--ox-cyan)", fontSize: "0.85rem" }}>
              Classic auth screen
            </Link>
          </div>
        </div>
      </OxPanel>
    </div>
  );
}
