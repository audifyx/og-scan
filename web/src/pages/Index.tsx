import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  ChevronRight,
  Coins,
  Compass,
  Cpu,
  Crown,
  Crosshair,
  Flame,
  Gauge,
  Globe,
  Home,
  Layers3,
  LayoutGrid,
  LineChart,
  Map,
  Menu,
  MessageSquare,
  Radar,
  Radio,
  Rocket,
  Rss,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  User,
  Wallet,
  Webhook,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { OgStats } from "@/components/OgStats";
import { Scanner } from "@/components/Scanner";
import { Trending } from "@/components/Trending";
import { OgFinder } from "@/components/OgFinder";
import { PairTracker } from "@/components/PairTracker";
import { Migrations } from "@/components/Migrations";
import { TxFeed } from "@/components/TxFeed";
import { Whales } from "@/components/Whales";
import { SwapPanel } from "@/components/SwapPanel";
import { TechStack } from "@/components/TechStack";
import { OurCoin } from "@/components/OurCoin";
import { SnipeFeed } from "@/components/SnipeFeed";
import { Feed } from "@/components/Feed";
import { NewsSignal } from "@/components/NewsSignal";
import { SolToolsRoadmap } from "@/components/SolToolsRoadmap";
import CommunitiesPage from "./Communities";
import DiscoverPage from "./Discover";
import { cn } from "@/lib/utils";
import { DEFAULT_OG_MINT, OGSCAN_DEV_WALLET, OGSCAN_TOKEN_MINT, SOL_MINT, STORAGE_OG_MINT, shortAddr } from "@/lib/og";
import { AuthButton } from "@/components/AuthButton";

const LEGACY_DEFAULT_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const STORAGE_TAB = "og_scanner.active_site_tab";

type TabId =
  | "overview"
  | "our-coin"
  | "roadmap"
  | "market-pulse"
  | "snipe-feed"
  | "feed"
  | "scanner"
  | "og-finder"
  | "pairs"
  | "migrations"
  | "trending"
  | "whales"
  | "tx-feed"
  | "swap"
  | "tech"
  | "news-signal"
  | "communities"
  | "discover";

type TabAccent = "blue" | "white" | "cyan" | "gold" | "lime";
type TabGroup = "Main" | "Forensics" | "Market" | "Project";

