import { Loader2, Mail, Wallet } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminPassGate } from "@/components/AdminPassGate";
import { OWNER_EMAIL, OWNER_WALLETS } from "@/lib/ownerDesk";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import type { ReactNode } from "react";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Hidden owner desk gate:
 * 1) Manual code unlock (session)
 * 2) Signed in as OWNER_EMAIL — or owner wallet (VITE_OWNER_WALLETS)
 *
 * Not a substitute for server ADMIN_PASS / JWT on APIs.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAdmin, deskUnlocked, loading } = useAdmin();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  const [picker, setPicker] = useState(false);
  const { pickable, signInWith, busy } = useWalletSignIn();

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!deskUnlocked) {
    return <AdminPassGate>{children}</AdminPassGate>;
  }

  if (isAdmin) return <>{children}</>;

  const email = (user?.email || "").toLowerCase();

  const onPick = async (name: string) => {
    try {
      await signInWith(name);
      setPicker(false);
      toast.success("Signed in with wallet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wallet sign-in failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="mb-2 text-lg font-bold text-white">Sign in required</h1>
        <p className="mb-5 text-sm text-white/45">
          {email
            ? `Signed in as ${email}, but this desk is limited to the owner account.`
            : `Sign in with email (${OWNER_EMAIL}) or an owner wallet.`}
        </p>
        <div className="space-y-2.5">
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
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      </div>
    </div>
  );
};
