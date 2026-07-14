import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Search, Zap, ShoppingBag, Wallet, Star, ChevronDown, Coins, Send, Wallet2, LogOut, Flame, Users, Rocket, Bell, Code, FileText, Wrench, Megaphone, Crosshair, LayoutGrid, Feather } from "lucide-react";
import { track, getWatchlist, short } from "../lib/api";
import { useWallet } from "../lib/wallet";
import LiveStats, { fetchPlatformStats } from "./LiveStats";
import InstallPWA from "./InstallPWA";
import GlobalSearch from "./GlobalSearch";

const isAddr = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

function Brand() {
  return (
    <span className="flex items-center gap-3 shrink-0">
      <span className="w-9 h-9 rounded-xl overflow-hidden ring-brand flex-shrink-0">
        <img src="/ORBITX_DEX/ogdex-logo.png" alt="OrbitX" className="w-full h-full object-cover" width={36} height={36} style={{ filter: "grayscale(1) brightness(1.2) contrast(1.05)" }} />
      </span>
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-black text-[17px] tracking-tight" style={{ fontFamily: "'Space Grotesk', 'JetBrains Mono', sans-serif" }}>
          Orbit<span className="text-brand-gradient">X</span>
        </span>
        <span className="term" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.26em", color: "#00FFA3" }}>DEX_INTELLIGENCE</span>
      </span>
    </span>
  );
}

interface PlatformStats { activeUsers: number; telegram: number; xFollowers: number; tokenCount: number; volume: string; daysLive: number; }
const STAT_FALLBACK: PlatformStats = { activeUsers: 55, telegram: 185, xFollowers: 182, tokenCount: 847, volume: "$2.4M", daysLive: 47 };

// ── Top header wheel: all functional/app tabs (horizontal scroll) ──
const NAV_LINKS = [
  { to: "/",          label: "Home",      Icon: Coins,      exact: true  },
  { to: "/launchpad", label: "Launchpad", Icon: Rocket,     exact: false },
  { to: "/robinhood", label: "Robinhood", Icon: Feather,    exact: false },
  { to: "/pulse",     label: "Pulse",     Icon: Flame,      exact: false },
  { to: "/scanner",   label: "Scanner",   Icon: Crosshair,  exact: false },
  { to: "/tools",     label: "Tools",     Icon: Wrench,     exact: false },
  { to: "/wallet",    label: "Wallets",   Icon: Wallet2,    exact: false },
  { to: "/kol",       label: "KOL",       Icon: Users,      exact: false },
  { to: "/more",      label: "More",      Icon: LayoutGrid, exact: false },
];

// ── Quick-access set for the compact mobile bottom bar ──
const MOBILE_NAV = NAV_LINKS.filter((l) => ["/", "/pulse", "/wallet", "/kol", "/more"].includes(l.to));

// ── Footer: secondary / informational links ──
const FOOTER_PRODUCT = [
  { to: "/",            label: "Discovery" },
  { to: "/tools",       label: "Token Sniper" },
  { to: "/scanner",     label: "Scanner" },
  { to: "/pulse",       label: "Market Pulse" },
  { to: "/wallet",      label: "Portfolio" },
  { to: "/kol",         label: "KOL Scanner" },
  { to: "/store",       label: "List & Boost" },
  { to: "/alerts",      label: "Smart Alerts" },
  { to: "/callouts",    label: "Callouts" },
  { to: "/metadata",    label: "Metadata" },
  { to: "/launchpad",   label: "Launchpad" },
  { to: "/robinhood",   label: "Robinhood" },
  { to: "/more",        label: "More" },
];
const FOOTER_RESOURCES = [
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/copy-trade",  label: "Copy Tracking" },
  { to: "/whitepaper",  label: "Whitepaper" },
  { to: "/roadmap",     label: "Roadmap" },
  { to: "/api",         label: "API Docs" },
  { to: "/status",      label: "Status" },
  { to: "/terms",       label: "Terms" },
  { to: "/privacy",     label: "Privacy" },
];
// External OrbitX ecosystem products.
const FOOTER_ECOSYSTEM = [
  { href: "https://orbitx.world",            label: "OrbitX App" },
  { href: "https://ogscan.fun",              label: "OG Scanner" },
  { href: "https://solno.fun",               label: "Prediction Market" },
  { href: "https://degen-tower.vercel.app",  label: "Degen Tower" },
  { href: "https://twitter.com/i/communities/2007536315483685053", label: "X Community" },
];

