import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Search, Zap, ShoppingBag, Wallet, Star, ChevronDown, Coins, Radio, Send, Activity, Wallet2, LogOut, Trophy, Flame, Users } from "lucide-react";
import { track, getWatchlist, short } from "../lib/api";
import { useWallet } from "../lib/wallet";
import LiveStats, { fetchPlatformStats } from "./LiveStats";
import InstallPWA from "./InstallPWA";

const isAddr = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

function Brand() {
  return (
    <span className="flex items-center gap-3 shrink-0">
      <span className="w-9 h-9 rounded-xl overflow-hidden ring-brand flex-shrink-0">
        <img src="/OGDEX/ogdex-logo.png" alt="OG SCAN" className="w-full h-full object-cover" width={36} height={36} />
      </span>
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-black text-[17px] tracking-tight" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
          OG<span className="text-brand-gradient">SCAN</span>
        </span>
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: "#14F195" }}>DEX Intelligence</span>
      </span>
    </span>
  );
}

interface PlatformStats { activeUsers: number; telegram: number; xFollowers: number; tokenCount: number; volume: string; daysLive: number; }
const STAT_FALLBACK: PlatformStats = { activeUsers: 55, telegram: 185, xFollowers: 182, tokenCount: 847, volume: "$2.4M", daysLive: 47 };

const NAV_LINKS = [
  { to: "/",            label: "Discovery",   Icon: Coins,       exact: true },
  { to: "/pulse",       label: "Pulse",       Icon: Flame,       exact: false },
  { to: "/wallet",      label: "Portfolio",   Icon: Wallet2,     exact: false },
  { to: "/kol",         label: "KOL",         Icon: Users,       exact: false },
  { to: "/leaderboard", label: "Leaders",     Icon: Trophy,      exact: false },
  { to: "/store",       label: "Store",       Icon: ShoppingBag, exact: false },
];

