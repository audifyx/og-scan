// OrbitX Launchpad shell — two-tier Solana launchpad chrome (brand bar + tab rail).
import { AntiVampProtectionBadge } from "@/components/layout/AntiVampProtectionBadge";
import { NavLink, Outlet, Link, useSearchParams } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { linkEvmToSolana } from "@/lib/orbitx/walletLink";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { toast } from "sonner";
import {
  Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Wallet, Flame, Trophy, Briefcase, ShieldCheck, Zap, Link2, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { shortAddr } from "./_shared";
import { redeemReferralCode } from "@/lib/orbitx/registry";
import { useAdmin } from "@/hooks/useAdmin";
import { useChainTelemetry, useSolUsd, fmtInt } from "./lpx";
import { useAuth } from "@/hooks/useAuth";
import "./orbitx-2026.css";

const TABS = [
  { to: "/orbitxlaunch", label: "Board", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "Create", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/claim", label: "Claim", icon: HandCoins, end: false, hot: true },
  { to: "/orbitxlaunch/rescue", label: "Rescue", icon: Flame, end: false, hot: true },
  { to: "/orbitxlaunch/leaderboard", label: "Leaders", icon: Trophy, end: false },
  { to: "/orbitxlaunch/portfolio", label: "Portfolio", icon: Briefcase, end: false },
  { to: "/orbitxlaunch/profile", label: "Profile", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "About", icon: Info, end: false },
];

function WalletConsole() {
  const { connection } = useConnection();
  const { publicKey, connected, disconnect } = useWallet();
  const { user } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);
  const addr = publicKey?.toBase58();

  const { data: sol } = useQuery({
    queryKey: ["lp-header-balance", addr],
    queryFn: async () => (addr ? (await connection.getBalance(publicKey!)) / 1e9 : null),
    enabled: !!addr,
    refetchInterval: 30_000,
  });

  const onPick = async (name: string) => {
    try {
      const emailSession = !!user?.email && !/@wallet\.orbitx\.app$/i.test(user.email);
      await signInWith(name, emailSession ? { connectOnly: true } : undefined);
      setPicker(false);
      toast.success(emailSession ? "Wallet connected" : "Signed in with wallet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  if (!connected || !addr) {
    return (
      <>
        <button type="button" onClick={() => setPicker(true)} className="ox-wallet-btn">
          <Wallet className="h-4 w-4" /> Connect
        </button>
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      </>
    );
  }
  return (
    <div className="ox-wallet-chip">
      <span className="ox-wallet-dot" />
      <div className="leading-none">
        <div className="pf-mono text-[11px] font-bold text-white">{shortAddr(addr)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-white/45">
          {sol != null ? `${sol.toFixed(3)} SOL` : "linked"}
        </div>
      </div>
      <button type="button" onClick={() => disconnect().catch(() => undefined)} className="ox-wallet-exit">
        Exit
      </button>
    </div>
  );
}

function EvmWalletButton() {
  const { account, linkedAddress, openConnect, disconnect } = useEvmWallet();
  const { publicKey } = useWallet();
  const shown = account || linkedAddress;
  useEffect(() => {
    const sol = publicKey?.toBase58();
    if (sol && account) linkEvmToSolana(sol, account);
  }, [publicKey, account]);
  if (!shown) {
    return (
      <button type="button" onClick={openConnect} className="ox-ghost-btn hidden md:inline-flex">
        <Link2 className="h-3.5 w-3.5" /> EVM
      </button>
    );
  }
  return (
    <div className="ox-wallet-chip hidden md:flex" data-tone="evm">
      <span className="ox-wallet-dot" style={{ background: "#627EEA", boxShadow: "0 0 8px #627EEA" }} />
      <div className="leading-none">
        <div className="pf-mono text-[11px] font-bold text-white">{shortAddr(shown)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-white/45">EVM</div>
      </div>
      <button type="button" onClick={disconnect} className="ox-wallet-exit">Unlink</button>
    </div>
  );
}

function NetworkStrip() {
  const tel = useChainTelemetry();
  const solUsd = useSolUsd();
  const ok = tel.data?.ok ?? false;
  return (
    <div className="ox-ticker">
      <div className="ox-ticker-track">
        {Array.from({ length: 2 }).map((_, dup) => (
          <span key={dup} className="inline-flex items-center gap-6 pf-mono text-[11px] uppercase tracking-wide">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[#14F195]" : "bg-[#ff4d6d]"}`} />
              Solana {ok ? "live" : "degraded"}
            </span>
            <span>slot {fmtInt(tel.data?.slot)}</span>
            <span>{fmtInt(tel.data?.tps)} tps</span>
            <span>rpc {tel.data?.latencyMs != null ? `${tel.data.latencyMs}ms` : "—"}</span>
            <span>SOL ${solUsd.data ? solUsd.data.price.toFixed(2) : "—"}</span>
            {isLaunchFeePromoActive() ? (
              <span className="font-bold text-[#14F195]">★ FREE launches — {launchFeePromoDaysLeft()}d left</span>
            ) : (
              <span>{fmtUsd(ORBITX_FEE_USD)} launch · {(CREATOR_FEE_BPS / 100).toFixed(2)}% creator</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReferralCapture() {
  const [params] = useSearchParams();
  const { publicKey } = useWallet();
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    const ref = params.get("ref");
    if (ref) localStorage.setItem("orbitx_pending_referral", ref.toUpperCase());
  }, [params]);
  useEffect(() => {
    const wallet = publicKey?.toBase58();
    const pending = localStorage.getItem("orbitx_pending_referral");
    if (!wallet || !pending || attempted.current === wallet) return;
    attempted.current = wallet;
    redeemReferralCode(wallet, pending).finally(() => localStorage.removeItem("orbitx_pending_referral"));
  }, [publicKey]);
  return null;
}

function TabRail({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="ox-tab-rail">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => cn("ox-tab", isActive && "ox-tab--on", t.hot && !isActive && "ox-tab--hot")}
        >
          <t.icon className="h-3.5 w-3.5" />
          <span>{t.label}</span>
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink to="/orbitxlaunch/ox-desk-m4k9q" className={({ isActive }) => cn("ox-tab", isActive && "ox-tab--on")}>
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Desk</span>
        </NavLink>
      )}
    </nav>
  );
}

export default function LaunchpadLayout() {
  const { isAdmin } = useAdmin();
  return (
    <div className="lp-classic relative min-h-screen">
      <ReferralCapture />
      <NetworkStrip />

      <header className="ox-shell-header sticky top-0 z-30">
        {/* Tier 1 — brand + actions */}
        <div className="ox-shell-top">
          <div className="ox-shell-inner">
            <Link to="/orbitxlaunch" className="ox-brand group">
              <div className="ox-brand-mark">
                <Rocket className="h-4 w-4" strokeWidth={2.8} />
              </div>
              <div className="leading-tight">
                <div className="ox-brand-name">
                  orbit<span>x</span>
                </div>
                <div className="ox-brand-sub">launchpad</div>
              </div>
            </Link>

            <div className="ox-shell-actions">
              <AntiVampProtectionBadge />
              <Link to="/orbitxlaunch/create" className="ox-create-cta">
                <Plus className="h-4 w-4" strokeWidth={3} />
                <span className="hidden sm:inline">Create coin</span>
                <span className="sm:hidden">Create</span>
              </Link>
              <EvmWalletButton />
              <WalletConsole />
            </div>
          </div>
        </div>

        {/* Tier 2 — tab rail */}
        <div className="ox-shell-tabs">
          <div className="ox-shell-inner">
            <TabRail isAdmin={!!isAdmin} />
          </div>
        </div>
      </header>

      <div className="ox-shell-main">
        <Outlet />
      </div>
    </div>
  );
}
