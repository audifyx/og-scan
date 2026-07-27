// OrbitX Launchpad — V4 shell for all /orbitxlaunch/* routes.
// Redesigned header + segmented tab bar. Scoped .lp-classic theme (remaps
// --pf-* tokens). NFT lives at its own /nft route and is intentionally not here.
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
  Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Wallet, Flame, Trophy, Briefcase, ShieldCheck, Zap, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { shortAddr } from "./_shared";
import { redeemReferralCode } from "@/lib/orbitx/registry";
import { useAdmin } from "@/hooks/useAdmin";
import { useChainTelemetry, useSolUsd, fmtInt } from "./lpx";
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

/* ── wallet console — shared wallet-adapter state; connecting here also signs
   you in globally via WalletAuthBridge (Sign-In-With-Solana). ── */
function WalletConsole() {
  const { connection } = useConnection();
  const { publicKey, connected, disconnect } = useWallet();
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
    try { await signInWith(name); setPicker(false); toast.success("Signed in with wallet"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Sign-in failed"); }
  };

  if (!connected || !addr) {
    return (
      <>
        <button type="button" onClick={() => setPicker(true)}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-black text-black"
          style={{ background: "linear-gradient(135deg, hsl(var(--pf-green)), hsl(var(--pf-blue)))" }}>
          <Wallet className="h-4 w-4" /> Connect Wallet
        </button>
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      </>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))] px-2.5 py-1.5">
      <span className="h-2 w-2 rounded-full bg-[hsl(var(--pf-green))]" style={{ boxShadow: "0 0 8px hsl(var(--pf-green))" }} />
      <div className="leading-none">
        <div className="pf-mono text-[11px] font-bold text-[hsl(var(--pf-ink))]">{shortAddr(addr)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          {sol != null ? `${sol.toFixed(3)} SOL` : "wallet linked"}
        </div>
      </div>
      <button type="button" onClick={() => disconnect().catch(() => undefined)}
        className="ml-1 rounded-lg border border-[hsl(var(--pf-border))] px-2 py-1 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-red))] hover:text-[hsl(var(--pf-red))]">
        Exit
      </button>
    </div>
  );
}

/* ── EVM wallet link — secondary wallet used for EVM/curve flows ── */
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
      <button type="button" onClick={openConnect}
        className="hidden items-center gap-1.5 rounded-xl border border-[hsl(var(--pf-border))] px-3 py-2 text-[12px] font-bold text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-blue))]/60 hover:text-[hsl(var(--pf-ink))] md:inline-flex">
        <Link2 className="h-3.5 w-3.5" /> Link EVM
      </button>
    );
  }
  return (
    <div className="hidden items-center gap-2 rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))] px-2.5 py-1.5 md:flex">
      <span className="h-2 w-2 rounded-full" style={{ background: "#627EEA", boxShadow: "0 0 8px #627EEA" }} />
      <div className="leading-none">
        <div className="pf-mono text-[11px] font-bold text-[hsl(var(--pf-ink))]">{shortAddr(shown)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">EVM {account ? "linked" : "saved"}</div>
      </div>
      <button type="button" onClick={disconnect}
        className="ml-1 rounded-lg border border-[hsl(var(--pf-border))] px-2 py-1 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-red))] hover:text-[hsl(var(--pf-red))]">
        Unlink
      </button>
    </div>
  );
}

/* ── Live network readout ── */
function NetworkStrip() {
  const tel = useChainTelemetry();
  const solUsd = useSolUsd();
  const ok = tel.data?.ok ?? false;
  return (
    <div className="pf-ticker">
      <div className="pf-ticker-track">
        {Array.from({ length: 2 }).map((_, dup) => (
          <span key={dup} className="inline-flex items-center gap-6 pf-mono text-[11px] uppercase tracking-wide">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[hsl(var(--pf-green))]" : "bg-[hsl(var(--pf-red))]"}`} />
              Solana mainnet {ok ? "live" : "degraded"}
            </span>
            <span>slot {fmtInt(tel.data?.slot)}</span>
            <span>{fmtInt(tel.data?.tps)} tps</span>
            <span>rpc {tel.data?.latencyMs != null ? `${tel.data.latencyMs}ms` : "—"}</span>
            <span>sol ${solUsd.data ? solUsd.data.price.toFixed(2) : "—"}</span>
            {isLaunchFeePromoActive() ? (
              <span className="font-bold">★ FREE launches — {launchFeePromoDaysLeft()}d left · {(CREATOR_FEE_BPS / 100).toFixed(2)}% creator fee</span>
            ) : (
              <span>{fmtUsd(ORBITX_FEE_USD)} flat launch · {(CREATOR_FEE_BPS / 100).toFixed(2)}% creator fee</span>
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

export default function LaunchpadLayout() {
  const { isAdmin } = useAdmin();
  // Standalone launchpad shell — no AppLayout / SocialTopBar / galaxy chrome.
  // Full-bleed like pump.fun so the board is the entire page.
  return (
    <div className="lp-classic relative min-h-screen">
      <ReferralCapture />
      <NetworkStrip />

      <header className="sticky top-0 z-30 border-b border-[hsl(var(--pf-border))]/70" style={{ background: "hsl(var(--pf-bg) / 0.92)", backdropFilter: "blur(16px)" }}>
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-3 py-2.5 sm:px-4">
          <Link to="/orbitxlaunch" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg transition group-hover:scale-105"
              style={{ background: "linear-gradient(135deg, hsl(var(--pf-green)), hsl(152 90% 42%))" }}>
              <Rocket className="h-4 w-4 text-black" strokeWidth={2.6} />
            </div>
            <div className="leading-tight">
              <div className="text-base font-black tracking-tight text-[hsl(var(--pf-ink))]">
                orbit<span className="text-[hsl(var(--pf-green))]">x</span>
                <span className="text-[hsl(var(--pf-muted))]">.fun</span>
              </div>
              <div className="pf-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--pf-muted))]">coin board</div>
            </div>
          </Link>

          <nav className="ml-2 hidden items-center gap-0.5 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
                  isActive ? "bg-[hsl(var(--pf-green))]/15 text-[hsl(var(--pf-green))]" : "text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"
                )}>
                <t.icon className={cn("h-3.5 w-3.5", t.hot && "text-[hsl(var(--pf-gold))]")} />
                {t.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/orbitxlaunch/ox-desk-m4k9q"
                className={({ isActive }) => cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
                  isActive ? "bg-[hsl(var(--pf-green))]/15 text-[hsl(var(--pf-green))]" : "text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Desk
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <AntiVampProtectionBadge />
            <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-black text-black shadow-[0_0_24px_hsl(152_86%_52%/0.35)]"
              style={{ background: "hsl(var(--pf-green))" }}>
              <Zap className="h-4 w-4" /> Create coin
            </Link>
            <EvmWalletButton />
            <WalletConsole />
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="mx-auto w-full max-w-[1440px] px-2 pb-1 md:hidden">
          <nav className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition",
                  isActive ? "bg-[hsl(var(--pf-green))] text-black" : "text-[hsl(var(--pf-muted))]"
                )}>
                <t.icon className="h-3 w-3" />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-2 pb-10 pt-3 sm:px-3">
        <Outlet />
      </div>
    </div>
  );
}