type TabConfig = {
  id: TabId;
  label: string;
  slug: string;
  pageNumber: number;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
  group: TabGroup;
  showInNav?: boolean;
  mergedInto?: TabId;
};

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Home",
    slug: "command",
    pageNumber: 1,
    eyebrow: "Dashboard",
    description: "Launch scanner, OG finder, snipe feed, and every standalone tool from one command hub.",
    Icon: Home,
    accent: "blue",
    group: "Main",
  },
  {
    id: "scanner",
    label: "Truth Scan",
    slug: "scanner",
    pageNumber: 6,
    eyebrow: "Forensics",
    description: "Scanner + OG Finder for mint checks, origin proof, dominance status, LP risk, and holders.",
    Icon: Search,
    accent: "lime",
    group: "Forensics",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    slug: "og-finder",
    pageNumber: 7,
    eyebrow: "Origin Check",
    description: "First-mint proof, lineage, and dominance context for any Solana token.",
    Icon: Crosshair,
    accent: "white",
    group: "Forensics",
    showInNav: false,
    mergedInto: "scanner",
  },
  {
    id: "snipe-feed",
    label: "Launch Radar",
    slug: "snipe-feed",
    pageNumber: 5,
    eyebrow: "Live Launches",
    description: "New coins, repeat creators, watch alerts, migration timing, and launch quality scores.",
    Icon: Target,
    accent: "cyan",
    group: "Forensics",
  },
  {
    id: "migrations",
    label: "Migrations",
    slug: "migrations",
    pageNumber: 9,
    eyebrow: "Pump.fun → DEX",
    description: "Migration timing module for Pump.fun breakout and DEX arrival tracking.",
    Icon: Rocket,
    accent: "gold",
    group: "Forensics",
    showInNav: false,
    mergedInto: "snipe-feed",
  },
  {
    id: "feed",
    label: "Market Feed",
    slug: "feed",
    pageNumber: 15,
    eyebrow: "Live Market",
    description: "Trending coins, pair discovery, whale context, bundle status, boosts, and CTO analytics.",
    Icon: Rss,
    accent: "lime",
    group: "Market",
  },
  {
    id: "market-pulse",
    label: "Market Pulse",
    slug: "market-pulse",
    pageNumber: 4,
    eyebrow: "Token Vitals",
    description: "Fast price, liquidity, holders, and market cap for any active mint.",
    Icon: Activity,
    accent: "blue",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "pairs",
    label: "Pairs",
    slug: "pairs",
    pageNumber: 8,
    eyebrow: "New Pair Radar",
    description: "New pool, liquidity, and routing intelligence across Solana DEXes.",
    Icon: Radar,
    accent: "cyan",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "trending",
    label: "Trending",
    slug: "trending",
    pageNumber: 10,
    eyebrow: "Market Heat",
    description: "Live token momentum and catalyst discovery.",
    Icon: Flame,
    accent: "cyan",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "whales",
    label: "Whales",
    slug: "whales",
    pageNumber: 11,
    eyebrow: "Wallet Radar",
    description: "Holder concentration and whale structure for the selected mint.",
    Icon: Wallet,
    accent: "white",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "tx-feed",
    label: "Tx Feed",
    slug: "tx-feed",
    pageNumber: 12,
    eyebrow: "Live Transactions",
    description: "Live buy/sell tape for the currently selected token.",
    Icon: Activity,
    accent: "cyan",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "swap",
    label: "Swap",
    slug: "swap",
    pageNumber: 13,
    eyebrow: "Jupiter Route",
    description: "Search coins and quote routes while keeping scanner context on-screen.",
    Icon: Zap,
    accent: "blue",
    group: "Market",
  },
  {
    id: "our-coin",
    label: "Our Token",
    slug: "our-coin",
    pageNumber: 2,
    eyebrow: "Official Token",
    description: "Official OGScan coin CA, dev wallet, chart links, and copy buttons in one verified room.",
    Icon: Coins,
    accent: "gold",
    group: "Project",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    slug: "roadmap",
    pageNumber: 3,
    eyebrow: "Vision",
    description: "The path from OGScan into the crypto-native community layer SolTools is building.",
    Icon: Map,
    accent: "cyan",
    group: "Project",
  },
  {
    id: "tech",
    label: "Tech Stack",
    slug: "tech",
    pageNumber: 14,
    eyebrow: "Data Pipeline",
    description: "The systems powering OG attribution, candles, live tape, and token forensics.",
    Icon: Cpu,
    accent: "white",
    group: "Project",
  },
  {
    id: "news-signal",
    label: "News Signal",
    slug: "news-signal",
    pageNumber: 16,
    eyebrow: "Influencer Intel",
    description: "Elon, Trump, White House & more — find the coins before the market reacts.",
    Icon: Radio,
    accent: "lime",
    group: "Market",
  },
  {
    id: "communities",
    label: "Communities",
    slug: "communities",
    pageNumber: 17,
    eyebrow: "Social Hub",
    description: "Join crypto communities, share alpha, post calls, and chat with fellow traders.",
    Icon: Users,
    accent: "cyan",
    group: "Main",
  },
  {
    id: "discover",
    label: "Discover",
    slug: "discover",
    pageNumber: 18,
    eyebrow: "Trending & Traders",
    description: "Trending tokens, top trader leaderboard, whale watch, and live social activity.",
    Icon: Compass,
    accent: "gold",
    group: "Main",
  },
];

const NAV_TABS: TabConfig[] = TABS.filter((t: TabConfig) => t.showInNav !== false);

const TAB_BY_ID: Record<TabId, TabConfig> = TABS.reduce(
  (acc: Record<TabId, TabConfig>, t: TabConfig): Record<TabId, TabConfig> => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<TabId, TabConfig>,
);

const ROUTE_ALIASES: Record<string, TabId> = TABS.reduce(
  (acc: Record<string, TabId>, t: TabConfig): Record<string, TabId> => {
    acc[t.slug] = t.id;
    acc[t.id] = t.id;
    acc[`page-${t.pageNumber}`] = t.id;
    acc[`page${t.pageNumber}`] = t.id;
    return acc;
  },
  {
    app: "overview",
    home: "overview",
    market: "feed",
    "market-command": "feed",
    "live-feed": "feed",
    feed: "feed",
    tape: "tx-feed",
    transactions: "tx-feed",
    "transaction-feed": "tx-feed",
    "og-scanner": "scanner",
    "ogscan-scanner": "scanner",
    "dev-wallet": "snipe-feed",
    "dev-wallet-radar": "snipe-feed",
    "migration-tool": "migrations",
    "migration-tracker": "migrations",
  },
);

