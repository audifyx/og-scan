import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Search, Zap, ShoppingBag, Wallet, Star, ChevronDown, Coins, Radio, Send } from "lucide-react";
import { track, getWatchlist, short } from "../lib/api";
import LiveStats from "./LiveStats";

const isAddr = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  return (
    <span className="flex items-center gap-2 shrink-0">
      <span className={`${dim} rounded-lg overflow-hidden ring-brand`}>
        <img src="/OGDEX/ogdex-logo.png" alt="OG DEX" className="w-full h-full object-cover" width={32} height={32} />
      </span>
      <span className="font-extrabold tracking-tight text-[15px] hidden sm:block">
        OG<span className="text-brand-gradient">DEX</span>
      </span>
    </span>
  );
}

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

  const navItem = (to: string, active: boolean, Icon: any, label: string) => (
    <Link to={to} className={`btn inline-flex items-center gap-1.5 ${active ? "text-white bg-white/5" : "text-muted hover:text-white"}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky wrapper: main header + mobile tab strip */}
      <div className="sticky top-0 z-30">
        <header className="border-b border-white/10 bg-bg/80 backdrop-blur-xl header-sheen">
          <div className="max-w-[1500px] mx-auto px-4 py-2 md:py-0 md:h-12 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2">
            <Link to="/" className="flex items-center"><Brand /></Link>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              {navItem("/", loc.pathname === "/", Coins, "Discovery")}
              {navItem("/wallet", loc.pathname.startsWith("/wallet"), Wallet, "Portfolio")}
              {navItem("/kol", loc.pathname.startsWith("/kol"), Radio, "KOL")}
            </nav>

            <form onSubmit={go} className="order-last w-full md:order-none md:flex-1 md:max-w-xl relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, ticker, mint, or wallet…"
                className="w-full bg-panel/70 border border-white/10 rounded-lg pl-9 pr-24 py-2 text-sm outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition" />
              {addr && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                  <button type="submit" className="px-2 py-1 rounded-md text-xs bg-accent/15 text-accent font-semibold">Token</button>
                  <button type="button" onClick={() => nav(`/wallet/${q.trim()}`)} className="px-2 py-1 rounded-md text-xs bg-panel2 text-muted hover:text-white inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet</button>
                </div>
              )}
            </form>

            {/* Watching dropdown */}
            <div className="relative ml-auto md:ml-0" ref={ref}>
              <button onClick={() => { setWatch(getWatchlist()); setWatchOpen((o) => !o); }} className="btn bg-white/5 border border-white/10 text-muted hover:text-white inline-flex items-center gap-1.5 shrink-0">
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

            <Link to="/store" className="btn brand-gradient text-black font-bold hover:opacity-90 inline-flex items-center gap-1.5 shrink-0 shadow-lg shadow-accent/20">
              <ShoppingBag className="w-3.5 h-3.5" /> <span>Store</span>
            </Link>
          </div>
        </header>

        {/* Mobile tab strip — visible only on small screens */}
        <nav className="flex md:hidden bg-bg/95 backdrop-blur border-b border-white/10">
          {[
            { to: "/", active: loc.pathname === "/", Icon: Coins, label: "Discovery" },
            { to: "/wallet", active: loc.pathname.startsWith("/wallet"), Icon: Wallet, label: "Portfolio" },
            { to: "/kol", active: loc.pathname.startsWith("/kol"), Icon: Radio, label: "KOL" },
            { to: "/store", active: loc.pathname.startsWith("/store") || loc.pathname.startsWith("/submit") || loc.pathname.startsWith("/boost"), Icon: ShoppingBag, label: "Store" },
          ].map((t) => (
            <Link key={t.to} to={t.to} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              t.active ? "text-accent border-b-2 border-accent" : "text-muted"
            }`}>
              <t.Icon className="w-3.5 h-3.5" /> {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* LiveStats — scrolls with the page */}
      <LiveStats />

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 py-5"><Outlet /></main>

      <footer className="relative mt-8 border-t border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.07]" style={{ backgroundImage: "url(/OGDEX/ogdex-banner.jpg)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/70" />
        <div className="relative max-w-[1500px] mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="max-w-sm">
              <Brand />
              <p className="mt-3 text-xs text-muted leading-relaxed">
                Advanced Solana token discovery, real-time OG Score, organic momentum and instant safety checks. Portfolio analytics and multi-chain intelligence.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
                <Zap className="w-3 h-3 text-accent" /> Advanced &amp; Designed by{" "}
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="text-brand-gradient font-bold hover:underline">@ogscanbackup</a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-muted/70">Product</div>
                <Link to="/" className="block text-muted hover:text-accent">Discovery</Link>
                <Link to="/wallet" className="block text-muted hover:text-accent">Portfolio</Link>
                <Link to="/kol" className="block text-muted hover:text-accent">KOL Scanner</Link>
                <Link to="/store" className="block text-muted hover:text-accent">Store — List &amp; Boost</Link>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-muted/70">Community</div>
                <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted hover:text-accent"><Send className="w-3 h-3" /> Telegram @ogscanner</a>
                <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted hover:text-accent"><Send className="w-3 h-3" /> Updates @ogupdates</a>
                <a href="https://x.com/ogscanbackup" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted hover:text-accent"><svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X @ogscanbackup</a>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted/60">
            <span>© {new Date().getFullYear()} OG DEX. All rights reserved.</span>
            <span>OG DEX • Advanced token discovery • Portfolio analytics • Multi-chain intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
