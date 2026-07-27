// OrbitX /auth — wallet-first login. One connection unlocks every route.
// Email/password is retired to a one-time merge (and a hidden /auth/email
// recovery path); the wallet is your identity everywhere.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Wallet, ShieldCheck, Sparkles, Loader2, GitMerge, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { MergeAccountModal } from "@/components/MergeAccountModal";
import { needsUsernameClaim } from "@/lib/usernameClaim";

export default function AuthWallet() {
  const { user, profile, loading } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [picker, setPicker] = useState(false);
  const [merge, setMerge] = useState(false);
  const [pendingMerge, setPendingMerge] = useState(false);

  const walletPk =
    publicKey?.toBase58() ||
    (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
    (user?.user_metadata?.wallet as string | undefined) ||
    null;
  const waitingOnUsername = Boolean(user && profile && needsUsernameClaim(profile.username, walletPk));

  useEffect(() => {
    // Password recovery links must use the email update form, not wallet auth.
    let recovery = false;
    try {
      if (window.location.hash.includes("type=recovery")) recovery = true;
      if (sessionStorage.getItem("og_password_recovery") === "1") recovery = true;
      if (params.get("mode") === "update") recovery = true;
    } catch { /* noop */ }
    if (recovery) {
      navigate(`/auth/email?mode=update${next && next !== "/app" ? `&next=${encodeURIComponent(next)}` : ""}`, { replace: true });
    }
  }, [navigate, next, params]);

  useEffect(() => {
    if (loading || !user || merge || pendingMerge || waitingOnUsername) return;
    // Wait until profile is loaded so we don't skip the username gate
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
      // UsernameClaimGate will prompt for a real username when needed
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#020915] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(900px 420px at 20% -5%, hsl(var(--og-cyan)/0.15), transparent 60%), radial-gradient(800px 400px at 85% 0%, hsl(var(--og-gold)/0.10), transparent 55%)" }} />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, hsl(var(--og-cyan)), hsl(var(--og-gold)))" }}>
            <Sparkles className="h-5 w-5 text-black" strokeWidth={2.4} />
          </div>
          <span className="text-xl font-black tracking-tight">Orbit<span className="text-og-cyan">X</span></span>
        </div>

        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-center backdrop-blur-xl">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">Sign in</div>
          <h1 className="text-2xl font-black">Enter OrbitX</h1>
          <p className="mx-auto mt-2 max-w-xs text-[13px] text-white/50">Email login preferred for owner tools. Wallet works everywhere else.</p>

          {waitingOnUsername ? (
            <p className="mt-6 text-[13px] text-og-lime">Pick a username in the popup to finish signing in…</p>
          ) : (
            <>
              <Link
                to={`/auth/email?next=${encodeURIComponent(next)}`}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14F195] px-5 py-3.5 text-sm font-black text-black transition hover:brightness-110"
              >
                Sign in with email
              </Link>

              <button type="button" onClick={() => { setPendingMerge(false); setPicker(true); }} disabled={loading}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Or connect wallet
              </button>

              <button type="button" onClick={() => { if (user) { setMerge(true); } else { setPendingMerge(true); setPicker(true); } }} disabled={loading}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-og-gold/40 bg-og-gold/10 px-5 py-3 text-sm font-black text-og-gold transition hover:bg-og-gold/20 disabled:opacity-50">
                <GitMerge className="h-4 w-4" /> Merge an existing account
              </button>
            </>
          )}

          <div className="mt-4 grid grid-cols-1 gap-2 text-left text-[12px] text-white/50">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-og-lime" /> Sign a free message — no transaction, no fees</span>
            <span className="inline-flex items-center gap-2"><Wallet className="h-3.5 w-3.5 text-og-cyan" /> Phantom, Jupiter, Solflare &amp; more supported</span>
            <span className="inline-flex items-center gap-2"><GitMerge className="h-3.5 w-3.5 text-og-gold" /> Merge links your old email account + all its data to this wallet</span>
          </div>
        </div>

        <Link to={`/auth/email?mode=reset&next=${encodeURIComponent(next)}`} className="mt-5 inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
          Forgot password? Reset via email <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      <MergeAccountModal open={merge} onClose={() => { setMerge(false); }} />
    </div>
  );
}
