// OrbitX /auth — metal-theme sign-in (email preferred for owner tools, wallet for everyone).
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Wallet, ShieldCheck, Loader2, GitMerge, ArrowRight, Mail, Eye, EyeOff, Lock, Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { MergeAccountModal } from "@/components/MergeAccountModal";
import { needsUsernameClaim } from "@/lib/usernameClaim";
import { OWNER_EMAIL } from "@/lib/ownerDesk";
import "./auth.css";

type Tab = "email" | "wallet";

export default function AuthWallet() {
  const { user, profile, loading, signIn, signUp } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const modeParam = params.get("mode");

  const [tab, setTab] = useState<Tab>(modeParam === "wallet" ? "wallet" : "email");
  const [picker, setPicker] = useState(false);
  const [merge, setMerge] = useState(false);
  const [pendingMerge, setPendingMerge] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signup, setSignup] = useState(modeParam === "signup");
  const [username, setUsername] = useState("");

  const walletPk =
    publicKey?.toBase58() ||
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
    }
  }, [next, params]);

  useEffect(() => {
    if (loading || !user || merge || pendingMerge || waitingOnUsername) return;
    if (user && !profile) return;
    navigate(next, { replace: true });
  }, [user, profile, loading, next, navigate, merge, pendingMerge, waitingOnUsername]);

  const onPick = async (name: string) => {
    try {
      const { isNew } = await signInWith(name);
      setPicker(false);
      toast.success("Signed in with wallet");
      if (isNew || pendingMerge) {
        setMerge(true);
        setPendingMerge(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

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
    try {
      if (signup) {
        const { error } = await signUp(cleanEmail, password, username.trim().replace(/^@/, ""));
        if (error) {
          toast.error(error.message.includes("already registered") ? "This email is already registered — try signing in" : error.message);
          return;
        }
        toast.success("Account created — check your email to verify");
        navigate("/setup");
        return;
      }
      const { error } = await signIn(cleanEmail, password);
      if (error) {
        const msg = error.message || "";
        if (/invalid login|invalid credentials/i.test(msg)) toast.error("Invalid email or password");
        else if (/email not confirmed/i.test(msg)) toast.error("Confirm your email first — check your inbox");
        else toast.error(msg);
        return;
      }
      toast.success("Welcome back");
      navigate(next, { replace: true });
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
            Email is best for owner tools. Wallet works for trading &amp; launches.
            {next.includes("desk") || next.includes("admin") ? (
              <> Prefer <span className="ox-auth-em">{OWNER_EMAIL}</span> for admin desks.</>
            ) : null}
          </p>

          {waitingOnUsername ? (
            <p className="ox-auth-wait">Pick a username in the popup to finish signing in…</p>
          ) : (
            <>
              <div className="ox-auth-tabs">
                <button type="button" className={tab === "email" ? "ox-auth-tab ox-auth-tab--on" : "ox-auth-tab"} onClick={() => setTab("email")}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
                <button type="button" className={tab === "wallet" ? "ox-auth-tab ox-auth-tab--on" : "ox-auth-tab"} onClick={() => setTab("wallet")}>
                  <Wallet className="h-3.5 w-3.5" /> Wallet
                </button>
              </div>

              {tab === "email" ? (
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
                      autoFocus
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

                  <button type="submit" className="ox-auth-btn" disabled={submitting || loading}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    {signup ? "Create account" : "Sign in with email"}
                  </button>

                  <div className="ox-auth-links">
                    <button type="button" onClick={() => setSignup((v) => !v)}>
                      {signup ? "Already have an account? Sign in" : "Need an account? Sign up"}
                    </button>
                    <Link to={`/auth/email?mode=reset&next=${encodeURIComponent(next)}`}>Forgot password?</Link>
                  </div>
                </form>
              ) : (
                <div className="ox-auth-wallet">
                  <button
                    type="button"
                    className="ox-auth-btn ox-auth-btn--blue"
                    disabled={loading || !!busy}
                    onClick={() => { setPendingMerge(false); setPicker(true); }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Connect Phantom / Jupiter
                  </button>
                  <button
                    type="button"
                    className="ox-auth-btn ox-auth-btn--ghost"
                    disabled={loading}
                    onClick={() => { if (user) setMerge(true); else { setPendingMerge(true); setPicker(true); } }}
                  >
                    <GitMerge className="h-4 w-4" /> Merge legacy email account
                  </button>
                  <ul className="ox-auth-bullets">
                    <li><ShieldCheck className="h-3.5 w-3.5" /> Free signature — no tx, no fees</li>
                    <li><Wallet className="h-3.5 w-3.5" /> Phantom, Jupiter, Solflare &amp; more</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <Link to="/" className="ox-auth-back">
          Back to home <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      <MergeAccountModal open={merge} onClose={() => setMerge(false)} />
    </div>
  );
}
