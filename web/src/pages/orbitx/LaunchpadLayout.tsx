// OrbitX Launchpad — V3 "Mission Control" shell for all /orbitxlaunch/* routes.
// Full-bleed HUD: brand block + live Solana network readout + wallet console.
// No sidebar — section nav is a slim HUD tab strip. Scoped .lp-v3 theme
// remaps accents to phosphor green / gold for every launchpad page.
import { useEffect, useState } from "react";
import { AntiVampProtectionBadge } from "@/components/layout/AntiVampProtectionBadge";
import { NavLink, Outlet, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Flame, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft, BASE_LAUNCH_FEE_USD } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { HELIUS_RPC } from "@/lib/og";
import { shortAddr } from "./_shared";
import { useChainTelemetry, useSolUsd, fmtInt } from "./lpx";
import { WalletConsoleButton } from "./WalletConsoleButton";

const TABS = [
  { to: "/orbitxlaunch", label: "MISSION", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "DEPLOY", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/claim", label: "CLAIM FEES", icon: HandCoins, end: false, hot: true },
  { to: "/orbitxlaunch/rescue", label: "RESCUE", icon: Flame, end: false, hot: true },
  { to: "/orbitxlaunch/profile", label: "PROFILE", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "ABOUT", icon: Info, end: false },
];



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

export default function LaunchpadLayout() {
  return (
    <AppLayout>
      <div className="lp-classic relative min-h-screen">
        {/* scrolling ticker — the pump.fun signature top ribbon */}
        <NetworkStrip />

        {/* ── classic header: wordmark left, tabs center, wallet right ── */}
        <div className="sticky top-0 z-20 border-b-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg-2))]">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            {/* brand */}
            <Link to="/orbitxlaunch" className="group flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-green))]">
                <Rocket className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
              </div>
              <div className="leading-none">
                <div className="text-lg font-black tracking-tight text-[hsl(var(--pf-ink))]">
                  orbit<span className="text-[hsl(var(--pf-green))]">x</span>.fun
                </div>
              </div>
            </Link>

            {/* wallet + quick deploy */}
            <div className="ml-auto flex items-center gap-2">
              <AntiVampProtectionBadge />
              <Link to="/orbitxlaunch/create" className="pf-btn hidden md:inline-flex">
                <Zap className="h-4 w-4" /> Start a new coin
              </Link>
              <WalletConsoleButton />
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
