// OrbitX NFT Marketplace — metal chrome shell for all /nft/* routes.
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { NFT_CATEGORIES } from "@/lib/orbitx/nftCategories";
import { useRecentSales, shortAddr, fmtSol } from "./nftMarketData";
import {
  Search, Wallet, Sparkles, Compass, Rocket, Activity, PlusCircle, LayoutGrid,
  Bell, ChevronRight, Twitter, Send, Github, ShieldCheck,
} from "lucide-react";
import { CurrencyProvider, CurrencyToggle } from "./currency";
import { PlatformThemeButton } from "@/components/theme/PlatformThemeButton";
import { PlatformLinks } from "@/components/theme/PlatformDock";
import "./marketplace.css";

const CATS = ["All", ...NFT_CATEGORIES];
const NAV = [
  { to: "/nft", label: "Home", icon: LayoutGrid, end: true },
  { to: "/nft/explore", label: "Explore", icon: Compass, end: false },
  { to: "/nft/drops", label: "Drops", icon: Rocket, end: false },
  { to: "/nft/activity", label: "Activity", icon: Activity, end: false },
  { to: "/nft/create", label: "Create", icon: PlusCircle, end: false, accent: true },
];

function WalletLogin() {
  const { connection } = useConnection();
  const { publicKey, connected, wallets, select, connect, disconnect } = useWallet();
  const addr = publicKey?.toBase58();
  const navigate = useNavigate();

  useEffect(() => {
    if (addr) localStorage.setItem("orbitx_nft_identity", addr);
  }, [addr]);

  const { data: sol } = useQuery({
    queryKey: ["nftmkt-balance", addr],
    enabled: !!addr,
    refetchInterval: 30_000,
    queryFn: async () => (addr ? (await connection.getBalance(publicKey!)) / 1e9 : null),
  });

  const onClick = async () => {
    if (connected) { await disconnect().catch(() => undefined); return; }
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) select(phantom.adapter.name);
    try { await connect(); }
    catch { if (!phantom) window.open("https://phantom.app", "_blank", "noopener,noreferrer"); }
  };

  if (!connected || !addr) {
    return <WalletConnectButton />;
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => navigate("/nft/me")} className="mkt-wallet-chip">
        <span className="mkt-wallet-dot" />
        <div className="leading-none text-left">
          <div className="mkt-mono text-[11px] font-bold text-white">{shortAddr(addr)}</div>
          <div className="mkt-mono mt-0.5 text-[9px] uppercase tracking-widest mkt-muted">
            {sol != null ? `${sol.toFixed(2)} SOL` : "linked"}
          </div>
        </div>
      </button>
      <button type="button" onClick={onClick} title="Disconnect" className="mkt-btn ghost px-2.5 py-2">
        <Wallet className="h-4 w-4" />
      </button>
    </div>
  );
}

