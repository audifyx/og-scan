// OrbitX NFT Marketplace — iOS mobile + desktop web-app shell
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { NFT_CATEGORIES } from "@/lib/orbitx/nftCategories";
import { useRecentSales, shortAddr, fmtSol } from "./nftMarketData";
import {
  Search, Wallet, Sparkles, Compass, Rocket, Activity, PlusCircle, LayoutGrid,
  Bell, ChevronRight, Twitter, Send, Github, ShieldCheck, User,
} from "lucide-react";
import { CurrencyProvider, CurrencyToggle } from "./currency";
import { PlatformThemeButton } from "@/components/theme/PlatformThemeButton";
import { PlatformLinks } from "@/components/theme/PlatformDock";
import {
  IosAppShell,
  IosNav,
  IosTabBar,
  IosRailBrand,
  IosRailLink,
  type IosTabItem,
} from "@/components/app-shell/IosAppShell";
import "./marketplace.css";

const CATS = ["All", ...NFT_CATEGORIES];
const NAV = [
  { to: "/nft", label: "Home", icon: LayoutGrid, end: true },
  { to: "/nft/explore", label: "Explore", icon: Compass, end: false },
  { to: "/nft/drops", label: "Drops", icon: Rocket, end: false },
  { to: "/nft/activity", label: "Activity", icon: Activity, end: false },
  { to: "/nft/create", label: "Create", icon: PlusCircle, end: false, accent: true },
  { to: "/nft/me", label: "Profile", icon: User, end: false },
];

const MOBILE_TABS: IosTabItem[] = [
  { id: "home", to: "/nft", label: "Home", ico: "⌂", end: true },
  { id: "explore", to: "/nft/explore", label: "Explore", ico: "◎" },
  { id: "drops", to: "/nft/drops", label: "Drops", ico: "✦" },
  { id: "create", to: "/nft/create", label: "Create", ico: "+" },
  { id: "me", to: "/nft/me", label: "Profile", ico: "◉" },
];

const ROOT_PATHS = new Set([
  "/nft",
  "/nft/explore",
  "/nft/drops",
  "/nft/activity",
  "/nft/create",
  "/nft/me",
  "/nft/notifications",
]);