const getTabFromSlug = (slug: string | undefined): TabId | null => {
  const s: string = decodeURIComponent(slug ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  if (!s) return "overview";
  return ROUTE_ALIASES[s] ?? null;
};

const getTabPath = (id: TabId): string => {
  if (id === "overview") return "/app";
  return `/${TAB_BY_ID[id].slug}`;
};

const renderTool = (tab: TabId, mint: string, updateMint: (m: string) => void): ReactNode => {
  if (tab === "our-coin") return <OurCoin />;
  if (tab === "roadmap") return <SolToolsRoadmap />;
  if (tab === "market-pulse") return <OgStats mint={mint} onSelect={updateMint} />;
  if (tab === "snipe-feed") return <LaunchRadarSuite onSelect={updateMint} />;
  if (tab === "feed") return <MarketFeedSuite mint={mint} onSelect={updateMint} />;
  if (tab === "scanner") return <TruthScanSuite onSelect={updateMint} />;
  if (tab === "og-finder") return <OgFinder onSelect={updateMint} />;
  if (tab === "pairs") return <PairTracker onSelect={updateMint} />;
  if (tab === "migrations") return <Migrations onSelect={updateMint} />;
  if (tab === "trending") return <Trending onSelect={updateMint} />;
  if (tab === "whales") return <Whales mint={mint} />;
  if (tab === "tx-feed") return <TxFeed mint={mint} />;
  if (tab === "swap") return <SwapPanel ogMint={mint} onSelectMint={updateMint} />;
  if (tab === "tech") return <TechStack />;
  if (tab === "news-signal") return <NewsSignal onSelect={updateMint} />;
  if (tab === "communities") return <CommunitiesInline />;
  if (tab === "discover") return <DiscoverInline />;
  return null;
};

/* ─── accent helpers ─── */
const accentText = (a: TabAccent): string =>
  a === "gold" ? "text-og-gold" : a === "cyan" ? "text-og-cyan" : a === "white" ? "text-white" : "text-og-lime";

const accentIcon = (a: TabAccent): string =>
  a === "gold"
    ? "border-og-gold/40 bg-og-gold/10 text-og-gold"
    : a === "cyan"
      ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan"
      : a === "white"
        ? "border-white/20 bg-white/8 text-white"
        : "border-og-lime/40 bg-og-lime/10 text-og-lime";

const accentDot = (a: TabAccent): string =>
  a === "gold" ? "bg-og-gold" : a === "cyan" ? "bg-og-cyan" : a === "white" ? "bg-white" : "bg-og-lime";

/* ─── Main Index component ─── */
const Index = () => {
  const { toolSlug, pageNumber } = useParams<{ toolSlug?: string; pageNumber?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const pathSlug: string = location.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
  const routeSlug: string | undefined = pageNumber ? `page-${pageNumber}` : toolSlug ?? pathSlug;
  const routeTab: TabId = useMemo<TabId>(() => getTabFromSlug(routeSlug) ?? "overview", [routeSlug]);
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [tab, setTab] = useState<TabId>(routeTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_OG_MINT);
      if (saved && saved !== LEGACY_DEFAULT_MINT && saved !== SOL_MINT) setMint(saved);
      else { setMint(DEFAULT_OG_MINT); localStorage.setItem(STORAGE_OG_MINT, DEFAULT_OG_MINT); }
    } catch { /* noop */ }
  }, []);

  useEffect(() => { setTab(routeTab); }, [routeTab]);

  useEffect(() => {
    if (routeSlug && !getTabFromSlug(routeSlug)) navigate("/app", { replace: true });
  }, [navigate, routeSlug]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [location.pathname, tab]);

  const activeTab = useMemo<TabConfig>(() => TABS.find((t) => t.id === tab) ?? TABS[0], [tab]);

  const switchTab = (next: string): void => {
    const safe: TabId = TABS.some((t) => t.id === next) ? (next as TabId) : "overview";
    setTab(safe);
    setSidebarOpen(false);
    try { localStorage.setItem(STORAGE_TAB, safe); } catch { /* noop */ }
    navigate(getTabPath(safe));
  };

  const updateMint = (next: string): void => {
    setMint(next);
    try { localStorage.setItem(STORAGE_OG_MINT, next); } catch { /* noop */ }
  };

  const promptMint = (): void => {
    const next = window.prompt("Paste any Solana mint address:", mint);
    if (next && next.trim().length > 20) { updateMint(next.trim()); switchTab("scanner"); }
  };

  return (
    <div className="st-workspace flex min-h-screen bg-[#070d14] text-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AppSidebar
        activeId={tab}
        mint={mint}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onChangeMint={promptMint}
        onNavigate={switchTab}
      />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[260px]">
        {/* Top bar */}
        <AppTopBar
          tab={activeTab}
          mint={mint}
          onOpenSidebar={() => setSidebarOpen(true)}
          onChangeMint={promptMint}
        />

        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-x-hidden px-3 pb-28 pt-4 sm:px-5 lg:px-6 lg:pb-8">
          {tab === "overview" ? (
            <OverviewPage
              mint={mint}
              onSwitchTab={(t: TabId) => switchTab(t)}
              onScanClick={() => switchTab("scanner")}
              onChangeMint={promptMint}
            />
          ) : (
            <ToolShell tab={activeTab}>{renderTool(tab, mint, updateMint)}</ToolShell>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav activeId={tab} onNavigate={switchTab} />
    </div>
  );
};

/* ─── External nav link (navigates to a proper route, not a tab) ─── */
type ExternalNavItem = {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  eyebrow: string;
};

const ExternalNavLink = ({ item, currentPath, onClose }: { item: ExternalNavItem; currentPath: string; onClose: () => void }) => {
  const isActive = currentPath === item.to || currentPath.startsWith(item.to + "/");
  return (
    <Link
      to={item.to}
      onClick={onClose}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
        isActive ? "bg-white/[0.09] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
      )}
    >
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
        isActive ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan" : "border-white/10 bg-white/[0.04]",
      )}>
        <item.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
        <span className="block truncate text-[10px] text-white/35">{item.eyebrow}</span>
      </span>
      {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-og-cyan" />}
    </Link>
  );
};

