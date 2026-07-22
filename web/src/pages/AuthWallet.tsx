// OrbitX /auth — wallet-first login. One connection unlocks every route.
// Email/password is retired to a one-time merge (and a hidden /auth/email
// recovery path); the wallet is your identity everywhere.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Wallet, ShieldCheck, Sparkles, Loader2, GitMerge, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { MergeAccountModal } from "@/components/MergeAccountModal";

export default function AuthWallet() {
  const { user, loading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [picker, setPicker] = useState(false);
  const [merge, setMerge] = useState(false);

  useEffect(() => { if (!loading && user) navigate(next, { replace: true }); }, [user, loading, next, navigate]);

  const onPick = async (name: string) => {
    try {
      const { isNew } = await signInWith(name);
      setPicker(false);
      toast.success("Signed in with wallet");
      if (isNew) setMerge(true); else navigate(next, { replace: true });
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
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">Wallet is your login</div>
          <h1 className="text-2xl font-black">Connect to enter</h1>
          <p className="mx-auto mt-2 max-w-xs text-[13px] text-white/50">One wallet connection unlocks the launchpad, DEX, NFT marketplace, and every tool. No email, no password.</p>

          <button type="button" onClick={() => setPicker(true)} disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-og-cyan px-5 py-3.5 text-sm font-black text-black transition hover:brightness-110 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Connect wallet
          </button>

          <div className="mt-4 grid grid-cols-1 gap-2 text-left text-[12px] text-white/50">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-og-lime" /> Sign a free message — no transaction, no fees</span>
            <span className="inline-flex items-center gap-2"><Wallet className="h-3.5 w-3.5 text-og-cyan" /> Phantom, Jupiter, Solflare &amp; more supported</span>
            <button onClick={() => setMerge(true)} className="inline-flex items-center gap-2 text-left hover:text-white"><GitMerge className="h-3.5 w-3.5 text-og-gold" /> Have an old email account? Merge it once</button>
          </div>
        </div>

        <Link to="/auth/email" className="mt-5 inline-flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60">
          Trouble connecting? Use email (legacy) <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      <MergeAccountModal open={merge} onClose={() => { setMerge(false); if (user) navigate(next, { replace: true }); }} />
    </div>
  );
}
