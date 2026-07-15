// Orbitx Launchpad — shared shell (chrome + section nav) for all /orbitxlaunch/* routes.
// v2 design: live system ticker, LED status, segmented glow nav, fee ribbon.
import { NavLink, Outlet, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";

const TABS = [
  { to: "/orbitxlaunch", label: "HOME", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "LAUNCH", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/claim", label: "CLAIM FEES", icon: HandCoins, end: false, hot: true },
  { to: "/orbitxlaunch/profile", label: "PROFILE", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "ABOUT", icon: Info, end: false },
];

const TICKER = [
  "MAINNET LIVE",
  `${fmtUsd(ORBITX_FEE_USD)} FLAT LAUNCH FEE — BOTH LANES`,
  `${(CREATOR_FEE_BPS / 100).toFixed(2)}% CREATOR FEE ON EVERY BUY/SELL`,
  "CLAIM FEES IN-APP — SAME WALLET THAT LAUNCHED",
  "ANTI-VAMP // UNIQUE NAME · TICKER · CA",
  "OBX VANITY ADDRESSES",
  "PUMP + CUSTOM LANES",
];

export default function LaunchpadLayout() {
  return (
    <AppLayout>
      <div className="og-tool-shell relative min-h-screen">
        {/* backdrop grid + glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="grid-bg absolute inset-0 opacity-[0.5]" />
          <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-[hsl(var(--og-gold))]/10 blur-[100px]" />
          <div className="absolute top-40 right-10 h-64 w-64 rounded-full bg-[hsl(var(--og-cyan))]/10 blur-[100px]" />
        </div>

        {/* ── System ticker ── */}
        <div className="border-b border-white/5 bg-black/40 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--og-lime))]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--og-lime))] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--og-lime))]" />
              </span>
              LIVE
            </span>
            {TICKER.map((t, i) => (
              <span key={i} className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="text-white/15">//</span>
                <span className={i === 1 || i === 2 ? "text-[hsl(var(--og-gold))]" : undefined}>{t}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-4">
          {/* ── Brand row ── */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link to="/orbitxlaunch" className="group flex items-center gap-3">
              <div className="pulse-glow relative flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10">
                <Rocket className="h-5 w-5 text-[hsl(var(--og-gold))]" strokeWidth={2.4} />
                <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full border border-black bg-[hsl(var(--og-lime))]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/60" />
                </span>
              </div>
              <div className="leading-none">
                <div className="font-display text-xl font-bold tracking-tight text-foreground">
                  ORBITX<span className="text-glow-gold text-[hsl(var(--og-gold))]">·LAUNCH</span>
                  <span className="ml-2 rounded border border-[hsl(var(--og-cyan))]/30 bg-[hsl(var(--og-cyan))]/10 px-1.5 py-0.5 align-middle font-mono text-[9px] font-bold tracking-widest text-[hsl(var(--og-cyan))]">V2</span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  mainnet launchpad // earn every trade
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/orbitxlaunch/claim"
                className="hidden items-center gap-1.5 rounded-lg border border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-lime))] transition hover:bg-[hsl(var(--og-lime))]/20 md:inline-flex"
              >
                <HandCoins className="h-4 w-4" /> Claim
              </Link>
              <Link
                to="/orbitxlaunch/create"
                className="hidden items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25 sm:inline-flex"
              >
                <Zap className="h-4 w-4" /> Launch
              </Link>
            </div>
          </div>

          {/* ── Section nav ── */}
          <nav className="glass-nav mb-6 flex items-center gap-1 overflow-x-auto rounded-xl p-1">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition",
                    isActive
                      ? t.hot
                        ? "bg-[hsl(var(--og-lime))]/15 text-[hsl(var(--og-lime))] shadow-[inset_0_0_0_1px_hsl(var(--og-lime)/0.4)]"
                        : "bg-[hsl(var(--og-gold))]/15 text-[hsl(var(--og-gold))] shadow-[inset_0_0_0_1px_hsl(var(--og-gold)/0.4)]"
                      : t.hot
                        ? "text-[hsl(var(--og-lime))]/80 hover:bg-[hsl(var(--og-lime))]/10 hover:text-[hsl(var(--og-lime))]"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )
                }
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {t.hot && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--og-lime))]" />}
              </NavLink>
            ))}
          </nav>

          <div className="og-page-fade-in">
            <Outlet />
          </div>

          {/* ── Fee ribbon footer ── */}
          <div className="mt-10 grid grid-cols-1 gap-2 rounded-xl border border-white/8 bg-black/30 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-gold))]" /> {fmtUsd(ORBITX_FEE_USD)} flat launch fee · both lanes</div>
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-lime))]" /> {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade → creator</div>
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-cyan))]" /> claim in-app · same wallet that launched</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