/* ─── Sidebar ─── */
const AppSidebar = ({
  activeId,
  mint,
  open,
  onClose,
  onChangeMint,
  onNavigate,
}: {
  activeId: TabId;
  mint: string;
  open: boolean;
  onClose: () => void;
  onChangeMint: () => void;
  onNavigate: (t: string) => void;
}) => {
  const location = useLocation();
  const groups: { key: TabGroup; label: string }[] = [
    { key: "Forensics", label: "Forensics" },
    { key: "Market", label: "Market" },
    { key: "Project", label: "Project" },
  ];

  const solToolsItems: ExternalNavItem[] = [
    { to: "/wallets",        icon: Wallet,       label: "Wallets",         eyebrow: "Tracked wallets" },
    { to: "/tokens",         icon: Coins,        label: "Tokens",          eyebrow: "Token tracker" },
    { to: "/charts",         icon: LineChart,    label: "Charts",          eyebrow: "Live charts" },
    { to: "/alpha-chat",     icon: Bot,          label: "Alpha Chat",      eyebrow: "AI assistant" },
    { to: "/live-trading",   icon: TrendingUp,   label: "Live Trading",    eyebrow: "P&L · Signals" },
    { to: "/callouts",       icon: Bell,         label: "Callouts",        eyebrow: "Trade alerts" },
    { to: "/trading-lobbies",icon: MessageSquare,label: "Trading Lobbies", eyebrow: "Voice + charts" },
    { to: "/leaderboard",    icon: Trophy,       label: "Leaderboard",     eyebrow: "Top traders" },
    { to: "/advanced-tools", icon: Wrench,       label: "Advanced Tools",  eyebrow: "30+ pro tools" },
    { to: "/pumpv5",         icon: Rocket,       label: "Launch Pad",      eyebrow: "Token listings" },
    { to: "/webhooks",       icon: Webhook,      label: "Webhooks",        eyebrow: "Push alerts" },
    { to: "/notifications",  icon: Bell,         label: "Notifications",   eyebrow: "Your alerts" },
    { to: "/premium",        icon: Crown,        label: "Premium",         eyebrow: "Pro · AI · P&L" },
  ];

  const accountItems: ExternalNavItem[] = [
    { to: "/profile",        icon: User,         label: "Profile",         eyebrow: "Your account" },
    { to: "/settings",       icon: Settings,     label: "Settings",        eyebrow: "Preferences" },
    { to: "/credits",        icon: Coins,        label: "Credits",         eyebrow: "Balance" },
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[0.07] bg-[#060c13] transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
        <button type="button" onClick={() => onNavigate("overview")} className="flex items-center gap-3 text-left">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-og-lime/50 bg-og-lime/10">
            <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
            <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime))]" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-white">OGScan</div>
            <div className="text-[10px] font-semibold tracking-widest text-og-cyan/80">PRO TRADING SUITE</div>
          </div>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "none" }}>
        {/* Main group */}
        <div className="mb-1">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Main</p>
          <NavItem item={TAB_BY_ID.overview} activeId={activeId} onNavigate={onNavigate} />
          <NavItem item={TAB_BY_ID.communities} activeId={activeId} onNavigate={onNavigate} />
          <NavItem item={TAB_BY_ID.discover} activeId={activeId} onNavigate={onNavigate} />
        </div>

        {groups.map(({ key, label }) => {
          const items = NAV_TABS.filter((t) => t.group === key);
          if (!items.length) return null;
          return (
            <div key={key} className="mb-1 mt-4">
              <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">{label}</p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItem key={item.id} item={item} activeId={activeId} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          );
        })}

        {/* SolTools Features */}
        <div className="mb-1 mt-4">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">SolTools Features</p>
          <div className="space-y-0.5">
            {solToolsItems.map((item) => (
              <ExternalNavLink key={item.to} item={item} currentPath={location.pathname} onClose={onClose} />
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="mb-4 mt-4">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Account</p>
          <div className="space-y-0.5">
            {accountItems.map((item) => (
              <ExternalNavLink key={item.to} item={item} currentPath={location.pathname} onClose={onClose} />
            ))}
          </div>
        </div>
      </nav>

      {/* Active mint */}
      <div className="border-t border-white/[0.07] px-3 py-2">
        <button
          type="button"
          onClick={onChangeMint}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-og-cyan/40 hover:bg-white/[0.07]"
        >
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Active mint</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-white/80">{shortAddr(mint, 6)}</div>
          </div>
          <Menu className="h-3.5 w-3.5 text-white/30" />
        </button>
      </div>

      {/* Pro features callout */}
      <div className="border-t border-white/[0.07] px-3 pb-4 pt-3">
        <Link
          to="/premium"
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl border border-og-lime/25 bg-og-lime/8 px-3 py-3 transition hover:border-og-lime/40 hover:bg-og-lime/12"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-og-lime/40 bg-og-lime/15">
            <Sparkles className="h-4 w-4 text-og-lime" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-wide text-white">Pro Features</div>
            <div className="text-[10px] text-white/50">AI · Alerts · P&L</div>
          </div>
          <div className="h-4 w-4 shrink-0">
            <div className="h-2 w-2 rounded-full bg-og-lime shadow-[0_0_8px_hsl(var(--og-lime))]" />
          </div>
        </Link>
      </div>

      {/* Token CA */}
      <div className="border-t border-white/[0.07] px-3 pb-4 pt-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Official Token</div>
        <div className="mt-1 font-mono text-[10px] text-white/50">
          CA {shortAddr(OGSCAN_TOKEN_MINT, 5)} · Dev {shortAddr(OGSCAN_DEV_WALLET, 5)}
        </div>
      </div>
    </aside>
  );
};

const NavItem = ({
  item,
  activeId,
  onNavigate,
}: {
  item: TabConfig;
  activeId: TabId;
  onNavigate: (t: string) => void;
}) => {
  const isActive = activeId === item.id || TAB_BY_ID[activeId]?.mergedInto === item.id;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
        isActive
          ? "bg-white/[0.09] text-white"
          : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
          isActive ? accentIcon(item.accent) : "border-white/10 bg-white/[0.04]",
        )}
      >
        <item.Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
        <span className="block truncate text-[10px] text-white/35">{item.eyebrow}</span>
      </span>
      {isActive && (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accentDot(item.accent))} />
      )}
    </button>
  );
};

