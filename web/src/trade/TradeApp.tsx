/**
 * OrbitX Trade App — mobile + desktop app shell with bottom tabs.
 * Tabs: Home · Trade · Leaderboard · Profile
 */

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, CandlestickChart, Trophy, User } from "lucide-react";

const TABS = [
  { to: "/trade", end: true, label: "Home", icon: Home },
  { to: "/trade/desk", end: false, label: "Trade", icon: CandlestickChart },
  { to: "/trade/leaderboard", end: false, label: "Board", icon: Trophy },
  { to: "/trade/profile", end: false, label: "Profile", icon: User },
] as const;

function tabActive(pathname: string, to: string, end?: boolean) {
  if (to === "/trade") {
    return (
      pathname === "/trade" ||
      pathname === "/trade/home" ||
      pathname.startsWith("/trade/token/")
    );
  }
  if (to === "/trade/desk") return pathname.startsWith("/trade/desk") || /^\/trade\/[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pathname);
  return end ? pathname === to : pathname.startsWith(to);
}

export default function TradeApp() {
  const { pathname } = useLocation();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#050505] px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">OrbitX</span>
          <span className="rounded border border-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/45">
            Trade
          </span>
        </div>
        <a href="/ORBITX_DEX" className="text-[11px] text-white/35 transition-colors hover:text-white">
          Full DEX →
        </a>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-[4.25rem] max-w-lg items-stretch justify-around px-2">
          {TABS.map(({ to, end, label, icon: Icon }) => {
            const active = tabActive(pathname, to, end);
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1"
              >
                <span
                  className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-white text-black" : "text-white/40"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className={`text-[10px] font-medium ${active ? "text-white" : "text-white/35"}`}>
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
