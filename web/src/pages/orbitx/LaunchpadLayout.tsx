// OrbitX Launchpad — V4 shell for all /orbitxlaunch/* routes.
// Redesigned header + segmented tab bar. Scoped .lp-classic theme (remaps
// --pf-* tokens). NFT lives at its own /nft route and is intentionally not here.
import { AntiVampProtectionBadge } from "@/components/layout/AntiVampProtectionBadge";
import { NavLink, Outlet, Link, useSearchParams } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Wallet, Flame, Trophy, Briefcase, ShieldCheck, Zap, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft, BASE_LAUNCH_FEE_USD } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { shortAddr } from "./_shared";
import { redeemReferralCode } from "@/lib/orbitx/registry";
import { useAdmin } from "@/hooks/useAdmin";
import { useChainTelemetry, useSolUsd, fmtInt } from "./lpx";
import "./orbitx-2026.css";

const TABS = [
  { to: "/orbitxlaunch", label: "Mission", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "Deploy", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/claim", label: "Claim Fees", icon: HandCoins, end: false, hot: true },
  { to: "/orbitxlaunch/rescue", label: "Rescue", icon: Flame, end: false, hot: true },
  { to: "/orbitxlaunch/leaderboard", label: "Leaderboard", icon: Trophy, end: false },
  { to: "/orbitxlaunch/portfolio", label: "Portfolio", icon: Briefcase, end: false },
  { to: "/orbitxlaunch/profile", label: "Profile", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "About", icon: Info, end: false },
];

/* ── wallet console — shared wallet-adapter state; connecting here also signs
   you in globally via WalletAuthBridge (Sign-In-With-Solana). ── */
function WalletConsole() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, wallets, select, connect, disconnect } = useWallet();
  const addr = publicKey?.toBase58();

  const { data: sol } = useQuery({
    queryKey: ["lp-header-balance", addr],
    queryFn: async () => (addr ? (await connection.getBalance(publicKey!)) / 1e9 : null),
    enabled: !!addr,
    refetchInterval: 30_000,
  });

  const onClick = async () => {
    if (connected) { await disconnect().catch(() => undefined); return; }
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) select(phantom.adapter.name);
    try { await connect(); }
    catch { if (!phantom) window.open("https://phantom.app", "_blank", "noopener,noreferrer"); }
  };

  if (!connected || !addr) {
    return (
      <button type="button" onClick={onClick} disabled={connecting}
        className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-black text-black"
        style={{ background: "linear-gradient(135deg, hsl(var(--pf-green)), hsl(var(--pf-blue)))" }}>
        <Wallet className="h-4 w-4" /> {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
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
      <button type="button" onClick={onClick}
        className="ml-1 rounded-lg border border-[hsl(var(--pf-border))] px-2 py-1 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-red))] hover:text-[hsl(var(--pf-red))]">
        Exit
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
  return (
    <AppLayout>
      <div className="lp-classic relative min-h-screen">
        <ReferralCapture />
        <NetworkStrip />

        {/* ── redesigned header ── */}
        <header className="sticky top-0 z-20 border-b border-[hsl(var(--pf-border))]/70" style={{ background: "hsl(var(--pf-bg) / 0.82)", backdropFilter: "blur(16px)" }}>
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
            {/* brand */}
            <Link to="/orbitxlaunch" className="group flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg transition group-hover:scale-105"
                style={{ background: "linear-gradient(135deg, hsl(var(--pf-green)), hsl(var(--pf-blue)))" }}>
                <Rocket className="h-5 w-5 text-black" strokeWidth={2.6} />
              </div>
              <div className="leading-tight">
                <div className="text-lg font-black tracking-tight text-[hsl(var(--pf-ink))]">
                  Orbit<span className="text-[hsl(var(--pf-green))]">X</span>
                </div>
                <div className="pf-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[hsl(var(--pf-muted))]">Launchpad</div>
              </div>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <a href="/nft" className="hidden items-center gap-1 rounded-xl border border-[hsl(var(--pf-border))] px-3 py-2 text-[12px] font-bold text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-blue))]/60 hover:text-[hsl(var(--pf-ink))] md:inline-flex">
                NFT Market <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <AntiVampProtectionBadge />
              <Link to="/orbitxlaunch/create" className="hidden items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-black text-black md:inline-flex"
                style={{ background: "linear-gradient(135deg, hsl(var(--pf-gold)), hsl(var(--pf-green)))" }}>
                <Zap className="h-4 w-4" /> Launch a coin
              </Link>
              <WalletConsole />
            </div>
          </div>

          {/* ── segmented tab bar ── */}
          <div className="mx-auto w-full max-w-7xl px-2">
            <nav className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => (
                <NavLink key={t.to} to={t.to} end={t.end}
                  className={({ isActive }) => cn(
                    "group relative flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-[12px] font-bold transition",
                    isActive ? "text-[hsl(var(--pf-ink))]" : "text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"
                  )}>
                  {({ isActive }) => (
                    <>
                      <t.icon className={cn("h-3.5 w-3.5", t.hot && "text-[hsl(var(--pf-gold))]")} />
                      {t.label}
                      <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full transition", isActive ? "opacity-100" : "opacity-0")}
                        style={{ background: "linear-gradient(90deg, hsl(var(--pf-green)), hsl(var(--pf-blue)))" }} />
                    </>
                  )}
                </NavLink>
              ))}
              {isAdmin && (
                <NavLink to="/orbitxlaunch/admin"
                  className={({ isActive }) => cn("flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-[12px] font-bold transition",
                    isActive ? "text-[hsl(var(--pf-ink))]" : "text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]")}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                </NavLink>
              )}
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5">
          <Outlet />

          {/* ── footer ── */}
          <footer className="mt-12 border-t border-[hsl(var(--pf-border))] pt-5">
            <div className="grid grid-cols-1 gap-3 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))] sm:grid-cols-4">
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-gold))]" /> {isLaunchFeePromoActive() ? <>FREE launches · {launchFeePromoDaysLeft()}d left</> : <>{fmtUsd(ORBITX_FEE_USD)} flat launch</>}</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-green))]" /> {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade → creator</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-blue))]" /> claim in-app · same wallet</div>
              <a href="/nft" className="flex items-center gap-2 hover:text-[hsl(var(--pf-ink))]"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-blue))]" /> OrbitX NFT Marketplace →</a>
            </div>
          </footer>
        </div>
      </div>
    </AppLayout>
  );
}
