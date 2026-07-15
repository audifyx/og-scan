// Orbitx Launchpad — shared shell (chrome + section nav) for all /orbitxlaunch/* routes.
import { NavLink, Outlet, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Rocket, Home, PlusCircle, Info, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/orbitxlaunch", label: "Home", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "Launch", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/profile", label: "Profile", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "About", icon: Info, end: false },
];

export default function LaunchpadLayout() {
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
        {/* Brand row */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link to="/orbitxlaunch" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--og-gold))] to-[hsl(var(--og-blood))] shadow-lg shadow-[hsl(var(--og-gold))]/20">
              <Rocket className="h-5 w-5 text-black" strokeWidth={2.4} />
            </div>
            <div className="leading-none">
              <div className="text-lg font-black tracking-tight text-foreground">Orbitx <span className="text-[hsl(var(--og-gold))]">Launchpad</span></div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Custom Solana launches · anti-vamp</div>
            </div>
          </Link>
          <Link
            to="/orbitxlaunch/create"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--og-gold))] px-4 py-2 text-sm font-bold text-black transition hover:bg-[hsl(var(--og-gold))]/90"
          >
            <Rocket className="h-4 w-4" /> Launch a token
          </Link>
        </div>

        {/* Section nav */}
        <nav className="mb-6 flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-1 backdrop-blur">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-[hsl(var(--og-gold))]/15 text-[hsl(var(--og-gold))]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )
              }
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </AppLayout>
  );
}