/* ─── Top bar ─── */
const AppTopBar = ({
  tab,
  mint,
  onOpenSidebar,
  onChangeMint,
}: {
  tab: TabConfig;
  mint: string;
  onOpenSidebar: () => void;
  onChangeMint: () => void;
}) => (
  <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.07] bg-[#060c13]/90 px-4 py-3 backdrop-blur-xl sm:px-5 lg:px-6">
    {/* Mobile menu button */}
    <button
      type="button"
      onClick={onOpenSidebar}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white lg:hidden"
    >
      <Menu className="h-4 w-4" />
    </button>

    {/* Title */}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <div className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]", accentDot(tab.accent))} />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">{tab.eyebrow}</span>
      </div>
      <h1 className="truncate text-lg font-black leading-tight tracking-tight text-white sm:text-xl">{tab.label}</h1>
    </div>

    {/* Right controls */}
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onChangeMint}
        className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:border-og-cyan/40 hover:text-white sm:flex"
      >
        <Layers3 className="h-3.5 w-3.5" />
        {shortAddr(mint, 4)}
      </button>
      <AuthButton />
      <div className="flex items-center gap-1.5 rounded-xl border border-og-lime/25 bg-og-lime/10 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime))]" />
        <span className="text-[11px] font-bold text-og-lime">Live</span>
      </div>
    </div>
  </header>
);

