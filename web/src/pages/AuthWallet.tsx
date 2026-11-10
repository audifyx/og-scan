// OrbitX /auth — X (OAuth 2), Solana Web3, or email.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, Eye, EyeOff, Lock, Rocket, Loader2, Wallet, ShieldCheck, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { resolveAuthReturn, useAuth } from "@/hooks/useAuth";
import { needsUsernameClaim } from "@/lib/usernameClaim";
import { InjectWalletButtons } from "@/components/InjectWalletButtons";
import { XSignInButton } from "@/components/XSignInButton";
import { MergeAccountModal } from "@/components/MergeAccountModal";
import { persistSessionLocally } from "@/lib/authSession";
import { consumeOAuthHash, consumeOAuthProviderTokens, oauthErrorFromLocation, takeAuthNext } from "@/lib/xOAuth";
import { useHumanGate } from "@/components/HumanGate";
import "./auth.css";

export default function AuthWallet() {
  const { user, profile, loading, signIn, signUp, signOut } = useAuth();
  const { requireHuman } = useHumanGate();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = resolveAuthReturn(params);
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
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const tokens = consumeOAuthHash(hash);
    const provider = consumeOAuthProviderTokens(hash);
    if (tokens) {
      persistSessionLocally(tokens);
      void (async () => {
        if (provider?.provider_token) {
          try {
            await fetch("/api/x-session-sync", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(provider),
            });
          } catch {
            /* user can still Connect X on /x */
          }
        }
        window.location.replace(takeAuthNext(next));
      })();
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
    const humanOk = await requireHuman();
    if (!humanOk) return;
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

  const guestTo = next === "/app" ? "/orbitx-social" : next;

  return (
    <div className="ox-auth">
      <div className="ox-auth-bg" />
      <div className="ox-auth-inner">
        <aside className="ox-auth-panel" aria-hidden="true">
          <Link to="/" className="ox-auth-brand" tabIndex={-1}>
            <div className="ox-auth-brand-mark"><Rocket className="h-4 w-4" /></div>
            <div>
              <div className="ox-auth-brand-name">Orbit<span>X</span></div>
              <div className="ox-auth-brand-sub">sign in</div>
            </div>
          </Link>
          <h2 className="ox-auth-panel-title">One identity.<br />Every <span>OrbitX</span> app.</h2>
          <p className="ox-auth-panel-sub">
            Sign in once and your wallet, profile, and social graph follow you across
            the Terminal, Launchpad, Social, and OrbitX OS.
          </p>
          <ul className="ox-auth-panel-list">
            <li><Wallet className="h-4 w-4" /><span><b>Wallet first</b> — connect a Solana wallet, no password needed.</span></li>
            <li><ShieldCheck className="h-4 w-4" /><span><b>Self-custody</b> — your keys stay on your device, PIN-locked.</span></li>
            <li><Zap className="h-4 w-4" /><span><b>Instant return</b> — sign-in drops you back where you came from.</span></li>
          </ul>
          <p className="ox-auth-panel-foot">Terminal · Launchpad · Social · OS</p>
        </aside>

        <div className="ox-auth-main">
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
            Continue with your wallet, X, or email.
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
              <div className="ox-auth-wallet-block">
                <div className="ox-auth-wallet-head"><Wallet className="h-3.5 w-3.5" /> Wallet — fastest way in</div>
                <InjectWalletButtons onSignedIn={(isNew) => { if (isNew) setMerge(true); }} disabled={submitting} />
                <p className="ox-auth-wallet-note">No password, no email — your Solana wallet is your account.</p>
              </div>

              <div className="ox-auth-or">or X</div>
              <div className="ox-auth-social">
                <XSignInButton next={next} disabled={submitting} />
              </div>

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

        <div className="ox-auth-guest">
          <p className="ox-auth-guest-label">Just looking around? No account needed to explore.</p>
          <Link to={guestTo} className="ox-auth-guest-btn">
            <Eye className="h-4 w-4" /> Continue browsing without signing in
          </Link>
          <p className="ox-auth-guest-note">You can sign in any time — we&apos;ll bring you back here.</p>
        </div>

        <Link to="/" className="ox-auth-back">
          Back to home <ArrowRight className="h-3 w-3" />
        </Link>
        </div>
      </div>
      <MergeAccountModal open={merge} onClose={() => setMerge(false)} />
    </div>
  );
}
