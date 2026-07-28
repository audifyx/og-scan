import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { getPortfolio } from "@/lib/predictions/api";
import type { PredPortfolio } from "@/lib/predictions/types";
import "./predictions.css";

export type PredictionsOutletContext = {
  userId: string | null;
  profileUsername: string | null;
  portfolio: PredPortfolio | null;
  refetchPortfolio: () => void;
  openWalletPicker: () => void;
};

export default function PredictionsLayout() {
  const { user, profile } = useAuth();
  const { connected } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);

  const { data: portfolio, refetch } = useQuery({
    queryKey: ["pred-portfolio", user?.id],
    queryFn: () => (user?.id ? getPortfolio(user.id) : null),
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  const onConnect = async (name: string) => {
    try {
      const { isNew } = await signInWith(name);
      setPicker(false);
      toast.success(isNew ? "Account created — claim your username if prompted" : "Signed in with unified OrbitX account");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const ctx: PredictionsOutletContext = {
    userId: user?.id ?? null,
    profileUsername: profile?.username ?? null,
    portfolio: portfolio ?? null,
    refetchPortfolio: () => { refetch(); },
    openWalletPicker: () => setPicker(true),
  };

  return (
    <div className="pm-root">
      <header className="pm-nav">
        <Link to="/predictions" className="pm-brand">
          <img src={logo} alt="" width={28} height={28} className="rounded-lg" />
          Orbit<span>X</span> Predict
        </Link>
        <nav className="pm-nav-tabs">
          <NavLink to="/predictions" end className={({ isActive }) => `pm-nav-tab ${isActive ? "pm-nav-tab--on" : ""}`}>
            Markets
          </NavLink>
          <NavLink to="/predictions/portfolio" className={({ isActive }) => `pm-nav-tab ${isActive ? "pm-nav-tab--on" : ""}`}>
            Portfolio
          </NavLink>
        </nav>
        <div className="pm-nav-right">
          {user?.id && portfolio && (
            <div className="pm-balance">
              Balance <strong>${portfolio.usdc_balance.toFixed(2)}</strong> USDC
            </div>
          )}
          {user?.id && profile?.username && (
            <div className="pm-user">@<em>{profile.username}</em></div>
          )}
          {!user?.id ? (
            <button type="button" className="pm-btn pm-btn--gold" onClick={() => setPicker(true)}>
              <Wallet className="h-4 w-4" /> Connect Phantom / Jupiter
            </button>
          ) : !connected ? (
            <button type="button" className="pm-btn pm-btn--ghost" onClick={() => setPicker(true)}>
              Link wallet
            </button>
          ) : null}
          <Link to="/" className="pm-btn pm-btn--ghost">OrbitX</Link>
        </div>
      </header>
      <main className="pm-main">
        <Outlet context={ctx} />
      </main>
      <WalletPickerModal
        open={picker}
        onClose={() => setPicker(false)}
        wallets={pickable}
        busy={busy}
        onPick={onConnect}
      />
    </div>
  );
}

export function usePredictionsContext() {
  return useOutletContext<PredictionsOutletContext>();
}
