import { Link, useLocation } from "react-router-dom";
import { Search, Star, Wallet, Palette, Users, Send, Layers, BarChart3 } from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import { DexThemeButton } from "./SharedAtmosphere";
import AppSwitcher from "./AppSwitcher";
import { useWallet } from "../lib/wallet";

interface Stats {
  activeUsers: number | string;
  tokenCount: number | string;
  volume: string;
}

function fmtK(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return String(n);
  if (v >= 1000) return (v / 1000).toFixed(1) + "K";
  return String(Math.round(v));
}

const NAV = [
  { to: "/", label: "Home", exact: true },
  { to: "/pulse", label: "Pulse", exact: false },
  { to: "/tools", label: "Tools", exact: false },
  { to: "/launchpad", label: "Launch", exact: false },
  { to: "/wallet", label: "Wallet", exact: false },
];

export default function UnifiedHeader({ stats }: { stats: Stats }) {
  const loc = useLocation();
  const { address, connect, connecting } = useWallet();
  const isActive = (to: string, exact: boolean) =>
    exact ? loc.pathname === to : loc.pathname.startsWith(to);

  const metrics = [
    { icon: Users, label: "Active Users", value: "154", color: "#5aa2ff" },
    { icon: Send, label: "Telegram", value: "350", color: "#5aa2ff" },
    { icon: null, label: "X Followers", value: "660", color: "#f0c75e", isX: true },
    { icon: Layers, label: "Tokens Listed", value: typeof stats.tokenCount === "number" ? stats.tokenCount.toLocaleString() : stats.tokenCount, color: "#5aa2ff" },
    { icon: BarChart3, label: "Volume", value: stats.volume, color: "#5aa2ff" },
  ];

  return (
    <div className="unified-header">
      {/* Top bar */}
      <div className="unified-header__top">
        <Link to="/" className="unified-header__brand">
          <img src="/ORBITX_DEX/ogdex-logo.png" alt="OrbitX" className="unified-header__logo" />
          <span className="unified-header__brand-text">
            <span className="unified-header__name">Orbit<span className="unified-header__x">X</span></span>
            <span className="unified-header__tag">CRYPTO • TRADE • CONNECT</span>
          </span>
        </Link>

        <nav className="unified-header__nav">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`unified-header__navlink ${isActive(n.to, n.exact) ? "is-on" : ""}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="unified-header__search">
          <GlobalSearch />
        </div>

        <div className="unified-header__actions">
          <AppSwitcher />
          <button className="unified-header__iconbtn" title="Search">
            <Search size={18} />
          </button>
          <button className="unified-header__iconbtn unified-header__iconbtn--star" title="Watchlist">
            <Star size={18} />
            <span className="unified-header__dot" />
          </button>
          <button
            className="unified-header__iconbtn"
            title={address ? address : "Connect wallet"}
            onClick={() => { if (!address && !connecting) connect(); }}
          >
            <Wallet size={18} />
          </button>
          <DexThemeButton />
        </div>
      </div>

      {/* Stats strip */}
      <div className="unified-header__stats">
        {metrics.map((m) => (
          <div key={m.label} className="unified-header__stat">
            {m.isX ? (
              <span className="unified-header__stat-x" style={{ color: m.color }}>𝕏</span>
            ) : (
              m.icon && <m.icon size={20} style={{ color: m.color }} />
            )}
            <span className="unified-header__stat-text">
              <span className="unified-header__stat-label">{m.label}</span>
              <span className="unified-header__stat-value" style={{ color: m.color }}>{m.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