/* ─── Mobile bottom nav ─── */
const MobileNav = ({ activeId, onNavigate }: { activeId: TabId; onNavigate: (t: string) => void }) => {
  const items = [
    { id: "overview" as TabId, label: "Home", Icon: Home },
    { id: "scanner" as TabId, label: "Scan", Icon: Search },
    { id: "snipe-feed" as TabId, label: "Radar", Icon: Target },
    { id: "communities" as TabId, label: "Social", Icon: Users },
    { id: "discover" as TabId, label: "Discover", Icon: Compass },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.07] bg-[#060c13]/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden">
      <div className="flex items-stretch justify-around px-1 pb-2 pt-1.5">
        {items.map((item) => {
          const isActive = activeId === item.id || TAB_BY_ID[activeId]?.mergedInto === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition",
                isActive ? "text-og-lime" : "text-white/35",
              )}
            >
              <item.Icon className={cn("h-5 w-5", isActive ? "text-og-lime" : "")} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/* ─── Overview / Dashboard ─── */
const OverviewPage = ({
  mint,
  onSwitchTab,
  onScanClick,
  onChangeMint,
}: {
  mint: string;
  onSwitchTab: (t: TabId) => void;
  onScanClick: () => void;
  onChangeMint: () => void;
}) => {
  const statsCards = [
    { label: "Watching", value: "3", Icon: Search, accent: "cyan" as TabAccent },
    { label: "Favorites", value: "0", Icon: Star, accent: "gold" as TabAccent },
    { label: "Gainers", value: "8", Icon: TrendingUp, accent: "lime" as TabAccent },
    { label: "Trending", value: "15", Icon: Flame, accent: "cyan" as TabAccent },
  ];

  const quickTools: TabConfig[] = [
    TAB_BY_ID.scanner,
    TAB_BY_ID["snipe-feed"],
    TAB_BY_ID.feed,
    TAB_BY_ID.swap,
    TAB_BY_ID["market-pulse"],
    TAB_BY_ID.trending,
  ];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statsCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.05]"
          >
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", accentIcon(card.accent))}>
              <card.Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-black leading-none text-white">{card.value}</div>
              <div className="mt-0.5 text-[11px] text-white/45">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.055] to-white/[0.02] px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-og-lime/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-8 h-48 w-48 rounded-full bg-og-cyan/6 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-og-lime/30 bg-og-lime/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-og-lime">
            <ShieldCheck className="h-3 w-3" /> Forensic Tools Live
          </div>
          <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Solana Token<br />Truth Engine
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/55">
            Run mint forensics, prove first origin, score dominance, inspect holder and LP risk, track migrations, watch dev wallets, and monitor live runners.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onScanClick}
              className="inline-flex items-center gap-2 rounded-xl border border-og-lime bg-og-lime px-5 py-2.5 text-sm font-black text-[#060c13] shadow-[0_0_28px_-10px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.98]"
            >
              Open Scanner <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab("snipe-feed")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white/80 transition hover:border-og-cyan/40 hover:text-white active:scale-[0.98]"
            >
              Launch Radar <Target className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onChangeMint}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/50 transition hover:text-white/80 active:scale-[0.98]"
            >
              Mint: {shortAddr(mint, 4)}
            </button>
          </div>
        </div>
      </div>

      {/* Quick tools grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-og-cyan">Quick Access</p>
            <h3 className="text-lg font-black text-white">Most Used Tools</h3>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab("scanner")}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/50 transition hover:text-white"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickTools.map((tool) => (
            <QuickToolCard key={tool.id} tool={tool} onClick={() => onSwitchTab(tool.id)} />
          ))}
        </div>
      </div>

      {/* All tools list */}
      <div>
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">All Tools</p>
        </div>
        <div className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {NAV_TABS.filter((t) => t.id !== "overview").map((tool) => (
            <AllToolRow key={tool.id} tool={tool} onClick={() => onSwitchTab(tool.id)} />
          ))}
        </div>
      </div>
    </div>
  );
};

