import { Outlet, Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  ShoppingBag, Wallet, Star, ChevronDown, Coins, Send, Wallet2, LogOut,
  Flame, Users, Rocket, Wrench, Crosshair, LayoutGrid, Feather, ChevronRight,
} from "lucide-react";
import { getWatchlist, short } from "../lib/api";
import { useWallet } from "../lib/wallet";
import LiveStats, { fetchPlatformStats } from "./LiveStats";
import InstallPWA from "./InstallPWA";
import GlobalSearch from "./GlobalSearch";
import { SharedAtmosphere, DexThemeButton } from "./SharedAtmosphere";

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
const STAT_FALLBACK: PlatformStats = { activeUsers: 55, tokenCount: 847, volume: "$2.4M", daysLive: 47 };

const NAV_LINKS = [
  { to: "/", label: "Home", Icon: Coins, exact: true },
  { to: "/launchpad", label: "Launchpad", Icon: Rocket, exact: false },
  { to: "/robinhood", label: "Robinhood", Icon: Feather, exact: false },
  { to: "/pulse", label: "Pulse", Icon: Flame, exact: false },
  { to: "/scanner", label: "Scanner", Icon: Crosshair, exact: false },
  { to: "/tools", label: "Tools", Icon: Wrench, exact: false },
  { to: "/wallet", label: "Wallets", Icon: Wallet2, exact: false },
  { to: "/kol", label: "KOL", Icon: Users, exact: false },
  { to: "/more", label: "More", Icon: LayoutGrid, exact: false },
];

const FOOTER_PRODUCT = [
  { to: "/", label: "Home" },
  { to: "/pulse", label: "Pulse" },
  { to: "/scanner", label: "Scanner" },
  { to: "/tools", label: "Tools" },
  { to: "/wallet", label: "Wallets" },
  { to: "/kol", label: "KOL" },
  { to: "/launchpad", label: "Launchpad" },
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
  { href: "/orbitxlaunch", label: "OrbitX Launchpad" },
  { href: "/nft", label: "NFT Market" },
  { href: "/agent", label: "Agent MCP" },
  { href: "/x", label: "X MCP" },
  { href: "/orbitx-social", label: "Social" },
  { href: "/Orbitxcity", label: "OrbitX City" },
];

