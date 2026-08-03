/**
 * OrbitX Trade App — mobile + desktop shell.
 * Tabs: Home · Trade · Port · More · Profile
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
  { id: "profile", to: "/trade/profile", end: false, label: "You", icon: User },
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
  if (pathname.startsWith("/trade/profile")) return "You";
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
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#050505] text-white antialiased">
      {!hideTopChrome && (
        <header className="relative z-20 flex h-12 shrink-0 items-center justify-between px-4">
          <div
            className="pointer-events-none absolute inset-0 border-b border-white/[0.06]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(5,5,5,0.92) 100%)",
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[11px] font-black tracking-tighter text-black">
              OX
            </div>
            <div className="leading-none">
              <p className="text-[13px] font-bold tracking-tight">OrbitX</p>
              <p className="mt-0.5 text-[10px] font-medium text-white/40">{title}</p>
            </div>
          </div>
          <Link
            to="/trade/notifications"
            className={`relative rounded-full p-2.5 transition-colors ${
              notifActive ? "bg-white text-black" : "bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </header>
      )}

      <main className="min-h-0 flex-1 overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 px-3"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex h-[4.1rem] max-w-lg items-stretch justify-around rounded-[1.35rem] border border-white/[0.08] bg-black/80 px-1 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          {TABS.map((tab) => {
            const { id, end, label, icon: Icon } = tab;
            const to = "dynamic" in tab && tab.dynamic ? tradeDeskTo() : tab.to;
            const active = tabActive(pathname, id);
            return (
              <NavLink
                key={id}
                to={to}
                end={end}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
              >
                {active && (
                  <span className="absolute inset-x-2 top-1.5 h-[2px] rounded-full bg-white" />
                )}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    active ? "bg-white text-black scale-105" : "text-white/35"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 1.75} />
                </span>
                <span
                  className={`text-[10px] font-semibold tracking-wide ${
                    active ? "text-white" : "text-white/30"
                  }`}
                >
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