const QuickToolCard = ({ tool, onClick }: { tool: TabConfig; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05] active:scale-[0.99]"
  >
    <div className="flex items-start justify-between gap-3">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", accentIcon(tool.accent))}>
        <tool.Icon className="h-5 w-5" />
      </div>
      <ArrowUpRight className={cn("h-4 w-4 opacity-0 transition group-hover:opacity-100", accentText(tool.accent))} />
    </div>
    <div>
      <div className={cn("mb-0.5 text-[9px] font-bold uppercase tracking-widest", accentText(tool.accent))}>{tool.eyebrow}</div>
      <div className="text-[15px] font-black text-white">{tool.label}</div>
      <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-white/45">{tool.description}</p>
    </div>
  </button>
);

const AllToolRow = ({ tool, onClick }: { tool: TabConfig; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.035]"
  >
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", accentIcon(tool.accent))}>
      <tool.Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-white">{tool.label}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest", accentText(tool.accent),
          tool.accent === "gold" ? "border-og-gold/25 bg-og-gold/8" : tool.accent === "cyan" ? "border-og-cyan/25 bg-og-cyan/8" : tool.accent === "white" ? "border-white/15 bg-white/5" : "border-og-lime/25 bg-og-lime/8"
        )}>
          {tool.group}
        </span>
      </div>
      <p className="truncate text-[11px] text-white/40">{tool.description}</p>
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
  </button>
);

/* ─── Tool Shell (wraps each tool) ─── */
const ToolShell = ({ tab, children }: { tab: TabConfig; children: ReactNode }) => (
  <div className="space-y-4">
    {/* Tool header */}
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border", accentIcon(tab.accent))}>
          <tab.Icon className="h-6 w-6" />
        </div>
        <div>
          <div className={cn("mb-0.5 text-[9px] font-bold uppercase tracking-widest", accentText(tab.accent))}>
            {tab.group} · {tab.eyebrow}
          </div>
          <h2 className="text-xl font-black leading-tight text-white sm:text-2xl">{tab.label}</h2>
          <p className="mt-0.5 max-w-xl text-[12px] text-white/45">{tab.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] text-white/40">
          /{tab.slug}
        </span>
        <span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] text-og-cyan/60">
          pg {tab.pageNumber}
        </span>
      </div>
    </div>

    {/* Tool content */}
    <div className="og-tool-shell og-tool-shell-redesign relative">{children}</div>
  </div>
);

/* ─── Suite nav for merged tools ─── */
type SuiteOption<T extends string> = {
  id: T;
  label: string;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
};

const SuiteNav = <T extends string>({
  options,
  activeId,
  onChange,
}: {
  options: SuiteOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
}) => (
  <div className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} role="tablist">
    {options.map((opt) => {
      const isActive = opt.id === activeId;
      return (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex min-w-[160px] shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] sm:min-w-[190px]",
            isActive
              ? "border-og-lime/40 bg-og-lime/10 text-white shadow-[0_0_24px_-12px_hsl(var(--og-lime))]"
              : "border-white/[0.07] bg-white/[0.03] text-white/60 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white",
          )}
        >
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", isActive ? "border-og-lime/30 bg-og-lime/15 text-og-lime" : accentIcon(opt.accent))}>
            <opt.Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className={cn("block text-[9px] font-bold uppercase tracking-widest", isActive ? "text-og-lime" : accentText(opt.accent))}>{opt.eyebrow}</span>
            <span className="block text-[13px] font-black leading-tight">{opt.label}</span>
          </span>
        </button>
      );
    })}
  </div>
);

const truthSuiteOptions: SuiteOption<"scanner" | "og-finder">[] = [
  { id: "scanner", label: "Scanner", eyebrow: "Mint scan", description: "Risk, liquidity, holders, dominance.", Icon: Search, accent: "lime" },
  { id: "og-finder", label: "OG Finder", eyebrow: "Origin proof", description: "First mint, lineage, clone check.", Icon: Crosshair, accent: "white" },
];

