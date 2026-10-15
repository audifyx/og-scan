import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Wallet, Star, ChevronDown, Coins, Send, Wallet2, LogOut,
  Flame, Users, Wrench, Crosshair, LayoutGrid, Feather, ChevronRight,
} from "lucide-react";
import { getWatchlist, short } from "../lib/api";
import { useWallet } from "../lib/wallet";
import LiveStats, { fetchPlatformStats } from "./LiveStats";
import InstallPWA from "./InstallPWA";
import GlobalSearch from "./GlobalSearch";
import { SharedAtmosphere, DexThemeButton } from "./SharedAtmosphere";
import UnifiedHeader from "./UnifiedHeader";
import "../ios-app-shell.css";

function Brand() {
  return (
    <span className="flex items-center gap-3 shrink-0">
      <span className="dex-brand-mark">
        <img src="/ORBITX_DEX/ogdex-logo.png" alt="OrbitX" className="h-6 w-6 object-cover" width={24} height={24} />
      </span>
      <span className="hidden sm:flex flex-col leading-none">
        <span className="dex-brand-name">Orbit<span>X</span></span>
        <span className="dex-brand-sub">terminal</span>
      </span>
    </span>
  );
}

interface PlatformStats {
  activeUsers: number;
  tokenCount: number;
  volume: string;
  daysLive: number;
}
const STAT_FALLBACK: PlatformStats = { activeUsers: 154, tokenCount: 3, volume: "$2.4M", daysLive: 47 };

const NAV_LINKS = [
  { to: "/", label: "Home", Icon: Coins, exact: true },
  { to: "/robinhood", label: "Robinhood", Icon: Feather, exact: false },
  { to: "/pulse", label: "Pulse", Icon: Flame, exact: false },
  { to: "/scanner", label: "Scanner", Icon: Crosshair, exact: false },
  { to: "/tools", label: "Tools", Icon: Wrench, exact: false },
  { to: "/wallet", label: "Wallets", Icon: Wallet2, exact: false },
  { to: "/kol", label: "KOL", Icon: Users, exact: false },
  { to: "/more", label: "More", Icon: LayoutGrid, exact: false },
];

const MOBILE_TABS = [
  { to: "/", label: "Trade", ico: "◈", exact: true },
  { to: "/scanner", label: "Scan", ico: "◎", exact: false },
  { to: "/pulse", label: "Pulse", ico: "✦", exact: false },
  { to: "/wallet", label: "Wallet", ico: "▣", exact: false },
  { to: "/more", label: "More", ico: "☰", exact: false },
];

const ROOT_PATHS = new Set([
  "/",
  "/robinhood",
  "/pulse",
  "/scanner",
  "/tools",
  "/wallet",
  "/kol",
  "/more",
  "/store",
  "/leaderboard",
  "/api",
  "/status",
]);