const PLATFORM_DOCK = [
  { href: "/app", label: "Hub", ico: "⌂" },
  { href: "/ORBITX_DEX/", label: "DEX", ico: "◈", on: true },
  { href: "/orbitxlaunch", label: "Launch", ico: "🚀" },
  { href: "/nft", label: "NFT", ico: "🖼" },
  { href: "/orbitx-social", label: "Social", ico: "◉" },
  { href: "/agent", label: "Agent", ico: "✦" },
  { href: "/x", label: "X", ico: "✕" },
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

export default function Layout() {
  const [watchOpen, setWatchOpen] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [pstats, setPstats] = useState<PlatformStats>(STAT_FALLBACK);
  const loc = useLocation();
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

  return (
    <div className="dex-shell">
      <SharedAtmosphere />
      <div className="dex-sticky-chrome">
        <div className="brand-hairline" />
        <header className="dex-shell-header">
          <div className="max-w-[1600px] mx-auto px-4 md:px-5 h-14 flex items-center gap-4">
            <Link to="/"><Brand /></Link>

            <div className="hidden lg:flex items-center gap-3.5 ml-2 pl-4 border-l term text-[10px] font-semibold" style={{ borderColor: "var(--ox-silver-dim)", color: "var(--ox-text-dim)" }}>
              <span>USERS <span className="text-[var(--ox-blue-hi)] font-bold">{pstats.activeUsers}</span></span>
              <span>TOKENS <span className="text-white font-semibold">{pstats.tokenCount}</span></span>
              <span>VOL <span className="text-[var(--ox-gold-hi)] font-bold">{pstats.volume}</span></span>
            </div>

            <div className="flex-1" />
            <GlobalSearch />

            <div className="relative" ref={ref}>
              <button
                type="button"
                onClick={(e) => {
                  setWatch(getWatchlist());
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setWatchPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
                  setWatchOpen((o) => !o);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--ox-silver-dim)" }}
              >
                <Star className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Watch</span>
                {watch.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(59,130,246,0.15)", color: "var(--ox-blue-hi)" }}>
                    {watch.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              {watchOpen && watchPos && createPortal(
                <div
                  ref={dropRef}
                  style={{
                    position: "fixed", top: watchPos.top, right: watchPos.right, zIndex: 1000,
                    background: "#0e0e0e", border: "1px solid var(--ox-silver-dim)", borderRadius: 14,
                    width: 260, padding: 6, boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                  }}
                >
                  <div className="term-label px-2 py-1.5">Watched wallets</div>
                  {watch.length ? watch.map((w) => (
                    <Link key={w} to={`/wallet/${w}`} onClick={() => setWatchOpen(false)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-sm font-mono text-white">
                      <Wallet className="w-3.5 h-3.5 text-[var(--ox-blue-hi)]" /> {short(w)}
                    </Link>
                  )) : (
                    <div className="px-2 py-3 text-xs text-white/55">No watched wallets yet.</div>
                  )}
                </div>,
                document.body,
              )}
            </div>

            {address ? (
              <button type="button" onClick={disconnect} title={address} className="dex-wallet-chip">
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{short(address)}</span>
                <LogOut className="w-3 h-3 opacity-70" />
              </button>
            ) : (
              <button type="button" onClick={connect} disabled={connecting} className="dex-wallet-btn disabled:opacity-60">
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect"}</span>
              </button>
            )}

            <DexThemeButton />
            <InstallPWA />
            <a href="/app" className="dex-store-btn hidden sm:inline-flex !no-underline">
              Hub
            </a>
            <Link to="/store" className="dex-store-btn hidden sm:inline-flex">
              <ShoppingBag className="w-3.5 h-3.5" /> Store
            </Link>
          </div>
        </header>

        <div className="dex-shell-header py-2">
          <div className="max-w-[1600px] mx-auto px-3 md:px-5">
            <nav className="dex-tab-segment-wrap no-scrollbar" aria-label="Terminal">
              {NAV_LINKS.map(({ to, label, Icon, exact }) => (
                <Link key={to} to={to} className={`dex-tab-segment ${isActive(to, exact) ? "dex-tab-segment--on" : ""}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="hidden md:block dex-status-strip">
          <div className="max-w-[1600px] mx-auto px-5 h-7 flex items-center gap-4 term text-[10px] font-semibold text-white/65">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ox-blue)]" style={{ boxShadow: "0 0 8px var(--ox-blue)" }} />
              <span style={{ color: "var(--ox-blue-hi)", letterSpacing: "0.14em" }}>LIVE</span>
            </span>
            <span>SOLANA MAINNET</span>
            <span className="hidden lg:inline">TOKENS <span className="text-white">{pstats.tokenCount}</span></span>
            <span className="hidden xl:inline">VOL <span className="text-[var(--ox-gold-hi)]">{pstats.volume}</span></span>
            <span className="flex-1" />
            <span className="term text-white/55" style={{ letterSpacing: "0.06em" }}>orbitx@terminal</span>
          </div>
        </div>
      </div>

      <LiveStats />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-5 min-h-[60vh]">
        <div key={loc.pathname} className="og-fade">
          <Outlet />
        </div>
      </main>

      <footer className="mt-auto border-t" style={{ borderColor: "var(--ox-silver-dim)", background: "linear-gradient(180deg, #080808, #050505)" }}>
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

      <nav className="dex-platform-dock" aria-label="OrbitX platforms">
        {PLATFORM_DOCK.map((l) => (
          <a key={l.href} href={l.href} className={l.on ? "is-on" : undefined}>
            <span aria-hidden>{l.ico}</span>
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