const launchSuiteOptions: SuiteOption<"snipe-feed" | "migrations">[] = [
  { id: "snipe-feed", label: "Snipe Feed", eyebrow: "Fresh launches", description: "New launches, repeat devs, risk.", Icon: Target, accent: "cyan" },
  { id: "migrations", label: "Migrations", eyebrow: "Pump.fun → DEX", description: "Migration timing and breakouts.", Icon: Rocket, accent: "gold" },
];

const marketSuiteOptions: SuiteOption<"feed" | "market-pulse" | "pairs" | "trending" | "news-signal" | "whales" | "tx-feed">[] = [
  { id: "feed", label: "Live Feed", eyebrow: "Narrative tape", description: "Trending, runners, bundles, boosts.", Icon: Rss, accent: "lime" },
  { id: "news-signal", label: "News Signal", eyebrow: "Influencer intel", description: "Elon, Trump, White House — find coins early.", Icon: Radio, accent: "lime" },
  { id: "market-pulse", label: "Vitals", eyebrow: "Active mint", description: "Price, liquidity, holders, chart.", Icon: Activity, accent: "blue" },
  { id: "pairs", label: "Pairs", eyebrow: "Pool discovery", description: "Fresh Solana DEX pair radar.", Icon: Radar, accent: "cyan" },
  { id: "trending", label: "Trending", eyebrow: "Market heat", description: "Fastest-moving tokens now.", Icon: Flame, accent: "cyan" },
  { id: "whales", label: "Whales", eyebrow: "Holder power", description: "Concentration and whale structure.", Icon: Wallet, accent: "white" },
  { id: "tx-feed", label: "Tx Tape", eyebrow: "Live prints", description: "Focused transaction tape.", Icon: Activity, accent: "cyan" },
];

const TruthScanSuite = ({ onSelect }: { onSelect: (m: string) => void }) => {
  const [active, setActive] = useState<"scanner" | "og-finder">("scanner");
  return (
    <section>
      <SuiteNav options={truthSuiteOptions} activeId={active} onChange={setActive} />
      {active === "scanner" ? <Scanner onSelect={onSelect} /> : <OgFinder onSelect={onSelect} />}
    </section>
  );
};

const LaunchRadarSuite = ({ onSelect }: { onSelect: (m: string) => void }) => {
  const [active, setActive] = useState<"snipe-feed" | "migrations">("snipe-feed");
  return (
    <section>
      <SuiteNav options={launchSuiteOptions} activeId={active} onChange={setActive} />
      {active === "snipe-feed" ? <SnipeFeed onSelect={onSelect} /> : <Migrations onSelect={onSelect} />}
    </section>
  );
};

const MarketFeedSuite = ({ mint, onSelect }: { mint: string; onSelect: (m: string) => void }) => {
  const [active, setActive] = useState<"feed" | "market-pulse" | "pairs" | "trending" | "news-signal" | "whales" | "tx-feed">("feed");
  return (
    <section>
      <SuiteNav options={marketSuiteOptions} activeId={active} onChange={setActive} />
      {active === "feed" && <Feed onSelect={onSelect} />}
      {active === "news-signal" && <NewsSignal onSelect={onSelect} />}
      {active === "market-pulse" && <OgStats mint={mint} onSelect={onSelect} />}
      {active === "pairs" && <PairTracker onSelect={onSelect} />}
      {active === "trending" && <Trending onSelect={onSelect} />}
      {active === "whales" && <Whales mint={mint} />}
      {active === "tx-feed" && <TxFeed mint={mint} />}
    </section>
  );
};

/* ─── Inline wrappers: render Communities / Discover without their own AppLayout ─── */

/**
 * CommunitiesInline — mounts the Communities page in a sandboxed container.
 * AppLayout renders a sidebar + flex wrapper; we use CSS to collapse the sidebar
 * and unwrap the layout padding so the content fits cleanly inside the OGScan tool shell.
 */
const CommunitiesInline = () => (
  <div
    className="og-inline-page"
    style={{ minHeight: "70vh" }}
  >
    <style>{`
      .og-inline-page > div.min-h-screen {
        min-height: unset !important;
        background: transparent !important;
        backdrop-filter: none !important;
      }
      .og-inline-page > div.min-h-screen > div.hidden {
        display: none !important;
      }
      .og-inline-page > div.min-h-screen > main {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        overflow: visible !important;
      }
    `}</style>
    <CommunitiesPage />
  </div>
);

const DiscoverInline = () => (
  <div
    className="og-inline-page"
    style={{ minHeight: "70vh" }}
  >
    <DiscoverPage />
  </div>
);

export default Index;
