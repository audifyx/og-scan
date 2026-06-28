import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Search, Zap, ShoppingBag, Wallet, Star, ChevronDown, Coins, Send, Wallet2, LogOut, Flame, Users, Sparkles, Rocket, Bell, Code, FileText, Wrench, Megaphone, Crosshair } from "lucide-react";
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
        <img src="/OGDEX/ogdex-logo.png" alt="OG SCAN" className="w-full h-full object-cover" width={36} height={36} />
      </span>
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-black text-[17px] tracking-tight" style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}>
          OG<span className="text-brand-gradient">SCAN</span>
        </span>
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: "#2F80FF" }}>DEX Intelligence</span>
      </span>
    </span>
  );
}

interface PlatformStats { activeUsers: number; telegram: number; xFollowers: number; tokenCount: number; volume: string; daysLive: number; }
const STAT_FALLBACK: PlatformStats = { activeUsers: 55, telegram: 185, xFollowers: 182, tokenCount: 847, volume: "$2.4M", daysLive: 47 };

// ── Top header wheel: all functional/app tabs (horizontal scroll) ──
const NAV_LINKS = [
  { to: "/",        label: "Home",      Icon: Coins,       exact: true  },
  { to: "/pulse",   label: "Pulse",     Icon: Flame,       exact: false },
  { to: "/scanner", label: "Scanner",   Icon: Crosshair,   exact: false },
  { to: "/tools",   label: "Tools",     Icon: Wrench,      exact: false },
  { to: "/new",     label: "New",       Icon: Sparkles,    exact: false },
  { to: "/wallet",  label: "Wallets",   Icon: Wallet2,     exact: false },
  { to: "/kol",     label: "KOL",       Icon: Users,       exact: false },
  { to: "/launch",  label: "Launch",    Icon: Rocket,      exact: false },
  { to: "/store",   label: "Store",     Icon: ShoppingBag, exact: false },
  { to: "/alerts",  label: "Alerts",    Icon: Bell,        exact: false },
  { to: "/callouts",label: "Callouts",  Icon: Megaphone,   exact: false },
  { to: "/metadata",label: "Metadata",  Icon: FileText,    exact: false },
  { to: "/api",     label: "API",       Icon: Code,        exact: false },
];

// ── Quick-access set for the compact mobile bottom bar ──
const MOBILE_NAV = NAV_LINKS.filter((l) => ["/", "/pulse", "/wallet", "/kol", "/store"].includes(l.to));

