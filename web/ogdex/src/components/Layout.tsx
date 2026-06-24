import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Search, Zap, ShoppingBag, Wallet, Star, ChevronDown, Coins, Radio } from "lucide-react";
import { track, getWatchlist, short } from "../lib/api";
import LiveStats from "./LiveStats";

const isAddr = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

export default function Layout() {
  const [q, setQ] = useState("");
  const [watchOpen, setWatchOpen] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const nav = useNavigate();
  const loc = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { track("page_view", { path: loc.pathname }); setWatch(getWatchlist()); setWatchOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setWatchOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const addr = isAddr(q);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim(); if (!v) return;
    if (addr) nav(`/token/${v}`); else nav(`/?q=${encodeURIComponent(v)}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky wrapper: main header + mobile tab strip */}
      <div className="sticky top-0 z-30">
        <header className="border-b border-line bg-bg/90 backdrop-blur">
          <div className="max-w-[1500px] mx-auto px-4 h-10 flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 shrink-0">
              <span className="w-7 h-7 rounded-md bg-accent/15 border border-accent/30 grid place-items-center text-accent font-mono font-bold text-sm">OG</span>
              <span className="font-bold tracking-tight hidden sm:block">OG<span className="text-accent">DEX</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link to="/" className={`btn inline-flex items-center gap-1.5 ${loc.pathname === "/" ? "text-white" : "text-muted hover:text-white"}`}><Coins className="w-3.5 h-3.5" /> Discovery</Link>
              <Link to="/wallet" className={`btn inline-flex items-center gap-1.5 ${loc.pathname.startsWith("/wallet") ? "text-white" : "text-muted hover:text-white"}`}><Wallet className="w-3.5 h-3.5" /> Portfolio</Link>
              <Link to="/kol" className={`btn inline-flex items-center gap-1.5 ${loc.pathname.startsWith("/kol") ? "text-white" : "text-muted hover:text-white"}`}><Radio className="w-3.5 h-3.5" /> KOL</Link>
            </nav>

            <form onSubmit={go} className="flex-1 max-w-xl relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, ticker, mint, or wallet…"
                className="w-full bg-panel border border-line rounded-lg pl-9 pr-24 py-1.5 text-sm outline-none focus:border-accent/60" />
              {addr && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                  <button type="submit" className="px-2 py-1 rounded-md text-xs bg-accent/15 text-accent font-semibold">Token</button>
                  <button type="button" onClick={() => nav(`/wallet/${q.trim()}`)} className="px-2 py-1 rounded-md text-xs bg-panel2 text-muted hover:text-white inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet</button>
                </div>
              )}
            </form>

            {/* Watching dropdown */}
            <div className="relative" ref={ref}>
              <button onClick={() => { setWatch(getWatchlist()); setWatchOpen((o) => !o); }} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5 shrink-0">
                <Star className="w-3.5 h-3.5" /><span className="hidden sm:inline">Watching</span>{watch.length > 0 && <span className="pill bg-accent/15 text-accent text-[10px] !px-1.5 !py-0">{watch.length}</span>}<ChevronDown className="w-3 h-3" />
              </button>
              {watchOpen && (
                <div className="absolute right-0 mt-2 w-64 card p-1.5 z-40 shadow-xl">
                  <div className="text-[11px] uppercase tracking-wide text-muted px-2 py-1">Watched wallets</div>
                  {watch.length ? watch.map((w) => (
                    <Link key={w} to={`/wallet/${w}`} onClick={() => setWatchOpen(false)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-panel2 text-sm font-mono"><Wallet className="w-3.5 h-3.5 text-accent" /> {short(w)}</Link>
                  )) : <div className="px-2 py-3 text-xs text-muted">No watched wallets yet. Open any wallet and tap <span className="text-white">Watch</span>.</div>}
                </div>
              )}
            </div>

            <Link to="/store" className="btn bg-accent text-black font-semibold hover:bg-accent/90 inline-flex items-center gap-1.5 shrink-0">
              <ShoppingBag className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Store</span><span className="sm:hidden">Store</span>
            </Link>
          </div>
        </header>

        {/* Mobile tab strip — visible only on small screens */}
        <nav className="flex md:hidden bg-bg/95 backdrop-blur border-b border-line">
          <Link to="/" className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            loc.pathname === "/" ? "text-accent border-b-2 border-accent" : "text-muted"
          }`}>
            <Coins className="w-3.5 h-3.5" /> Discovery
          </Link>
          <Link to="/wallet" className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            loc.pathname.startsWith("/wallet") ? "text-accent border-b-2 border-accent" : "text-muted"
          }`}>
            <Wallet className="w-3.5 h-3.5" /> Portfolio
          </Link>
          <Link to="/kol" className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            loc.pathname.startsWith("/kol") ? "text-accent border-b-2 border-accent" : "text-muted"
          }`}>
            <Radio className="w-3.5 h-3.5" /> KOL
          </Link>
          <Link to="/store" className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            loc.pathname.startsWith("/store") || loc.pathname.startsWith("/submit") || loc.pathname.startsWith("/boost") ? "text-accent border-b-2 border-accent" : "text-muted"
          }`}>
            <ShoppingBag className="w-3.5 h-3.5" /> Store
          </Link>
        </nav>
      </div>

      {/* LiveStats moved here — scrolls with the page, not stuck at top */}
      <LiveStats />

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 py-5"><Outlet /></main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <div className="flex flex-wrap items-center justify-center gap-4 mb-2">
          <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-accent" /> Advanced & Designed by <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="text-accent hover:underline font-semibold">@ogscanbackup</a></span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/store" className="hover:text-accent">Store — List &amp; Boost</Link>
          <span>•</span>
          <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="hover:text-accent">Telegram @ogscanner</a>
          <span>•</span>
          <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer" className="hover:text-accent">Updates @ogupdates</a>
          <span>•</span>
          <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="hover:text-accent">X @ogscanbackup</a>
        </div>
        <div className="mt-2 text-[10px] text-muted/60">OG DEX • Advanced token discovery • Portfolio analytics • Multi-chain intelligence</div>
      </footer>
    </div>
  );
}