export default function Layout() {
  const [watchOpen, setWatchOpen] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [pstats, setPstats] = useState<PlatformStats>(STAT_FALLBACK);
  const nav = useNavigate();
  const loc = useLocation();
  const { address, connecting, connect, disconnect } = useWallet();
  const ref = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [watchPos, setWatchPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => { track("page_view", { path: loc.pathname }); setWatch(getWatchlist()); setWatchOpen(false); }, [loc.pathname]);
  useEffect(() => { fetchPlatformStats().then(setPstats).catch(() => {}); }, []);
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem("ogdex_alerts_run") || 0);
      if (Date.now() - last > 60000) { localStorage.setItem("ogdex_alerts_run", String(Date.now())); fetch("/api/ogdex/alerts-run").catch(() => {}); }
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { const t = e.target as Node; if (ref.current && !ref.current.contains(t) && (!dropRef.current || !dropRef.current.contains(t))) setWatchOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);


  const isActive = (to: string, exact: boolean) => exact ? loc.pathname === to : loc.pathname.startsWith(to);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "#000000",
        backgroundImage:
          "radial-gradient(900px 420px at 50% -10%, rgba(0,255,163,0.06), transparent 60%)",
        backgroundAttachment: "fixed",
      }}
    >

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30">
        <div className="brand-hairline" />
        <header className="border-b header-sheen backdrop-blur-2xl" style={{ backgroundColor: "rgba(0,0,0,0.92)", borderColor: "#1C2320" }}>
          <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center gap-4">

            {/* Logo */}
            <Link to="/"><Brand /></Link>

            {/* Live stats pill */}
            <div className="hidden lg:flex items-center gap-3.5 ml-3 pl-4 border-l term text-[10px]" style={{ borderColor: "rgba(0,255,163,0.12)", color: "#5A6B88" }}>
              <span>USERS <span className="text-[#00FFA3] font-bold">{pstats.activeUsers}</span></span>
              <span>TOKENS <span className="text-white/75 font-semibold">{pstats.tokenCount}</span></span>
              <span>VOL <span className="text-[#00FFA3] font-bold">{pstats.volume}</span></span>
              <span>UP <span className="text-[#FFC53D] font-bold">{pstats.daysLive}d</span></span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search */}
            <GlobalSearch />

            {/* Watching */}
            <div className="relative" ref={ref}>
              <button
                onClick={(e) => { setWatch(getWatchlist()); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setWatchPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) }); setWatchOpen(o => !o); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#A8B3C2] hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Star className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Watching</span>
                {watch.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,255,163,0.15)", color: "#00FFA3" }}>{watch.length}</span>}
                <ChevronDown className="w-3 h-3" />
              </button>
              {watchOpen && watchPos && createPortal(
                <div ref={dropRef} style={{ position: "fixed", top: watchPos.top, right: watchPos.right, zIndex: 1000, background: "#0B0C0C", border: "1px solid rgba(0,255,163,0.18)", borderRadius: "0.75rem", width: "260px", padding: "6px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="text-[10px] uppercase tracking-widest text-[#A8B3C2] px-2 py-1.5 font-bold">Watched Wallets</div>
                  {watch.length ? watch.map((w) => (
                    <Link key={w} to={`/wallet/${w}`} onClick={() => setWatchOpen(false)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-sm font-mono text-white transition-colors">
                      <Wallet className="w-3.5 h-3.5 text-[#00FFA3]" /> {short(w)}
                    </Link>
                  )) : <div className="px-2 py-3 text-xs text-[#A8B3C2]">No watched wallets yet. Open any wallet and tap <span className="text-white font-semibold">Watch</span>.</div>}
                </div>,
                document.body
              )}
            </div>

            {/* Wallet connect */}
            {address ? (
              <button onClick={disconnect} title={address} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold font-mono transition-all" style={{ background: "rgba(0,255,163,0.1)", border: "1px solid rgba(0,255,163,0.3)", color: "#00FFA3" }}>
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{short(address)}</span>
                <LogOut className="w-3 h-3 opacity-70" />
              </button>
            ) : (
              <button onClick={connect} disabled={connecting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#000000] transition-all disabled:opacity-60" style={{ background: "linear-gradient(135deg,#00FFA3,#00C776)" }}>
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect"}</span>
              </button>
            )}

            <InstallPWA />

            {/* Store button */}
            <Link to="/store" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#000000] transition-all hover:opacity-90" style={{ background: "linear-gradient(110deg,#00FFA3,#00D1FF,#FFC53D)" }}>
              <ShoppingBag className="w-3.5 h-3.5" />
              Store
            </Link>

          </div>
        </header>

        {/* ── Nav wheel: all app tabs, horizontal scroll (every breakpoint) ── */}
        <div className="relative border-b backdrop-blur-2xl" style={{ backgroundColor: "rgba(0,0,0,0.88)", borderColor: "#1C2320" }}>
          {/* edge fades to signal scrollability */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.97), transparent)" }} />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10" style={{ background: "linear-gradient(270deg, rgba(0,0,0,0.97), transparent)" }} />
          <nav className="max-w-[1600px] mx-auto flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar">
            {NAV_LINKS.map(({ to, label, Icon, exact }) => {
              const active = isActive(to, exact);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono uppercase tracking-wider text-[11px] font-bold whitespace-nowrap shrink-0 transition-all duration-200
                    ${active
                      ? "text-white border border-term/50 shadow-glow-term"
                      : "text-[#8FA3C4] border border-transparent hover:text-white hover:border-accent/30 hover:bg-white/[0.04]"}`}
                  style={active ? { background: "linear-gradient(135deg, rgba(0,255,163,0.16), rgba(0,255,163,0.16))" } : undefined}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-term" : ""}`} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ── Terminal system-status strip ── */}
        <div className="hidden md:block border-b backdrop-blur-xl" style={{ backgroundColor: "rgba(0,0,0,0.85)", borderColor: "#1C2320" }}>
          <div className="max-w-[1600px] mx-auto px-5 h-6 flex items-center gap-4 term text-[10px]" style={{ color: "#5A6B88" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00FFA3", boxShadow: "0 0 8px #00FFA3" }} />
              <span style={{ color: "#00FFA3", letterSpacing: "0.14em" }}>SYSTEM ONLINE</span>
            </span>
            <span>NET <span className="text-white/70">SOLANA_MAINNET</span></span>
            <span className="hidden lg:inline">LATENCY <span className="text-white/70">~42ms</span></span>
            <span className="hidden lg:inline">ACTIVE <span className="text-[#00FFA3]">{pstats.activeUsers}</span></span>
            <span className="hidden xl:inline">VOL_24H <span style={{ color: "#FFC53D" }}>{pstats.volume}</span></span>
            <span className="flex-1" />
            <span className="term-prompt term-cursor" style={{ color: "#8FA3C4", letterSpacing: "0.06em" }}>orbitx@dex:~</span>
          </div>
        </div>
      </div>

      <LiveStats />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-5 min-h-[60vh]">
        <div key={loc.pathname} className="og-fade">
          <Outlet />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative mt-12 overflow-hidden" style={{ borderTop: "1px solid #1C2320", background: "#000000" }}>
        <div className="brand-hairline absolute top-0 left-0 right-0" />

        <div className="relative max-w-[1600px] mx-auto px-5 py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">

            {/* Brand block */}
            <div className="max-w-xs">
              <Brand />
              <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "#A8B3C2" }}>
                OrbitX surfaces already-public on-chain data in a higher-quality design — our tools show you what most tools hide. Built for the crypto community.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#A8B3C2" }}>
                Updated weekly — read our{" "}
                <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "#00FFA3" }}>Updates channel</a>
                {" "}for changes.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[12px]" style={{ color: "#A8B3C2" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#00FFA3" }} />
                Built &amp; designed by{" "}
                <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" className="font-bold hover:underline text-brand-gradient">@orbitx_wrld</a>
              </div>

              {/* Social buttons */}
              <div className="mt-4 flex gap-2">
                <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80" style={{ background: "rgba(0,255,163,0.1)", border: "1px solid rgba(0,255,163,0.2)", color: "#00FFA3" }}>
                  <Send className="w-3 h-3" /> Telegram
                </a>
                <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80" style={{ background: "rgba(0,209,255,0.1)", border: "1px solid rgba(0,209,255,0.2)", color: "#00D1FF" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  @orbitx_wrld
                </a>
              </div>
            </div>

            {/* Links grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 lg:gap-x-12 gap-y-6 text-sm">
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#00FFA3" }}>Product</div>
                {FOOTER_PRODUCT.map(({ to, label }) => (
                  <Link key={to} to={to} className="block text-[13px] transition-colors hover:text-[#00FFA3]" style={{ color: "#A8B3C2" }}>{label}</Link>
                ))}
              </div>
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#FFC53D" }}>Resources</div>
                {FOOTER_RESOURCES.map(({ to, label }) => (
                  <Link key={to} to={to} className="block text-[13px] transition-colors hover:text-[#FFC53D]" style={{ color: "#A8B3C2" }}>{label}</Link>
                ))}
              </div>
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#00D1FF" }}>Ecosystem</div>
                {FOOTER_ECOSYSTEM.map(({ href, label }) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer" className="block text-[13px] transition-colors hover:text-[#00D1FF]" style={{ color: "#A8B3C2" }}>{label}</a>
                ))}
              </div>
              <div className="space-y-2.5 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#00D1FF" }}>Community</div>
                <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#00FFA3]" style={{ color: "#A8B3C2" }}>
                  <Send className="w-3 h-3" /> @orbitxwrld
                </a>
                <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#00FFA3]" style={{ color: "#A8B3C2" }}>
                  <Send className="w-3 h-3" /> @OrbitXupdates
                </a>
                <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#00D1FF]" style={{ color: "#A8B3C2" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  @orbitx_wrld
                </a>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 pt-6 text-[11px] leading-relaxed" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(136,150,170,0.7)" }}>
            <p><span className="text-[#A8B3C2] font-semibold">Not financial advice.</span> OrbitX is purely a data &amp; analytics platform. Token scores, risk flags, AI summaries and signals are provided "as is" and are not investment, financial, legal or tax advice. Crypto is high-risk — do your own research. OrbitX is non-custodial and never holds your funds or keys.</p>
          </div>
          <div className="mt-4 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(136,150,170,0.55)" }}>
            <span>© {new Date().getFullYear()} OrbitX. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-[#00FFA3] transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-[#00FFA3] transition-colors">Privacy</Link>
              <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="hover:text-[#00FFA3] transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