// ── Footer: secondary / informational links ──
const FOOTER_PRODUCT = [
  { to: "/",            label: "Discovery" },
  { to: "/wallet",      label: "Portfolio" },
  { to: "/kol",         label: "KOL Scanner" },
  { to: "/store",       label: "List & Boost" },
  { to: "/alerts",      label: "Smart Alerts" },
  { to: "/launch",      label: "Launch a Token" },
];
const FOOTER_RESOURCES = [
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/whitepaper",  label: "Whitepaper" },
  { to: "/roadmap",     label: "Roadmap" },
  { to: "/api",         label: "API Docs" },
  { to: "/terms",       label: "Terms" },
  { to: "/privacy",     label: "Privacy" },
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
        backgroundImage:
          "linear-gradient(rgba(2,4,10,0.85), rgba(2,4,10,0.93)), url(/bg/bg-aurora.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30">
        <div className="brand-hairline" />
        <header className="border-b header-sheen backdrop-blur-2xl" style={{ backgroundColor: "rgba(0,0,0,0.88)", borderColor: "rgba(47,128,255,0.15)" }}>
          <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center gap-4">

            {/* Logo */}
            <Link to="/"><Brand /></Link>

            {/* Live stats pill */}
            <div className="hidden lg:flex items-center gap-3 ml-3 pl-4 border-l" style={{ borderColor: "rgba(47,128,255,0.12)" }}>
              <span className="text-[11px] text-[#8497B8]"><span className="text-[#2F80FF] font-bold">{pstats.activeUsers}</span> users</span>
              <span className="text-[11px] text-[#8497B8]"><span className="text-white/70 font-semibold">{pstats.tokenCount}</span> tokens</span>
              <span className="text-[11px] text-[#8497B8]"><span className="text-[#2F80FF] font-bold">{pstats.volume}</span> vol</span>
              <span className="text-[11px] text-[#8497B8]"><span className="text-[#FFC53D] font-bold">{pstats.daysLive}d</span> live</span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search */}
            <GlobalSearch />

            {/* Watching */}
            <div className="relative" ref={ref}>
              <button
                onClick={(e) => { setWatch(getWatchlist()); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setWatchPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) }); setWatchOpen(o => !o); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#8497B8] hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Star className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Watching</span>
                {watch.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(47,128,255,0.15)", color: "#2F80FF" }}>{watch.length}</span>}
                <ChevronDown className="w-3 h-3" />
              </button>
              {watchOpen && watchPos && createPortal(
                <div ref={dropRef} style={{ position: "fixed", top: watchPos.top, right: watchPos.right, zIndex: 1000, background: "#0A1226", border: "1px solid rgba(47,128,255,0.18)", borderRadius: "0.75rem", width: "260px", padding: "6px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="text-[10px] uppercase tracking-widest text-[#8497B8] px-2 py-1.5 font-bold">Watched Wallets</div>
                  {watch.length ? watch.map((w) => (
                    <Link key={w} to={`/wallet/${w}`} onClick={() => setWatchOpen(false)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-sm font-mono text-white transition-colors">
                      <Wallet className="w-3.5 h-3.5 text-[#2F80FF]" /> {short(w)}
                    </Link>
                  )) : <div className="px-2 py-3 text-xs text-[#8497B8]">No watched wallets yet. Open any wallet and tap <span className="text-white font-semibold">Watch</span>.</div>}
                </div>,
                document.body
              )}
            </div>

            {/* Wallet connect */}
            {address ? (
              <button onClick={disconnect} title={address} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold font-mono transition-all" style={{ background: "rgba(47,128,255,0.1)", border: "1px solid rgba(47,128,255,0.3)", color: "#2F80FF" }}>
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{short(address)}</span>
                <LogOut className="w-3 h-3 opacity-70" />
              </button>
            ) : (
              <button onClick={connect} disabled={connecting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#000000] transition-all disabled:opacity-60" style={{ background: "linear-gradient(135deg,#2F80FF,#1657C9)" }}>
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect"}</span>
              </button>
            )}

            <InstallPWA />

            {/* Store button */}
            <Link to="/store" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#000000] transition-all hover:opacity-90" style={{ background: "linear-gradient(110deg,#2F80FF,#9945FF,#FFC53D)" }}>
              <ShoppingBag className="w-3.5 h-3.5" />
              Store
            </Link>

          </div>
        </header>

        {/* ── Nav wheel: all app tabs, horizontal scroll (every breakpoint) ── */}
        <div className="relative border-b backdrop-blur-2xl" style={{ backgroundColor: "rgba(0,0,0,0.82)", borderColor: "rgba(47,128,255,0.12)" }}>
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
                  className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-bold whitespace-nowrap shrink-0 transition-all duration-200
                    ${active
                      ? "text-white border border-accent/50 shadow-glow-blue"
                      : "text-[#8497B8] border border-transparent hover:text-white hover:border-accent/25 hover:bg-white/[0.04]"}`}
                  style={active ? { background: "linear-gradient(135deg, rgba(47,128,255,0.22), rgba(153,69,255,0.15))" } : undefined}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-accent" : ""}`} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <LiveStats />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-5">
        <div key={loc.pathname} className="og-fade">
          <Outlet />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative mt-12 overflow-hidden" style={{ borderTop: "1px solid rgba(47,128,255,0.15)" }}>
        {/* bg image */}
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.10]" style={{ backgroundImage: "url(/OGDEX/ogdex-hero.jpg)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #000000 0%, rgba(0,0,0,0.95) 60%, rgba(0,0,0,0.75) 100%)" }} />

        <div className="relative max-w-[1600px] mx-auto px-5 py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">

            {/* Brand block */}
            <div className="max-w-xs">
              <Brand />
              <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "#8497B8" }}>
                OG SCAN surfaces already-public on-chain data in a higher-quality design — our tools show you what most tools hide. Built for the crypto community.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#8497B8" }}>
                Updated weekly — read our{" "}
                <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "#2F80FF" }}>Updates channel</a>
                {" "}for changes.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[12px]" style={{ color: "#8497B8" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#2F80FF" }} />
                Built &amp; designed by{" "}
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="font-bold hover:underline text-brand-gradient">@ogscanbackup</a>
              </div>

              {/* Social buttons */}
              <div className="mt-4 flex gap-2">
                <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80" style={{ background: "rgba(47,128,255,0.1)", border: "1px solid rgba(47,128,255,0.2)", color: "#2F80FF" }}>
                  <Send className="w-3 h-3" /> Telegram
                </a>
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80" style={{ background: "rgba(153,69,255,0.1)", border: "1px solid rgba(153,69,255,0.2)", color: "#9945FF" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  @ogscanbackup
                </a>
              </div>
            </div>

            {/* Links grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 lg:gap-x-16 gap-y-3 text-sm">
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#2F80FF" }}>Product</div>
                {FOOTER_PRODUCT.map(({ to, label }) => (
                  <Link key={to} to={to} className="block text-[13px] transition-colors hover:text-[#2F80FF]" style={{ color: "#8497B8" }}>{label}</Link>
                ))}
              </div>
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#FFC53D" }}>Resources</div>
                {FOOTER_RESOURCES.map(({ to, label }) => (
                  <Link key={to} to={to} className="block text-[13px] transition-colors hover:text-[#FFC53D]" style={{ color: "#8497B8" }}>{label}</Link>
                ))}
              </div>
              <div className="space-y-2.5 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#9945FF" }}>Community</div>
                <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#2F80FF]" style={{ color: "#8497B8" }}>
                  <Send className="w-3 h-3" /> @ogscanner
                </a>
                <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#2F80FF]" style={{ color: "#8497B8" }}>
                  <Send className="w-3 h-3" /> @ogupdates
                </a>
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#9945FF]" style={{ color: "#8497B8" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  @ogscanbackup
                </a>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 pt-6 text-[11px] leading-relaxed" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(136,150,170,0.7)" }}>
            <p><span className="text-[#8497B8] font-semibold">Not financial advice.</span> OG SCAN is purely a data &amp; analytics platform. Token scores, risk flags, AI summaries and signals are provided "as is" and are not investment, financial, legal or tax advice. Crypto is high-risk — do your own research. OG SCAN is non-custodial and never holds your funds or keys.</p>
          </div>
          <div className="mt-4 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(136,150,170,0.55)" }}>
            <span>© {new Date().getFullYear()} OG SCAN. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-[#2F80FF] transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-[#2F80FF] transition-colors">Privacy</Link>
              <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="hover:text-[#2F80FF] transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
