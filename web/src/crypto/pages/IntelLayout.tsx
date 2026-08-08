import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Briefcase,
  Radar,
  Rocket,
  Waves,
  MessageSquareText,
  Search,
} from "lucide-react";
import { PlatformThemeButton } from "@/components/theme/PlatformThemeButton";
import "../crypto.css";

const NAV = [
  { to: "/intel", end: true, label: "Command", icon: Radar },
  { to: "/intel/scan", end: false, label: "Scanner", icon: Search },
  { to: "/intel/trade", end: false, label: "Trade", icon: BarChart3 },
  { to: "/intel/portfolio", end: false, label: "Portfolio", icon: Briefcase },
  { to: "/intel/trending", end: false, label: "Trending", icon: Activity },
  { to: "/intel/whales", end: false, label: "Whales", icon: Waves },
  { to: "/intel/sentiment", end: false, label: "Sentiment", icon: MessageSquareText },
  { to: "/intel/launch", end: false, label: "Launchpad", icon: Rocket },
];

export default function IntelLayout() {
  return (
    <div className="oxc-root">
      <div className="oxc-shell">
        <nav className="oxc-nav" aria-label="Crypto intelligence">
          <div className="oxc-brand">
            OrbitX
            <span>Crypto Intelligence</span>
          </div>
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : undefined)}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
          <div style={{ marginTop: "auto", padding: "1rem 0.6rem 0.25rem", display: "grid", gap: "0.45rem" }}>
            <PlatformThemeButton compact />
            <Link to="/app" className="oxc-link" style={{ fontSize: "0.75rem" }}>
              App Hub →
            </Link>
            <a href="/ORBITX_DEX" className="oxc-link" style={{ fontSize: "0.75rem" }}>
              Full DEX →
            </a>
            <Link to="/orbitxlaunch" className="oxc-link" style={{ fontSize: "0.75rem" }}>
              Launchpad →
            </Link>
            <Link to="/agent" className="oxc-link" style={{ fontSize: "0.75rem" }}>
              Agent MCP →
            </Link>
          </div>
        </nav>
        <main className="oxc-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
