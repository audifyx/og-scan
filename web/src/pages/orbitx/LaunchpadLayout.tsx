// OrbitX Launchpad — V3 "Mission Control" shell for all /orbitxlaunch/* routes.
// Full-bleed HUD: brand block + live Solana network readout + wallet console.
// No sidebar — section nav is a slim HUD tab strip. Scoped .lp-v3 theme
// remaps accents to phosphor green / gold for every launchpad page.
import { AntiVampProtectionBadge } from "@/components/layout/AntiVampProtectionBadge";
import { NavLink, Outlet, Link, useSearchParams } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Wallet, Flame, Zap, Trophy, Briefcase, Image as ImageIcon, ShieldCheck,
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
  { to: "/orbitxlaunch", label: "MISSION", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "DEPLOY", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/claim", label: "CLAIM FEES", icon: HandCoins, end: false, hot: true },
  { to: "/orbitxlaunch/rescue", label: "RESCUE", icon: Flame, end: false, hot: true },
  { to: "/orbitxlaunch/leaderboard", label: "LEADERBOARD", icon: Trophy, end: false },
  { to: "/orbitxlaunch/portfolio", label: "PORTFOLIO", icon: Briefcase, end: false },
  { to: "/nft", label: "NFT MARKET", icon: ImageIcon, end: false },
  { to: "/orbitxlaunch/profile", label: "PROFILE", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "ABOUT", icon: Info, end: false },
];

/* ── wallet console — shared wallet-adapter state, defaults to Phantom.
   This is the ONE global connect button for the whole launchpad; every
   other page (Claim/Rescue/Create/Pump/Profile) reads the same
   useWallet() context, so connecting here connects everywhere. ── */
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
    try {
      await connect();
    } catch {
      if (!phantom) window.open("https://phantom.app", "_blank", "noopener,noreferrer");
    }
  };

  if (!connected || !addr) {
    return (
      <button type="button" onClick={onClick} disabled={connecting} className="pf-btn">
        <Wallet className="h-4 w-4" /> {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg-2))] px-2.5 py-1.5">
      <span className="h-2 w-2 rounded-full bg-[hsl(var(--pf-green))]" />
      <div className="leading-none">
        <div className="pf-mono text-[10px] font-bold text-[hsl(var(--pf-ink))]">{shortAddr(addr)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          {sol != null ? `${sol.toFixed(3)} SOL` : "wallet linked"}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="ml-1 rounded-full border border-[hsl(var(--pf-border))] px-2 py-1 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-red))] hover:text-[hsl(var(--pf-red))]"
      >
        Disconnect
      </button>
    </div>
  );
}

/* ── Live network readout (real slot / TPS / RPC latency / SOL price) ── */
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
  // Captures ?ref=CODE on first load (any /orbitxlaunch/* page), stores it,
  // then redeems it as soon as a wallet connects. Self-referrals and repeat
  // redemptions are rejected server-side (orbitx_redeem_referral_code) — safe
  // to attempt on every connect.
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
    redeemReferralCode(wallet, pending).finally(() => {
      localStorage.removeItem("orbitx_pending_referral");
    });
  }, [publicKey]);

  return null;
}

export default function LaunchpadLayout() {
  const { isAdmin } = useAdmin();
  return (
    <AppLayout>
      <div className="lp-classic relative min-h-screen">
        <ReferralCapture />
        {/* scrolling ticker — the pump.fun signature top ribbon */}
        <NetworkStrip />

        {/* ── classic header: wordmark left, tabs center, wallet right ── */}
        <div className="obx-header sticky top-0 z-20">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            {/* brand */}
            <Link to="/orbitxlaunch" className="group flex items-center gap-2">
              <div className="obx-brand-badge flex h-9 w-9 items-center justify-center rounded-full">
                <Rocket className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
              </div>
              <div className="leading-none">
                <div className="text-lg font-black tracking-tight text-white">
                  Orbit<span className="text-[hsl(var(--pf-green))]">X</span>.world
                </div>
              </div>
            </Link>

            {/* wallet + quick deploy */}
            <div className="ml-auto flex items-center gap-2">
              <AntiVampProtectionBadge />
              <Link to="/orbitxlaunch/create" className="pf-btn hidden md:inline-flex">
                <Zap className="h-4 w-4" /> Start a new coin
              </Link>
              <WalletConsole />
            </div>
          </div>

          {/* section nav — plain pill tabs, no glow */}
          <div className="mx-auto flex w-full max-w-7xl items-center gap-0.5 overflow-x-auto border-t border-[hsl(var(--pf-border))] px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) => cn("pf-nav-link flex items-center gap-1.5 whitespace-nowrap", isActive && "active")}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/orbitxlaunch/admin"
                className={({ isActive }) => cn("pf-nav-link flex items-center gap-1.5 whitespace-nowrap", isActive && "active")}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> ADMIN
              </NavLink>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5">
          <Outlet />

          {/* ── classic footer ── */}
          <footer className="mt-12 border-t-2 border-[hsl(var(--pf-ink))] pt-4">
            <div className="grid grid-cols-1 gap-2 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))] sm:grid-cols-3">
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-gold))]" /> {isLaunchFeePromoActive() ? <>launches FREE for {launchFeePromoDaysLeft()} more days · then {fmtUsd(BASE_LAUNCH_FEE_USD)} flat</> : <>{fmtUsd(ORBITX_FEE_USD)} flat launch fee · both lanes</>}</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-green))]" /> {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade → creator</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-blue))]" /> claim in-app · same wallet that launched</div>
            </div>
          </footer>
        </div>
      </div>
    </AppLayout>
  );
}
