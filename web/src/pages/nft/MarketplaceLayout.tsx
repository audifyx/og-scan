// OrbitX NFT Marketplace — dedicated shell for all /nft/* routes.
// Magic-Eden-style chrome: brand + global search + rolling category rail +
// connect-wallet-as-login, a live-sales ticker, and a full marketplace footer.
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { NFT_CATEGORIES } from "@/lib/orbitx/nftCategories";
import { useRecentSales, shortAddr, fmtSol } from "./nftMarketData";
import {
  Search, Wallet, Sparkles, Compass, Rocket, Activity, PlusCircle, LayoutGrid,
  Bell, ChevronRight, Twitter, Send, Github, ShieldCheck,
} from "lucide-react";
import { CurrencyProvider, CurrencyToggle } from "./currency";
import "./marketplace.css";

const CATS = ["All", ...NFT_CATEGORIES];
const NAV = [
  { to: "/nft", label: "Home", icon: LayoutGrid, end: true },
  { to: "/nft/explore", label: "Explore", icon: Compass, end: false },
  { to: "/nft/drops", label: "Drops", icon: Rocket, end: false },
  { to: "/nft/activity", label: "Activity", icon: Activity, end: false },
  { to: "/nft/create", label: "Create", icon: PlusCircle, end: false },
];

/* connect-wallet == log in. The connected wallet IS the marketplace identity. */
function WalletLogin() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, wallets, select, connect, disconnect } = useWallet();
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
    return (
      <button type="button" onClick={onClick} disabled={connecting} className="mkt-btn">
        <Wallet className="h-4 w-4" /> {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => navigate("/nft/me")} className="flex items-center gap-2 rounded-xl border mkt-hairline bg-[hsl(var(--mkt-panel-2))] px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--og-lime))]" />
        <div className="leading-none text-left">
          <div className="mkt-mono text-[11px] font-bold">{shortAddr(addr)}</div>
          <div className="mkt-mono mt-0.5 text-[9px] uppercase tracking-widest mkt-muted">{sol != null ? `${sol.toFixed(2)} SOL` : "linked"}</div>
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
    <div className="mkt-marquee border-b mkt-hairline bg-[hsl(var(--mkt-panel))]/60">
      <div className="mkt-marquee-track py-2">
        {doubled.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[12px]">
            <Sparkles className="h-3 w-3 text-[hsl(var(--og-gold))]" />
            <span className="font-semibold">{s.nft?.name ?? "NFT"}</span>
            <span className="mkt-muted">sold for</span>
            <span className="mkt-mono font-bold text-[hsl(var(--og-lime))]">{fmtSol(s.amount_sol)}</span>
          </span>
        ))}
      </div>
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
    <AppLayout>
      <CurrencyProvider>
      <div className="obx-mkt">
        {/* ── header ── */}
        <header className="mkt-header sticky top-0 z-30">
          <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2.5">
            <Link to="/nft" className="flex items-center gap-2 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, hsl(var(--og-cyan)), hsl(var(--og-gold)))" }}>
                <Rocket className="h-5 w-5 text-black" strokeWidth={2.4} />
              </div>
              <div className="leading-none">
                <div className="text-[15px] font-black tracking-tight">OrbitX <span className="mkt-muted font-bold">Market</span></div>
                <div className="mkt-mono text-[9px] uppercase tracking-[0.2em] mkt-muted">NFT marketplace</div>
              </div>
            </Link>

            <form onSubmit={submitSearch} className="relative ml-2 hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 mkt-muted" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search collections, NFTs, creators…"
                className="w-full rounded-xl border mkt-hairline bg-[hsl(var(--mkt-panel-2))] py-2 pl-9 pr-3 text-sm outline-none placeholder:mkt-muted focus:border-[hsl(var(--og-cyan))]/60"
              />
            </form>

            <nav className="ml-auto hidden items-center gap-1 lg:flex">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}
                  className={({ isActive }) => `mkt-nav flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold ${isActive ? "active" : ""}`}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </NavLink>
              ))}
            </nav>

            <CurrencyToggle />
            <Link to="/nft/notifications" className="mkt-nav hidden rounded-xl p-2 sm:block" title="Notifications">
              <Bell className="h-5 w-5" />
            </Link>
            <WalletConnectButton />
          </div>

          {/* rolling category rail */}
          <div className="border-t mkt-hairline">
            <div className="mkt-rail mx-auto flex w-full max-w-[1400px] items-center gap-2 overflow-x-auto px-4 py-2">
              {CATS.map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)}
                  className={`mkt-chip px-3 py-1.5 text-[12px] font-semibold ${activeCat === c ? "active" : ""}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </header>

        <LiveSalesTicker />

        {/* mobile nav */}
        <nav className="mkt-rail flex items-center gap-1 overflow-x-auto border-b mkt-hairline px-3 py-2 lg:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `mkt-nav flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold ${isActive ? "active" : ""}`}>
              <n.icon className="h-3.5 w-3.5" /> {n.label}
            </NavLink>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6">
          <Outlet />
        </main>

        {/* ── footer ── */}
        <footer className="border-t mkt-hairline bg-[hsl(var(--mkt-panel))]/50">
          <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, hsl(var(--og-cyan)), hsl(var(--og-gold)))" }}>
                  <Rocket className="h-4 w-4 text-black" strokeWidth={2.4} />
                </div>
                <span className="text-sm font-black">OrbitX Market</span>
              </div>
              <p className="text-[12px] mkt-muted">The wallet-native NFT marketplace on Solana. Mint, trade, and earn creator fees — all in-app.</p>
              <div className="mt-3 flex items-center gap-2">
                <a href="https://twitter.com" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Twitter className="h-4 w-4" /></a>
                <a href="https://t.me" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Send className="h-4 w-4" /></a>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Github className="h-4 w-4" /></a>
              </div>
            </div>
            <FooterCol title="Marketplace" links={[["Home", "/nft"], ["Explore", "/nft/explore"], ["Drops", "/nft/drops"], ["Activity", "/nft/activity"]]} />
            <FooterCol title="Create" links={[["Mint an NFT", "/nft/create"], ["Launch a drop", "/nft/drops"], ["Creator dashboard", "/nft/me"], ["Claim fees", "/nft/me?tab=fees"]]} />
            <FooterCol title="Company" links={[["Launchpad", "/orbitxlaunch"], ["About", "/orbitxlaunch/about"], ["Terms", "/terms"], ["Privacy", "/privacy"]]} />
          </div>
          <div className="border-t mkt-hairline">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] mkt-muted sm:flex-row">
              <span>© {year} OrbitX. All rights reserved.</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" /> Verified badges · duplicate & scam detection built in</span>
            </div>
          </div>
        </footer>
      </div>
      </CurrencyProvider>
    </AppLayout>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-black uppercase tracking-widest mkt-muted">{title}</div>
      <ul className="space-y-1.5">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="group inline-flex items-center gap-1 text-[13px] hover:text-[hsl(var(--og-cyan))]">
              {label} <ChevronRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