function titleFor(pathname: string): string {
  const hit = NAV.find((n) =>
    n.end ? pathname === n.to || pathname === `${n.to}/` : pathname === n.to || pathname.startsWith(`${n.to}/`),
  );
  if (hit) return hit.label;
  if (pathname.includes("/collection")) return "Collection";
  if (pathname.includes("/item") || pathname.includes("/nft/")) return "Item";
  return "NFT";
}

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
          <div className="mkt-mono mt-0.5 text-[9px] uppercase tracking-widest mkt-dim">
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
    <div className="mkt-marquee hidden md:block">
      <div className="mkt-marquee-track py-2.5">
        {doubled.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[12px]">
            <Sparkles className="h-3 w-3 text-[var(--mkt-gold-hi)]" />
            <span className="font-semibold text-white">{s.nft?.name ?? "NFT"}</span>
            <span className="mkt-dim">sold for</span>
            <span className="mkt-mono font-bold mkt-marquee-price">{fmtSol(s.amount_sol)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MarketplaceLayout() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const activeCat = params.get("cat") ?? "All";
  const [q, setQ] = useState(params.get("q") ?? "");
  const year = useMemo(() => new Date().getFullYear(), []);
  const normalized = loc.pathname.replace(/\/$/, "") || "/nft";
  const isRoot = ROOT_PATHS.has(normalized);
  const title = titleFor(loc.pathname);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/nft/explore?${q ? `q=${encodeURIComponent(q)}` : ""}`);
  };

  const setCat = (c: string) => {
    const next = new URLSearchParams(params);
    if (c === "All") next.delete("cat"); else next.set("cat", c);
    setParams(next);
  };

  const rail = (
    <>
      <IosRailBrand href="/nft" title="OrbitX" subtitle="NFT market" />
      {NAV.map((n) => (
        <IosRailLink
          key={n.to}
          to={n.to}
          label={n.label}
          ico={<n.icon className="h-4 w-4" />}
          active={n.end ? normalized === n.to : loc.pathname.startsWith(n.to)}
        />
      ))}
      <div className="mt-auto pt-4">
        <PlatformLinks className="ox-platform-links--compact flex-col !items-stretch" />
      </div>
    </>
  );

  return (
    <CurrencyProvider>
      <IosAppShell accent="gold" wide className="obx-mkt mkt-ios">
        <div className="mkt-ios-frame">
          <aside className="mkt-ios-rail" aria-label="NFT marketplace">
            {rail}
          </aside>

          <div className="mkt-ios-main">
            <IosNav
              title={title}
              canBack={!isRoot}
              onBack={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate("/nft");
              }}
              trail={
                <>
                  <form onSubmit={submitSearch} className="mkt-search mkt-ios-search hidden md:flex">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search collections, NFTs…"
                    />
                  </form>
                  <PlatformLinks className="hidden xl:flex" />
                  <PlatformThemeButton compact />
                  <div className="mkt-currency-toggle">
                    <CurrencyToggle />
                  </div>
                  <Link to="/nft/notifications" className="ios-nav__btn hidden sm:inline-flex" title="Notifications">
                    <Bell className="h-4 w-4" />
                  </Link>
                  <WalletLogin />
                </>
              }
            />

            <div className="mkt-ios-desk-tabs">
              <nav className="mkt-tab-rail" aria-label="NFT sections">
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

            {(normalized === "/nft" || normalized === "/nft/explore") && (
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
            )}

            <LiveSalesTicker />

            <main className="mkt-main mkt-ios-body">
              {isRoot ? <h2 className="ios-large-title md:hidden px-1">{title}</h2> : null}
              <Outlet />
            </main>

            <footer className="mkt-footer hidden md:block">
              <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
                <div className="col-span-2 sm:col-span-1">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="mkt-brand-mark h-8 w-8 !rounded-lg">
                      <Rocket className="h-3.5 w-3.5" strokeWidth={2.6} />
                    </div>
                    <span className="mkt-brand-name text-[15px]">Orbit<span>X</span> Market</span>
                  </div>
                  <p className="mkt-footer-desc">
                    Wallet-native NFT desk on Solana — mint, trade, and earn creator fees in-app.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Twitter className="h-4 w-4" /></a>
                    <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Send className="h-4 w-4" /></a>
                    <a href="https://github.com/audifyx/og-scan" target="_blank" rel="noreferrer" className="mkt-nav rounded-lg p-2"><Github className="h-4 w-4" /></a>
                  </div>
                </div>
                <FooterCol title="Marketplace" links={[["Home", "/nft"], ["Explore", "/nft/explore"], ["Drops", "/nft/drops"], ["Activity", "/nft/activity"]]} />
                <FooterCol title="Create" links={[["Mint an NFT", "/nft/create"], ["Launch a drop", "/nft/drops"], ["Creator dashboard", "/nft/me"], ["Claim fees", "/nft/me?tab=fees"]]} />
                <FooterCol title="Company" links={[["App Hub", "/app"], ["Launchpad", "/orbitxlaunch"], ["DEX", "/ORBITX_DEX"], ["Agent MCP", "/agent"], ["Support", "/support"], ["Social", "/orbitx-social"], ["Terms", "/terms"], ["Privacy", "/privacy"]]} />
              </div>
              <div className="border-t mkt-hairline">
                <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] sm:flex-row">
                  <span className="mkt-dim">© {year} OrbitX. All rights reserved.</span>
                  <span className="inline-flex items-center gap-1.5 mkt-muted">
                    <ShieldCheck className="h-3.5 w-3.5 mkt-verified-icon" /> Verified badges · duplicate &amp; scam detection built in
                  </span>
                </div>
              </div>
            </footer>

            <IosTabBar tabs={MOBILE_TABS} pathname={loc.pathname} className="mkt-ios-tabbar" />
            <div className="ios-home-ind" aria-hidden />
          </div>
        </div>
      </IosAppShell>
    </CurrencyProvider>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-3 mkt-eyebrow">{title}</div>
      <ul className="space-y-1.5">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="mkt-footer-link group inline-flex items-center gap-1 text-[13px]">
              {label} <ChevronRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