export default function Layout() {
  const [q, setQ] = useState("");
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

  const addr = isAddr(q);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim(); if (!v) return;
    if (addr) nav(`/token/${v}`); else nav(`/?q=${encodeURIComponent(v)}`);
  };

  const isActive = (to: string, exact: boolean) => exact ? loc.pathname === to : loc.pathname.startsWith(to);

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30">
        <header className="border-b header-sheen backdrop-blur-2xl" style={{ backgroundColor: "rgba(6,8,24,0.85)", borderColor: "rgba(20,241,149,0.15)" }}>
          <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center gap-4">

            {/* Logo */}
            <Link to="/"><Brand /></Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {NAV_LINKS.map(({ to, label, Icon, exact }) => {
                const active = isActive(to, exact);
                return (
                  <Link key={to} to={to} className={`
                    relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                    ${active
                      ? "text-[#14F195] bg-[#14F195]/10"
                      : "text-[#8896aa] hover:text-white hover:bg-white/5"}
                  `}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-[#14F195]" />}
                  </Link>
                );
              })}
            </nav>

            {/* Live stats pill */}
            <div className="hidden lg:flex items-center gap-3 ml-2 pl-4 border-l" style={{ borderColor: "rgba(20,241,149,0.12)" }}>
              <span className="text-[11px] text-[#8896aa]"><span className="text-[#14F195] font-bold">{pstats.activeUsers}</span> users</span>
              <span className="text-[11px] text-[#8896aa]"><span className="text-white/70 font-semibold">{pstats.tokenCount}</span> tokens</span>
              <span className="text-[11px] text-[#8896aa]"><span className="text-[#14F195] font-bold">{pstats.volume}</span> vol</span>
              <span className="text-[11px] text-[#8896aa]"><span className="text-[#FFD700] font-bold">{pstats.daysLive}d</span> live</span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search */}
            <form onSubmit={go} className="hidden md:flex relative w-56 lg:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8896aa] pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tokens, wallets…"
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white placeholder-[#8896aa] outline-none transition-all"
                style={{
                  background: "rgba(20,241,149,0.06)",
                  border: "1.5px solid rgba(20,241,149,0.18)",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,241,149,0.6)"; e.currentTarget.style.boxShadow = "0 0 16px rgba(20,241,149,0.2)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(20,241,149,0.18)"; e.currentTarget.style.boxShadow = "none"; }}
              />
              {addr && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                  <button type="submit" className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(20,241,149,0.15)", color: "#14F195" }}>Token</button>
                  <button type="button" onClick={() => nav(`/wallet/${q.trim()}`)} className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#8896aa" }}>Wallet</button>
                </div>
              )}
            </form>

            {/* Watching */}
            <div className="relative" ref={ref}>
              <button
                onClick={(e) => { setWatch(getWatchlist()); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setWatchPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) }); setWatchOpen(o => !o); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#8896aa] hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Star className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Watching</span>
                {watch.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(20,241,149,0.15)", color: "#14F195" }}>{watch.length}</span>}
                <ChevronDown className="w-3 h-3" />
              </button>
              {watchOpen && watchPos && createPortal(
                <div ref={dropRef} style={{ position: "fixed", top: watchPos.top, right: watchPos.right, zIndex: 1000, background: "#0a0f28", border: "1px solid rgba(20,241,149,0.18)", borderRadius: "0.75rem", width: "260px", padding: "6px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="text-[10px] uppercase tracking-widest text-[#8896aa] px-2 py-1.5 font-bold">Watched Wallets</div>
                  {watch.length ? watch.map((w) => (
                    <Link key={w} to={`/wallet/${w}`} onClick={() => setWatchOpen(false)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-sm font-mono text-white transition-colors">
                      <Wallet className="w-3.5 h-3.5 text-[#14F195]" /> {short(w)}
                    </Link>
                  )) : <div className="px-2 py-3 text-xs text-[#8896aa]">No watched wallets yet. Open any wallet and tap <span className="text-white font-semibold">Watch</span>.</div>}
                </div>,
                document.body
              )}
            </div>

            {/* Wallet connect */}
            {address ? (
              <button onClick={disconnect} title={address} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold font-mono transition-all" style={{ background: "rgba(20,241,149,0.1)", border: "1px solid rgba(20,241,149,0.3)", color: "#14F195" }}>
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{short(address)}</span>
                <LogOut className="w-3 h-3 opacity-70" />
              </button>
            ) : (
              <button onClick={connect} disabled={connecting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#060818] transition-all disabled:opacity-60" style={{ background: "linear-gradient(135deg,#14F195,#0ea672)" }}>
                <Wallet2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect"}</span>
              </button>
            )}

            <InstallPWA />

            {/* Store button */}
            <Link to="/store" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#060818] transition-all hover:opacity-90" style={{ background: "linear-gradient(110deg,#9945FF,#14F195,#FFD700)" }}>
              <ShoppingBag className="w-3.5 h-3.5" />
              Store
            </Link>

          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="flex md:hidden backdrop-blur-xl border-b" style={{ backgroundColor: "rgba(6,8,24,0.95)", borderColor: "rgba(20,241,149,0.12)" }}>
          {NAV_LINKS.slice(0, 5).map(({ to, label, Icon, exact }) => {
            const active = isActive(to, exact);
            return (
              <Link key={to} to={to} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${active ? "text-[#14F195]" : "text-[#8896aa]"}`}>
                <Icon className="w-4 h-4" />
                {label}
                {active && <span className="w-4 h-[2px] rounded-full bg-[#14F195]" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <LiveStats />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-5">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="relative mt-12 overflow-hidden" style={{ borderTop: "1px solid rgba(20,241,149,0.15)" }}>
        {/* bg image */}
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.06]" style={{ backgroundImage: "url(/OGDEX/ogdex-banner.jpg)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #060818 0%, rgba(6,8,24,0.92) 60%, rgba(6,8,24,0.7) 100%)" }} />

        <div className="relative max-w-[1600px] mx-auto px-5 py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">

            {/* Brand block */}
            <div className="max-w-xs">
              <Brand />
              <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "#8896aa" }}>
                OG SCAN surfaces already-public on-chain data in a higher-quality design — our tools show you what most tools hide. Built for the crypto community.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#8896aa" }}>
                Updated weekly — read our{" "}
                <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "#14F195" }}>Updates channel</a>
                {" "}for changes.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[12px]" style={{ color: "#8896aa" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#14F195" }} />
                Built &amp; designed by{" "}
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="font-bold hover:underline text-brand-gradient">@ogscanbackup</a>
              </div>

              {/* Social buttons */}
              <div className="mt-4 flex gap-2">
                <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80" style={{ background: "rgba(20,241,149,0.1)", border: "1px solid rgba(20,241,149,0.2)", color: "#14F195" }}>
                  <Send className="w-3 h-3" /> Telegram
                </a>
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80" style={{ background: "rgba(153,69,255,0.1)", border: "1px solid rgba(153,69,255,0.2)", color: "#9945FF" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  @ogscanbackup
                </a>
              </div>
            </div>

            {/* Links grid */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#14F195" }}>Product</div>
                {[
                  { to: "/", label: "Discovery" },
                  { to: "/wallet", label: "Portfolio" },
                  { to: "/kol", label: "KOL Scanner" },
                  { to: "/leaderboard", label: "Leaderboard" },
                  { to: "/store", label: "List & Boost" },
                  { to: "/alerts", label: "Smart Alerts" },
                  { to: "/roadmap", label: "Roadmap" },
                ].map(({ to, label }) => (
                  <Link key={to} to={to} className="block text-[13px] transition-colors hover:text-[#14F195]" style={{ color: "#8896aa" }}>{label}</Link>
                ))}
              </div>
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#9945FF" }}>Community</div>
                <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#14F195]" style={{ color: "#8896aa" }}>
                  <Send className="w-3 h-3" /> @ogscanner
                </a>
                <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#14F195]" style={{ color: "#8896aa" }}>
                  <Send className="w-3 h-3" /> @ogupdates
                </a>
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] transition-colors hover:text-[#9945FF]" style={{ color: "#8896aa" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  @ogscanbackup
                </a>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 pt-6 text-[11px] leading-relaxed" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(136,150,170,0.7)" }}>
            <p><span className="text-[#8896aa] font-semibold">Not financial advice.</span> OG SCAN is purely a data &amp; analytics platform. Token scores, risk flags, AI summaries and signals are provided "as is" and are not investment, financial, legal or tax advice. Crypto is high-risk — do your own research. OG SCAN is non-custodial and never holds your funds or keys.</p>
          </div>
          <div className="mt-4 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(136,150,170,0.55)" }}>
            <span>© {new Date().getFullYear()} OG SCAN. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-[#14F195] transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-[#14F195] transition-colors">Privacy</Link>
              <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="hover:text-[#14F195] transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