function LiveSalesTicker() {
  const { data } = useRecentSales(16);
  const sales = data ?? [];
  if (sales.length === 0) return null;
  const doubled = [...sales, ...sales];
  return (
    <div className="mkt-marquee">
      <div className="mkt-marquee-track py-2.5">
        {doubled.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[12px]">
            <Sparkles className="h-3 w-3 text-[var(--mkt-gold-hi)]" />
            <span className="font-semibold text-white">{s.nft?.name ?? "NFT"}</span>
            <span className="mkt-muted">sold for</span>
            <span className="mkt-mono font-bold mkt-marquee-price">{fmtSol(s.amount_sol)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TabRail() {
  return (
    <div className="mkt-tabbar">
      <nav className="mkt-tab-rail" aria-label="NFT marketplace">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `mkt-tab ${isActive ? "active" : ""} ${n.accent && !isActive ? "mkt-tab--create" : ""}`
            }
          >
            <n.icon className="h-3.5 w-3.5" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function MarketplaceLayout() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const activeCat = params.get("cat") ?? "All";
  const [q, setQ] = useState(params.get("q") ?? "");

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/nft/explore?${q ? `q=${encodeURIComponent(q)}` : ""}`);
  };

  const setCat = (c: string) => {
    const next = new URLSearchParams(params);
    if (c === "All") next.delete("cat"); else next.set("cat", c);
    setParams(next);
  };

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <CurrencyProvider>
      <div className="obx-mkt">
        <header className="mkt-shell-header">
          <div className="mkt-shell-top">
            <div className="mkt-shell-inner">
              <Link to="/nft" className="mkt-brand">
                <div className="mkt-brand-mark">
                  <Rocket className="h-4 w-4" strokeWidth={2.6} />
                </div>
                <div className="leading-none">
                  <div className="mkt-brand-name">
                    Orbit<span>X</span>
                  </div>
                  <div className="mkt-brand-sub">NFT market</div>
                </div>
              </Link>

              <form onSubmit={submitSearch} className="mkt-search">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search collections, NFTs, creators…"
                />
              </form>

              <div className="mkt-shell-actions">
                <PlatformLinks />
                <PlatformThemeButton compact />
                <CurrencyToggle />
                <Link to="/nft/create" className="mkt-btn hidden sm:inline-flex">
                  <PlusCircle className="h-4 w-4" /> Create
                </Link>
                <Link to="/nft/notifications" className="mkt-nav hidden rounded-xl p-2 sm:block" title="Notifications">
                  <Bell className="h-5 w-5" />
                </Link>
                <WalletLogin />
              </div>
            </div>
          </div>

          <TabRail />

          <div className="mkt-cat-bar">
            <div className="mkt-rail mx-auto flex w-full max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-2.5">
              {CATS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`mkt-chip px-3 py-1.5 text-[11px] font-semibold ${activeCat === c ? "active" : ""}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </header>

        <LiveSalesTicker />

        <main className="mkt-main">
          <Outlet />
        </main>

        <footer className="mkt-footer">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="mb-2 flex items-center gap-2">
                <div className="mkt-brand-mark h-8 w-8 !rounded-lg">
                  <Rocket className="h-3.5 w-3.5" strokeWidth={2.6} />
                </div>
                <span className="mkt-brand-name text-[15px]">Orbit<span>X</span> Market</span>
              </div>
              <p className="text-[12px] mkt-muted leading-relaxed">
                Wallet-native NFT desk on Solana — mint, trade, and earn creator fees in-app.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Twitter className="h-4 w-4" /></a>
                <a href="https://t.me/ogscan" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Send className="h-4 w-4" /></a>
                <a href="https://github.com/audifyx/og-scan" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Github className="h-4 w-4" /></a>
              </div>
            </div>
            <FooterCol title="Marketplace" links={[["Home", "/nft"], ["Explore", "/nft/explore"], ["Drops", "/nft/drops"], ["Activity", "/nft/activity"]]} />
            <FooterCol title="Create" links={[["Mint an NFT", "/nft/create"], ["Launch a drop", "/nft/drops"], ["Creator dashboard", "/nft/me"], ["Claim fees", "/nft/me?tab=fees"]]} />
            <FooterCol title="Company" links={[["App Hub", "/app"], ["Launchpad", "/orbitxlaunch"], ["DEX", "/ORBITX_DEX"], ["Agent MCP", "/agent"], ["X MCP", "/x"], ["Social", "/orbitx-social"], ["Terms", "/terms"], ["Privacy", "/privacy"]]} />
          </div>
          <div className="border-t mkt-hairline">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] mkt-muted sm:flex-row">
              <span>© {year} OrbitX. All rights reserved.</span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 mkt-verified-icon" /> Verified badges · duplicate &amp; scam detection built in
              </span>
            </div>
          </div>
        </footer>
      </div>
    </CurrencyProvider>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-3 mkt-mono text-[10px] font-bold uppercase tracking-[0.14em] mkt-muted">{title}</div>
      <ul className="space-y-1.5">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="mkt-footer-link group inline-flex items-center gap-1 text-[13px] text-white/75">
              {label} <ChevronRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
