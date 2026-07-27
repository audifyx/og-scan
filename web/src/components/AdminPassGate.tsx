/**
 * Soft UI gate only — NOT a security boundary for APIs.
 * Real API auth uses server ADMIN_PASS / owner JWT (never this code).
 *
 * Flow: unlock code → if already owner, AdminRoute renders the desk;
 * otherwise prompt to sign in with owner email/wallet.
 */
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, Mail, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setAdminUnlocked } from "@/hooks/useAdmin";
import { OWNER_DESK_CODE, OWNER_EMAIL, OWNER_WALLETS, isOwnerIdentity } from "@/lib/ownerDesk";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { useAuth } from "@/hooks/useAuth";

export function AdminPassGate(_props?: { children?: React.ReactNode }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const next = `${location.pathname}${location.search}`;
  const alreadyOwner = isOwnerIdentity({ email: user?.email });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() !== OWNER_DESK_CODE) {
      setError("Incorrect code");
      setCode("");
      return;
    }
    setSubmitting(true);
    setError("");
    // Unlock session — AdminRoute listens and either opens the desk (if already
    // owner) or shows the email/wallet sign-in screen. Do NOT keep a local
    // "unlocked" UI that forces a second sign-in when already owner.
    setAdminUnlocked(true);
    // Safety: if parent doesn't remount (edge case), drop spinner.
    window.setTimeout(() => setSubmitting(false), 2000);
  };

  const onPickWallet = async (name: string) => {
    try {
      await signInWith(name, { replaceEmailSession: true });
      setPicker(false);
      toast.success("Signed in with wallet");
      setAdminUnlocked(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet sign-in failed");
    }
  };

  if (submitting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020915] p-4">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">
            {alreadyOwner ? "Opening owner desk…" : "Code accepted — confirm owner sign-in…"}
          </p>
          {alreadyOwner && (
            <p className="font-mono text-xs text-white/35">{user?.email}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020915] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <Lock className="h-7 w-7 text-white/50" />
          </div>
        </div>
        <h1 className="mb-1 text-center text-xl font-black text-white">Owner desk</h1>
        <p className="mb-2 text-center text-sm text-white/40">Enter access code to continue.</p>
        {alreadyOwner ? (
          <p className="mb-6 text-center font-mono text-[11px] text-[#14F195]/80">
            Signed in as {user?.email} ✓
          </p>
        ) : (
          <p className="mb-6 text-center text-xs text-white/35">
            After unlock, sign in as <span className="font-mono text-white/55">{OWNER_EMAIL}</span>
          </p>
        )}

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
            {alreadyOwner ? "Unlock & enter" : "Unlock"}
          </button>
        </form>

        {!alreadyOwner && (
          <div className="mt-5 space-y-2 border-t border-white/10 pt-5">
            <Link
              to={`/auth/email?next=${encodeURIComponent(next)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14F195] py-3 text-sm font-black text-black hover:brightness-110"
            >
              <Mail className="h-4 w-4" /> Sign in with email first
            </Link>
            <button
              type="button"
              onClick={() => setPicker(true)}
              disabled={busy || OWNER_WALLETS.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {OWNER_WALLETS.length === 0 ? "Wallet (set VITE_OWNER_WALLETS)" : "Or connect owner wallet"}
            </button>
          </div>
        )}
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPickWallet} busy={busy} />
      </div>
    </div>
  );
}
