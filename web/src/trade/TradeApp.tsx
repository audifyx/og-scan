/**
 * OrbitX Trade App — mobile + desktop shell.
 * Tabs: Home · Trade · Port · More · You
 */

import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, CandlestickChart, Briefcase, User, Bell, LayoutGrid } from "lucide-react";
import "./trade-shell.css";

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
  if (id === "profile") {
    return pathname.startsWith("/trade/profile") || pathname.startsWith("/trade/wallets");
  }
  return false;
}

function titleFor(pathname: string): string {
  if (pathname.startsWith("/trade/desk")) return "Trade";
  if (pathname.startsWith("/trade/portfolio")) return "Portfolio";
  if (pathname.startsWith("/trade/leaderboard")) return "Leaderboard";
  if (pathname.startsWith("/trade/more")) return "More";
  if (pathname.startsWith("/trade/profile")) return "You";
  if (pathname.startsWith("/trade/wallets")) return "Wallets";
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
    <div className="tx-shell">
      {!hideTopChrome && (
        <header className="tx-header">
          <div className="tx-header__bg" />
          <div className="tx-header__brand">
            <img
              src="/favicon.png"
              alt="OrbitX"
              width={30}
              height={30}
              className="tx-header__mark"
              decoding="async"
            />
            <div>
              <p className="tx-header__name">OrbitX</p>
              <p className="tx-header__sub">{title}</p>
            </div>
          </div>
          <Link
            to="/trade/notifications"
            className={`tx-header__bell ${notifActive ? "tx-header__bell--on" : ""}`}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </header>
      )}

      <main className="tx-main">
        <Outlet />
      </main>

      <nav className="tx-dock-wrap" aria-label="Trade navigation">
        <div className="tx-dock">
          {TABS.map((tab) => {
            const { id, end, label, icon: Icon } = tab;
            const to = "dynamic" in tab && tab.dynamic ? tradeDeskTo() : tab.to;
            const active = tabActive(pathname, id);
            return (
              <NavLink
                key={id}
                to={to}
                end={end}
                className="tx-dock__item"
                aria-current={active ? "page" : undefined}
              >
                <span className={`tx-dock__icon ${active ? "tx-dock__icon--on" : ""}`}>
                  <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.4 : 1.7} />
                </span>
                <span className={`tx-dock__label ${active ? "tx-dock__label--on" : ""}`}>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