const FOOTER_PRODUCT = [
  { to: "/", label: "Home" },
  { to: "/pulse", label: "Pulse" },
  { to: "/scanner", label: "Scanner" },
  { to: "/tools", label: "Tools" },
  { to: "/wallet", label: "Wallets" },
  { to: "/kol", label: "KOL" },
];
const FOOTER_RESOURCES = [
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/api", label: "API Docs" },
  { to: "/status", label: "Status" },
  { href: "/whitepaper", label: "Whitepaper" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];
const FOOTER_ECOSYSTEM = [
  { href: "/app", label: "App Hub" },
  { href: "/nft", label: "NFT Market" },
  { href: "/agent", label: "Agent MCP" },
  { href: "/x", label: "X MCP" },
  { href: "/orbitx-social", label: "Social" },
  { href: "/Orbitxcity", label: "OrbitX City" },
];

const PLATFORM_LINKS = [
  { href: "/app", label: "Hub" },
  { href: "/ORBITX_DEX/", label: "Terminal", on: true },
  { href: "/nft", label: "NFT" },
  { href: "/orbitx-social", label: "Social" },
  { href: "/agent", label: "Agent" },
  { href: "/x", label: "X" },
];

function FooterCol({ title, links, external }: { title: string; links: { to?: string; href?: string; label: string }[]; external?: boolean }) {
  return (
    <div>
      <div className="term-label mb-3" style={{ color: "var(--ox-gold-hi)" }}>{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {external && l.href ? (
              <a href={l.href} className="inline-flex items-center gap-1 text-[13px] text-white/65 hover:text-[var(--ox-gold-hi)] transition-colors">
                {l.label} <ChevronRight className="h-3 w-3 opacity-50" />
              </a>
            ) : l.href ? (
              <a href={l.href} className="inline-flex items-center gap-1 text-[13px] text-white/65 hover:text-[var(--ox-gold-hi)] transition-colors">
                {l.label} <ChevronRight className="h-3 w-3 opacity-50" />
              </a>
            ) : (
              <Link to={l.to!} className="inline-flex items-center gap-1 text-[13px] text-white/65 hover:text-[var(--ox-gold-hi)] transition-colors">
                {l.label} <ChevronRight className="h-3 w-3 opacity-50" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function titleFor(pathname: string): string {
  const hit = NAV_LINKS.find((n) => (n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(`${n.to}/`)));
  if (hit) return hit.label;
  if (pathname.startsWith("/token")) return "Token";
  if (pathname.startsWith("/wallet/")) return "Wallet";
  return "Terminal";
}

export default function Layout() {
  const [watchOpen, setWatchOpen] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [pstats, setPstats] = useState<PlatformStats>(STAT_FALLBACK);
  const loc = useLocation();
  const navigate = useNavigate();
  const { address, connecting, connect, disconnect } = useWallet();
  const ref = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [watchPos, setWatchPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => { setWatch(getWatchlist()); setWatchOpen(false); }, [loc.pathname]);
  useEffect(() => { fetchPlatformStats().then(setPstats).catch(() => {}); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && (!dropRef.current || !dropRef.current.contains(t))) setWatchOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isActive = (to: string, exact: boolean) => (exact ? loc.pathname === to : loc.pathname.startsWith(to));
  const title = useMemo(() => titleFor(loc.pathname), [loc.pathname]);
  const isRoot = ROOT_PATHS.has(loc.pathname);

  return (
    <div className="dex-shell dex-ios">
      <SharedAtmosphere />
      <div className="dex-ios-frame">
        <aside className="dex-ios-rail" aria-label="Terminal">
          <Link to="/" className="dex-ios-rail-brand">
            <Brand />
          </Link>
          {NAV_LINKS.map(({ to, label, Icon, exact }) => (
            <Link
              key={to}
              to={to}
              className={`dex-ios-rail-link ${isActive(to, exact) ? "is-on" : ""}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
          <div className="mt-auto pt-4 flex flex-col gap-1 px-1">
            {PLATFORM_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`dex-ios-rail-link ${l.on ? "is-on" : ""}`}
                style={{ fontSize: "0.78rem", minHeight: 36, padding: "0.45rem 0.65rem" }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </aside>

        <div className="dex-ios-main">
          <UnifiedHeader stats={{ activeUsers: pstats.activeUsers, tokenCount: pstats.tokenCount, volume: pstats.volume }} />

          <div className="dex-ios-desk-tabs dex-sticky-chrome">
            <div className="brand-hairline" />
            <div className="hidden md:block dex-status-strip">
              <div className="max-w-[1600px] mx-auto px-5 h-7 flex items-center gap-4 term text-[10px] font-semibold text-white/65">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ox-blue)]" style={{ boxShadow: "0 0 8px var(--ox-blue)" }} />
                  <span style={{ color: "var(--ox-blue-hi)", letterSpacing: "0.14em" }}>LIVE</span>
                </span>
                <span>SOLANA MAINNET</span>
                <span className="hidden lg:inline">USERS <span className="text-[var(--ox-blue-hi)]">{pstats.activeUsers}</span></span>
                <span className="hidden lg:inline">TOKENS <span className="text-white">{pstats.tokenCount}</span></span>
                <span className="hidden xl:inline">VOL <span className="text-[var(--ox-gold-hi)]">{pstats.volume}</span></span>
                <span className="flex-1" />
                <span className="term text-white/55" style={{ letterSpacing: "0.06em" }}>orbitx@terminal</span>
              </div>
            </div>
          </div>

          <LiveStats />

          <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-5 min-h-[60vh] dex-ios-body">
            {isRoot ? <h2 className="dex-ios-large-title md:hidden !mx-0">{title}</h2> : null}
            <div key={loc.pathname} className="og-fade">
              <Outlet />
            </div>
          </main>

          <footer className="mt-auto border-t" style={{ borderColor: "var(--ox-silver-dim)", background: "linear-gradient(180deg, #0c0c10, #060609)" }}>
            <div className="brand-hairline" />
            <div className="max-w-[1600px] mx-auto px-5 py-12">
              <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <div>
                  <Brand />
                  <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/65">
                    OrbitX Terminal — metal desk for discovery, pulse, scanner, and wallet intel on Solana.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="dex-btn dex-btn--ghost !py-2 !px-3 !text-xs">
                      <Send className="w-3 h-3" /> Telegram
                    </a>
                  </div>
                </div>
                <FooterCol title="Terminal" links={FOOTER_PRODUCT} />
                <FooterCol title="Resources" links={FOOTER_RESOURCES} />
                <FooterCol title="OrbitX" links={FOOTER_ECOSYSTEM} external />
              </div>
              <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/45 border-t" style={{ borderColor: "rgba(192,198,210,0.08)" }}>
                <span>© {new Date().getFullYear()} OrbitX Terminal</span>
                <div className="flex gap-4">
                  <a href="/whitepaper" className="hover:text-[var(--ox-gold-hi)]">Whitepaper</a>
                  <a href="/roadmap" className="hover:text-[var(--ox-gold-hi)]">Roadmap</a>
                  <a href="/terms" className="hover:text-[var(--ox-gold-hi)]">Terms</a>
                  <a href="/privacy" className="hover:text-[var(--ox-gold-hi)]">Privacy</a>
                </div>
              </div>
            </div>
          </footer>

          <nav className="dex-ios-tabbar" aria-label="App tabs">
            {MOBILE_TABS.map((t) => {
              const on = t.exact ? loc.pathname === t.to : loc.pathname === t.to || loc.pathname.startsWith(`${t.to}/`);
              return (
                <Link key={t.to} to={t.to} className={`dex-ios-tab${on ? " is-on" : ""}`}>
                  <span className="dex-ios-tab__ico" aria-hidden>{t.ico}</span>
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
