/**
 * Soft UI gate only — NOT a security boundary for APIs.
 * Real API auth uses server ADMIN_PASS / owner JWT (never this code).
 *
 * Flow: unlock code → then sign in with email (preferred) or wallet.
 */
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, Mail, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setAdminUnlocked } from "@/hooks/useAdmin";
import { OWNER_DESK_CODE, OWNER_EMAIL, OWNER_WALLETS } from "@/lib/ownerDesk";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";

export function AdminPassGate(_props?: { children?: React.ReactNode }) {
  const [unlocked, setUnlockedLocal] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const location = useLocation();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const next = `${location.pathname}${location.search}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() === OWNER_DESK_CODE) {
      setAdminUnlocked(true);
      setUnlockedLocal(true);
      setError("");
    } else {
      setError("Incorrect code");
      setCode("");
    }
  };

  const onPickWallet = async (name: string) => {
    try {
      await signInWith(name);
      setPicker(false);
      toast.success("Signed in with wallet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet sign-in failed");
    }
  };

  if (unlocked) {
    // Parent AdminRoute re-reads sessionStorage and either shows desk or sign-in UI.
    // Never render children here — that would skip the owner email/wallet check.
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <h1 className="mb-1 text-center text-xl font-black text-white">Unlocked</h1>
          <p className="mb-5 text-center text-sm text-white/40">
            Prefer email — sign in as <span className="font-mono text-white/70">{OWNER_EMAIL}</span>
          </p>
          <div className="space-y-3">
            <Link
              to={`/auth/email?next=${encodeURIComponent(next)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14F195] py-3 text-sm font-black text-black hover:brightness-110"
            >
              <Mail className="h-4 w-4" /> Sign in with email
            </Link>
            <button
              type="button"
              onClick={() => setPicker(true)}
              disabled={busy || OWNER_WALLETS.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {OWNER_WALLETS.length === 0 ? "Wallet (set VITE_OWNER_WALLETS)" : "Or connect wallet"}
            </button>
          </div>
          <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPickWallet} busy={busy} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <Lock className="h-7 w-7 text-white/50" />
          </div>
        </div>
        <h1 className="mb-1 text-center text-xl font-black text-white">Owner desk</h1>
        <p className="mb-6 text-center text-sm text-white/40">Enter access code, then sign in.</p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-white/30"
            placeholder="Code"
            autoComplete="off"
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="w-full rounded-xl bg-white/90 py-3 text-sm font-bold text-black hover:bg-white">
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
