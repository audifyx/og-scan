/**
 * OrbitX Trade App — mobile + desktop shell.
 * Tabs: Home · Trade · Port · More · Profile (+ header notifications)
 */

import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, CandlestickChart, Briefcase, User, Bell, LayoutGrid } from "lucide-react";

const LAST_MINT_KEY = "orbitx.trade.lastMint";

function tradeDeskTo(): string {
  try {
    const m = sessionStorage.getItem(LAST_MINT_KEY);
    if (m && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)) return `/trade/desk/${m}`;
  } catch {
    /* ignore */
  }
  return "/trade/desk";
}

const TABS = [
  { id: "home", to: "/trade", end: true, label: "Home", icon: Home },
  { id: "trade", to: "/trade/desk", end: false, label: "Trade", icon: CandlestickChart, dynamic: true },
  { id: "port", to: "/trade/portfolio", end: false, label: "Port", icon: Briefcase },
  { id: "more", to: "/trade/more", end: false, label: "More", icon: LayoutGrid },
  { id: "profile", to: "/trade/profile", end: false, label: "Profile", icon: User },
] as const;

function tabActive(pathname: string, id: string) {
  if (id === "home") {
    return (
      pathname === "/trade" ||
      pathname === "/trade/home" ||
      pathname.startsWith("/trade/token/") ||
      pathname.startsWith("/trade/notifications")
    );
  }
  if (id === "trade") return pathname.startsWith("/trade/desk");
  if (id === "port") {
    return (
      pathname.startsWith("/trade/portfolio") ||
      pathname.startsWith("/trade/wallet/") ||
      pathname.startsWith("/trade/leaderboard")
    );
  }
  if (id === "more") return pathname.startsWith("/trade/more");
  if (id === "profile") return pathname.startsWith("/trade/profile");
  return false;
}

function titleFor(pathname: string): string {
  if (pathname.startsWith("/trade/desk")) return "Trade";
  if (pathname.startsWith("/trade/portfolio")) return "Portfolio";
  if (pathname.startsWith("/trade/leaderboard")) return "Leaderboard";
  if (pathname.startsWith("/trade/more")) return "More";
  if (pathname.startsWith("/trade/profile")) return "Profile";
  if (pathname.startsWith("/trade/token/")) return "Coin";
  if (pathname.startsWith("/trade/wallet/")) return "Wallet";
  if (pathname.startsWith("/trade/notifications")) return "Alerts";
  return "Markets";
}

export default function TradeApp() {
  const { pathname } = useLocation();
  const title = titleFor(pathname);
  const hideTopChrome = pathname.startsWith("/trade/desk");
  const notifActive = pathname.startsWith("/trade/notifications");

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-white">
      {!hideTopChrome && (
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-black/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-bold tracking-tight">OrbitX</span>
            <span className="h-3 w-px bg-white/15" />
            <span className="text-[12px] font-medium text-white/45">{title}</span>
          </div>
          <Link
            to="/trade/notifications"
            className={`rounded-full p-2 transition-colors ${
              notifActive ? "bg-white text-black" : "text-white/45 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </header>
      )}

      <main className="min-h-0 flex-1 overflow-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-[4.25rem] max-w-lg items-stretch justify-around px-1">
          {TABS.map((tab) => {
            const { id, end, label, icon: Icon } = tab;
            const to = "dynamic" in tab && tab.dynamic ? tradeDeskTo() : tab.to;
            const active = tabActive(pathname, id);
            return (
              <NavLink
                key={id}
                to={to}
                end={end}
                className="flex min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5"
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
