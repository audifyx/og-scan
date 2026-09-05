// OrbitX /auth — X (OAuth 2), Solana Web3, or email.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, Eye, EyeOff, Lock, Rocket, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { needsUsernameClaim } from "@/lib/usernameClaim";
import { InjectWalletButtons } from "@/components/InjectWalletButtons";
import { XSignInButton } from "@/components/XSignInButton";
import { MergeAccountModal } from "@/components/MergeAccountModal";
import { persistSessionLocally } from "@/lib/authSession";
import { consumeOAuthHash, oauthErrorFromLocation, takeAuthNext } from "@/lib/xOAuth";
import "./auth.css";

export default function AuthWallet() {
  const { user, profile, loading, signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const modeParam = params.get("mode");

  const [merge, setMerge] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signup, setSignup] = useState(modeParam === "signup");
  const [username, setUsername] = useState("");

  const walletPk =
    (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
    (user?.user_metadata?.wallet as string | undefined) ||
    null;
  const waitingOnUsername = Boolean(user && profile && needsUsernameClaim(profile.username, walletPk));

  useEffect(() => {
    let recovery = false;
    try {
      if (window.location.hash.includes("type=recovery")) recovery = true;
      if (sessionStorage.getItem("og_password_recovery") === "1") recovery = true;
      if (params.get("mode") === "update") recovery = true;
    } catch { /* noop */ }
    if (recovery) {
      const hash = window.location.hash || "";
      const nextQ = next && next !== "/app" ? `&next=${encodeURIComponent(next)}` : "";
      window.location.replace(`/auth/email?mode=update${nextQ}${hash}`);
      return;
    }
    const oauthErr = oauthErrorFromLocation();
    if (oauthErr) {
      setFormError(oauthErr);
      toast.error(oauthErr);
      return;
    }
    const tokens = consumeOAuthHash();
    if (tokens) {
      persistSessionLocally(tokens);
      window.location.replace(takeAuthNext(next));
    }
  }, [next, params]);

  useEffect(() => {
    if (loading || !user || waitingOnUsername) return;
    navigate(next, { replace: true });
  }, [user, loading, navigate, next, waitingOnUsername]);

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      toast.error("Enter email and password");
      return;
    }
    if (signup && username.trim().length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (signup) {
        const { error } = await signUp(cleanEmail, password, username.trim().replace(/^@/, ""));
        if (error) {
          const msg = error.message.includes("already registered") ? "This email is already registered — try signing in" : error.message;
          setFormError(msg);
          toast.error(msg);
          return;
        }
        toast.success("Account created — check your email to verify");
        navigate("/setup");
        return;
      }
      const { error } = await signIn(cleanEmail, password);
      if (error) {
        const raw = error.message || "Sign-in failed";
        const msg = /invalid login|invalid credentials/i.test(raw)
          ? "Invalid email or password"
          : /email not confirmed/i.test(raw)
            ? "Confirm your email first — check your inbox"
            : raw;
        setFormError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Welcome back");
      navigate(next, { replace: true });
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Sign-in failed";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ox-auth">
      <div className="ox-auth-bg" />
      <div className="ox-auth-inner">
        <Link to="/" className="ox-auth-brand">
          <div className="ox-auth-brand-mark"><Rocket className="h-4 w-4" /></div>
          <div>
            <div className="ox-auth-brand-name">Orbit<span>X</span></div>
            <div className="ox-auth-brand-sub">sign in</div>
          </div>
        </Link>

        <div className="ox-auth-card">
          <div className="ox-auth-kicker">Secure access</div>
          <h1 className="ox-auth-title">{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="ox-auth-sub">
            Continue with X, a Solana wallet, or email.
          </p>

          {waitingOnUsername ? (
            <div className="ox-auth-wait-box">
              <p className="ox-auth-wait">Pick a username in the popup to finish signing in…</p>
              <button
                type="button"
                className="ox-auth-btn ox-auth-btn--ghost"
                onClick={async () => {
                  await signOut();
                  toast.success("Signed out — you can sign in with a different account");
                }}
              >
                Use a different account
              </button>
            </div>
          ) : (
            <>
              <div className="ox-auth-social">
                <XSignInButton next={next} disabled={submitting} />
              </div>

              <div className="ox-auth-or">or wallet</div>
              <InjectWalletButtons onSignedIn={(isNew) => { if (isNew) setMerge(true); }} disabled={submitting} />

              <div className="ox-auth-or">or email</div>
              <form onSubmit={onEmailSubmit} className="ox-auth-form">
                {signup && (
                  <label className="ox-auth-label">
                    Username
                    <input
                      className="ox-auth-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="yourname"
                      autoComplete="username"
                    />
                  </label>
                )}
                <label className="ox-auth-label">
                  Email
                  <input
                    className="ox-auth-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                  />
                </label>
                <label className="ox-auth-label">
                  Password
                  <div className="ox-auth-pw">
                    <input
                      className="ox-auth-input"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={signup ? "new-password" : "current-password"}
                    />
                    <button type="button" className="ox-auth-eye" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <button type="submit" className="ox-auth-btn" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {signup ? "Create account" : "Sign in with email"}
                </button>
                {formError && <p className="ox-auth-error" role="alert">{formError}</p>}

                <div className="ox-auth-links">
                  <button type="button" onClick={() => setSignup((v) => !v)}>
                    {signup ? "Already have an account? Sign in" : "Need an account? Sign up"}
                  </button>
                  <Link to={`/auth/email?mode=reset&next=${encodeURIComponent(next)}`}>Forgot password?</Link>
                </div>
              </form>
            </>
          )}
        </div>

        <Link to="/" className="ox-auth-back">
          Back to home <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <MergeAccountModal open={merge} onClose={() => setMerge(false)} />
    </div>
  );
}
