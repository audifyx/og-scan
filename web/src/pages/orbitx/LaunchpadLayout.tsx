// Orbitx Launchpad — shared shell (chrome + section nav) for all /orbitxlaunch/* routes.
// Terminal/glass aesthetic matching the OrbitX DEX design system.
import { NavLink, Outlet, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Rocket, Home, PlusCircle, Info, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/orbitxlaunch", label: "HOME", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "LAUNCH", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/profile", label: "PROFILE", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "ABOUT", icon: Info, end: false },
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

        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-4">
          {/* Brand row */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link to="/orbitxlaunch" className="group flex items-center gap-3">
              <div className="pulse-glow flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10">
                <Rocket className="h-5 w-5 text-[hsl(var(--og-gold))]" strokeWidth={2.4} />
              </div>
              <div className="leading-none">
                <div className="font-display text-xl font-bold tracking-tight text-foreground">
                  ORBITX<span className="text-glow-gold text-[hsl(var(--og-gold))]">·LAUNCH</span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  Solana launchpad // anti-vamp
                </div>
              </div>
            </Link>
            <Link
              to="/orbitxlaunch/create"
              className="hidden items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25 sm:inline-flex"
            >
              <Rocket className="h-4 w-4" /> Launch
            </Link>
          </div>

          {/* Section nav */}
          <nav className="glass-nav mb-6 flex items-center gap-1 overflow-x-auto rounded-xl p-1">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition",
                    isActive
                      ? "bg-[hsl(var(--og-gold))]/15 text-[hsl(var(--og-gold))] shadow-[inset_0_0_0_1px_hsl(var(--og-gold)/0.4)]"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )
                }
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="og-page-fade-in">
            <Outlet />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
