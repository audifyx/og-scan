import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Coins,
  Cpu,
  Crosshair,
  Flame,
  Gauge,
  Layers3,
  Map,
  Menu,
  Radar,
  Rocket,
  Rss,
  Search,
  ShieldCheck,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { Scanlines } from "@/components/Scanlines";
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
import { SolToolsRoadmap } from "@/components/SolToolsRoadmap";
import { cn } from "@/lib/utils";
import { DEFAULT_OG_MINT, OGSCAN_DEV_WALLET, OGSCAN_TOKEN_MINT, SOL_MINT, STORAGE_OG_MINT, shortAddr } from "@/lib/og";

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
  | "tech";

type TabAccent = "blue" | "white" | "cyan" | "gold" | "lime";
type TabGroup = "Command" | "Forensics" | "Market" | "Project";

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
    label: "Command",
    slug: "command",
    pageNumber: 1,
    eyebrow: "START HERE",
    description: "A clean command hub for launching scanner, OG finder, snipe feed, and every standalone tool route.",
    Icon: Gauge,
    accent: "blue",
    group: "Command",
  },
  {
    id: "scanner",
    label: "Truth Scan",
    slug: "scanner",
    pageNumber: 6,
    eyebrow: "RUN THE CHAIN",
    description: "Merged Scanner + OG Finder workspace for mint checks, origin proof, dominance status, liquidity risk, holders, and forensic probabilities.",
    Icon: Search,
    accent: "blue",
    group: "Forensics",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    slug: "og-finder",
    pageNumber: 7,
    eyebrow: "ORIGIN CHECK",
    description: "Origin-finder module grouped inside Truth Scan for first-mint proof, lineage, and dominance context.",
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
    eyebrow: "DEV WALLET RADAR",
    description: "Merged launch command center for new coins, repeat creators, watch alerts, migration timing, and launch quality scores.",
    Icon: Target,
    accent: "cyan",
    group: "Forensics",
  },
  {
    id: "migrations",
    label: "Migrations",
    slug: "migrations",
    pageNumber: 9,
    eyebrow: "BREAKOUT WATCH",
    description: "Migration timing module grouped inside Launch Radar for Pump.fun breakout and DEX arrival tracking.",
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
    eyebrow: "LIVE TOKEN INTEL",
    description: "Merged market command center for trending coins, pair discovery, whale/tx context, spotlight runners, bundle status, boosts, and CTO/dev-launch analytics.",
    Icon: Rss,
    accent: "lime",
    group: "Market",
  },
  {
    id: "market-pulse",
    label: "Market Pulse",
    slug: "market-pulse",
    pageNumber: 4,
    eyebrow: "LIVE OVERVIEW",
    description: "Active-mint vitals module grouped inside Market Feed for fast price, liquidity, and holder context.",
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
    eyebrow: "NEW PAIR RADAR",
    description: "Pair discovery module grouped inside Market Feed for new pool, liquidity, and routing intelligence.",
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
    eyebrow: "MARKET HEAT",
    description: "Trending heat module grouped inside Market Feed for live token momentum and catalyst discovery.",
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
    eyebrow: "WALLET RADAR",
    description: "Whale concentration module grouped inside Market Feed for holder pressure and concentration checks.",
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
    eyebrow: "LIVE TRANSACTIONS",
    description: "Selected-mint transaction tape grouped inside Market Feed for live buy/sell and wallet flow context.",
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
    eyebrow: "JUPITER ROUTE",
    description: "Search coins and quote routes while keeping scanner context nearby.",
    Icon: Zap,
    accent: "blue",
    group: "Market",
  },
  {
    id: "our-coin",
    label: "Our Coin",
    slug: "our-coin",
    pageNumber: 2,
    eyebrow: "OFFICIAL TOKEN",
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
    eyebrow: "SOLTOOLS VISION",
    description: "The path from OGScan into the crypto-native community layer SolTools is building.",
    Icon: Map,
    accent: "cyan",
    group: "Project",
  },
  {
    id: "tech",
    label: "Tech",
    slug: "tech",
    pageNumber: 14,
    eyebrow: "DATA PIPELINE",
    description: "The systems powering OG attribution, candles, live tape, launch intelligence, and token forensics.",
    Icon: Cpu,
    accent: "white",
    group: "Project",
  },
];

const NAV_TABS: TabConfig[] = TABS.filter((tabConfig: TabConfig) => tabConfig.showInNav !== false);

const TAB_BY_ID: Record<TabId, TabConfig> = TABS.reduce(
  (acc: Record<TabId, TabConfig>, tabConfig: TabConfig): Record<TabId, TabConfig> => {
    acc[tabConfig.id] = tabConfig;
    return acc;
  },
  {} as Record<TabId, TabConfig>,
);

const ROUTE_ALIASES: Record<string, TabId> = TABS.reduce(
  (acc: Record<string, TabId>, tabConfig: TabConfig): Record<string, TabId> => {
    acc[tabConfig.slug] = tabConfig.id;
    acc[tabConfig.id] = tabConfig.id;
    acc[`page-${tabConfig.pageNumber}`] = tabConfig.id;
    acc[`page${tabConfig.pageNumber}`] = tabConfig.id;
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
  const normalizedSlug: string = decodeURIComponent(slug ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  if (!normalizedSlug) return "overview";
  return ROUTE_ALIASES[normalizedSlug] ?? null;
};

const getTabPath = (tabId: TabId): string => {
  if (tabId === "overview") return "/app";
  return `/${TAB_BY_ID[tabId].slug}`;
};

const renderTool = (tab: TabId, mint: string, updateMint: (nextMint: string) => void): ReactNode => {
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
  return null;
};

const Index = () => {
  const { toolSlug, pageNumber } = useParams<{ toolSlug?: string; pageNumber?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const pathSlug: string = location.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
  const routeSlug: string | undefined = pageNumber ? `page-${pageNumber}` : toolSlug ?? pathSlug;
  const routeTab: TabId = useMemo<TabId>(() => getTabFromSlug(routeSlug) ?? "overview", [routeSlug]);
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [tab, setTab] = useState<TabId>(routeTab);

  useEffect(() => {
    try {
      const savedMint: string | null = localStorage.getItem(STORAGE_OG_MINT);
      if (savedMint && savedMint !== LEGACY_DEFAULT_MINT && savedMint !== SOL_MINT) {
        setMint(savedMint);
      } else {
        setMint(DEFAULT_OG_MINT);
        localStorage.setItem(STORAGE_OG_MINT, DEFAULT_OG_MINT);
      }
    } catch {
      /* localStorage can be unavailable in restricted browser contexts */
    }
  }, []);

  useEffect(() => {
    setTab(routeTab);
  }, [routeTab]);

  useEffect(() => {
    if (routeSlug && !getTabFromSlug(routeSlug)) {
      navigate("/app", { replace: true });
    }
  }, [navigate, routeSlug]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, tab]);

  const activeTab: TabConfig = useMemo<TabConfig>(() => TABS.find((item: TabConfig) => item.id === tab) ?? TABS[0], [tab]);

  const switchTab = (nextTab: string): void => {
    const safeTab: TabId = TABS.some((item: TabConfig) => item.id === nextTab) ? (nextTab as TabId) : "overview";
    setTab(safeTab);
    try {
      localStorage.setItem(STORAGE_TAB, safeTab);
    } catch {
      /* noop */
    }
    navigate(getTabPath(safeTab));
  };

  const updateMint = (nextMint: string): void => {
    setMint(nextMint);
    try {
      localStorage.setItem(STORAGE_OG_MINT, nextMint);
    } catch {
      /* noop */
    }
  };

  const promptMint = (): void => {
    const nextMint: string | null = window.prompt("Paste any Solana mint address to inspect:", mint);
    if (nextMint && nextMint.trim().length > 20) {
      updateMint(nextMint.trim());
      switchTab("scanner");
    }
  };

  return (
    <div className="og-workspace min-h-screen overflow-x-hidden bg-[#01040b] text-foreground">
      <Scanlines />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--og-cyan)/0.18),transparent_34%),radial-gradient(circle_at_90%_10%,hsl(var(--og-lime)/0.12),transparent_30%),radial-gradient(circle_at_60%_100%,hsl(var(--og-gold)/0.08),transparent_34%),linear-gradient(180deg,#06101e_0%,#01040b_46%,#02040a_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-[0.14]" />

      <div className="flex min-h-screen">
        <WorkspaceSidebar activeId={tab} mint={mint} onChangeMint={promptMint} onNavigate={switchTab} />

        <div className="min-w-0 flex-1 lg:pl-[306px]">
          <MobileToolDock activeId={tab} onNavigate={switchTab} />
          <WorkspaceTopBar tab={activeTab} mint={mint} onChangeMint={promptMint} />

          <main className="px-3 pb-20 pt-3 sm:px-5 lg:px-7 lg:pb-10">
            {tab === "overview" ? (
              <OverviewPage mint={mint} onSwitchTab={(nextTab: TabId) => switchTab(nextTab)} onScanClick={() => switchTab("scanner")} onChangeMint={promptMint} />
            ) : (
              <ToolPage tab={activeTab}>{renderTool(tab, mint, updateMint)}</ToolPage>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

const WorkspaceSidebar = ({
  activeId,
  mint,
  onChangeMint,
  onNavigate,
}: {
  activeId: TabId;
  mint: string;
  onChangeMint: () => void;
  onNavigate: (nextTab: string) => void;
}) => {
  const groups: TabGroup[] = ["Forensics", "Market", "Project"];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[306px] border-r border-white/10 bg-[#03101f]/82 p-4 shadow-[36px_0_120px_-90px_hsl(var(--og-cyan))] backdrop-blur-2xl lg:block">
      <div className="flex h-full flex-col">
        <button type="button" onClick={() => onNavigate("overview")} className="group mb-4 flex items-center gap-3 rounded-[1.45rem] border border-white/10 bg-white/[0.055] p-3 text-left transition hover:border-og-lime/60 hover:bg-og-lime/10">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-og-lime/70 bg-og-ink shadow-og">
            <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-og-cyan shadow-og" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-black uppercase tracking-tight text-white">OGSCAN</div>
            <div className="truncate font-mono text-[9px] uppercase tracking-[0.24em] text-og-cyan">Forensic tools</div>
          </div>
        </button>

        <button type="button" onClick={() => onNavigate("scanner")} className="group relative mb-4 overflow-hidden rounded-[1.45rem] border border-og-lime/55 bg-og-lime px-4 py-4 text-left text-og-ink shadow-[0_0_42px_-18px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.99]">
          <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/40 blur-2xl transition group-hover:translate-x-3" />
          <span className="relative flex items-center justify-between gap-3">
            <span>
              <span className="block font-mono text-[9px] font-black uppercase tracking-[0.24em] opacity-70">Main action</span>
              <span className="mt-1 block font-display text-2xl font-black uppercase leading-none">Truth Scan</span>
            </span>
            <Search className="h-6 w-6" />
          </span>
        </button>

        <div className="mb-4 rounded-[1.35rem] border border-white/10 bg-black/24 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>Active mint</span>
            <span className="text-og-lime">Mainnet</span>
          </div>
          <button type="button" onClick={onChangeMint} className="flex w-full items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/[0.055] px-3 py-2.5 text-left font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/76 transition hover:border-og-cyan hover:text-og-cyan">
            {shortAddr(mint, 5)} <Menu className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="ios-scroll min-h-0 flex-1 overflow-y-auto pr-1" aria-label="OGScan tool sidebar">
          <SidebarButton item={TAB_BY_ID.overview} activeId={activeId} onNavigate={onNavigate} featured />
          {groups.map((group: TabGroup) => (
            <div key={group} className="mt-5">
              <div className="mb-2 flex items-center justify-between px-2 font-mono text-[9px] font-black uppercase tracking-[0.26em] text-muted-foreground">
                <span>{group}</span>
                <span className="h-px w-10 bg-white/10" />
              </div>
              <div className="space-y-1.5">
                {NAV_TABS.filter((item: TabConfig) => item.group === group).map((item: TabConfig) => (
                  <SidebarButton key={item.id} item={item} activeId={activeId} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 rounded-[1.35rem] border border-og-gold/30 bg-og-gold/10 p-3">
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-og-gold">Official token</div>
          <div className="mt-1 text-xs font-bold text-white/72">CA {shortAddr(OGSCAN_TOKEN_MINT, 5)} · Dev {shortAddr(OGSCAN_DEV_WALLET, 5)}</div>
        </div>
      </div>
    </aside>
  );
};

const SidebarButton = ({
  item,
  activeId,
  onNavigate,
  featured = false,
}: {
  item: TabConfig;
  activeId: TabId;
  onNavigate: (nextTab: string) => void;
  featured?: boolean;
}) => {
  const isActive: boolean = activeId === item.id || TAB_BY_ID[activeId]?.mergedInto === item.id;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[1.15rem] border p-2.5 text-left transition active:scale-[0.99]",
        isActive
          ? "border-og-lime bg-og-lime text-og-ink shadow-[0_0_30px_-18px_hsl(var(--og-lime))]"
          : "border-transparent bg-transparent text-white/68 hover:border-white/10 hover:bg-white/[0.055] hover:text-white",
        featured && !isActive && "border-white/10 bg-white/[0.045]",
      )}
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", isActive ? "border-og-ink/15 bg-og-ink/10" : getAccentClass(item.accent, "icon"))}>
        <item.Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-black uppercase leading-none">{item.label}</span>
        <span className={cn("mt-1 block truncate font-mono text-[8px] uppercase tracking-[0.2em]", isActive ? "text-og-ink/70" : "text-muted-foreground")}>/{item.slug} · p{item.pageNumber}</span>
      </span>
      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition", isActive ? "text-og-ink/70" : "text-og-cyan opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100")} />
    </button>
  );
};

const MobileToolDock = ({ activeId, onNavigate }: { activeId: TabId; onNavigate: (nextTab: string) => void }) => (
  <div className="sticky top-0 z-40 border-b border-white/10 bg-[#03101f]/92 p-2 backdrop-blur-2xl lg:hidden">
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <button type="button" onClick={() => onNavigate("overview")} className="flex items-center gap-2 text-left">
        <img src="/icon.png" alt="OG Scan" className="h-9 w-9 rounded-xl border border-og-lime/60" />
        <span>
          <span className="block font-display text-sm font-black uppercase leading-none text-white">OGSCAN</span>
          <span className="block font-mono text-[8px] uppercase tracking-[0.22em] text-og-cyan">Tool sidebar</span>
        </span>
      </button>
      <button type="button" onClick={() => onNavigate("scanner")} className="rounded-full border border-og-lime bg-og-lime px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-og-ink">
        Truth Scan
      </button>
    </div>
    <nav className="ios-scroll flex gap-2 overflow-x-auto" aria-label="Mobile tool navigation">
      {NAV_TABS.map((item: TabConfig) => {
        const isActive: boolean = activeId === item.id || TAB_BY_ID[activeId]?.mergedInto === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.15em] transition",
              isActive ? "border-og-lime bg-og-lime text-og-ink" : "border-white/10 bg-white/[0.055] text-white/62 hover:text-og-cyan",
            )}
          >
            <item.Icon className="h-3.5 w-3.5" /> {item.label}
          </button>
        );
      })}
    </nav>
  </div>
);

const WorkspaceTopBar = ({ tab, mint, onChangeMint }: { tab: TabConfig; mint: string; onChangeMint: () => void }) => {
  const accentTextClass: string = getAccentClass(tab.accent, "text");

  return (
    <header className="border-b border-white/10 bg-[#020916]/56 px-3 py-3 backdrop-blur-xl sm:px-5 lg:px-7">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className={cn("mb-1 flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.28em]", accentTextClass)}>
            <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_16px_currentColor]" /> {tab.eyebrow}
          </div>
          <h1 className="truncate font-display text-3xl font-black uppercase leading-none tracking-tighter text-white sm:text-4xl">
            {tab.label}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.18em]">
          <span className={cn("og-pill px-3 py-2", accentTextClass)}>
            <tab.Icon className="h-3.5 w-3.5" /> /{tab.slug}
          </span>
          <span className="og-pill px-3 py-2 text-og-cyan">/page/{tab.pageNumber}</span>
          <button type="button" onClick={onChangeMint} className="og-pill px-3 py-2 text-white/72 transition hover:border-og-lime hover:text-og-lime">
            Mint {shortAddr(mint, 4)}
          </button>
        </div>
      </div>
    </header>
  );
};

const OverviewPage = ({
  mint,
  onSwitchTab,
  onScanClick,
  onChangeMint,
}: {
  mint: string;
  onSwitchTab: (nextTab: TabId) => void;
  onScanClick: () => void;
  onChangeMint: () => void;
}) => {
  const priorityTabs: TabConfig[] = [TAB_BY_ID.scanner, TAB_BY_ID["snipe-feed"], TAB_BY_ID.feed, TAB_BY_ID.swap];
  const metricCards: { label: string; value: string; note: string; Icon: ComponentType<{ className?: string }>; accent: TabAccent }[] = [
    { label: "Primary flow", value: "Truth Scan", note: "Scanner + OG Finder", Icon: Search, accent: "blue" },
    { label: "Launch flow", value: "Radar", note: "Snipes + migrations", Icon: Target, accent: "cyan" },
    { label: "Market flow", value: "Feed", note: "Pulse + trending + tape", Icon: Rss, accent: "lime" },
    { label: "Active mint", value: shortAddr(mint, 4), note: "Tap to replace", Icon: Layers3, accent: "gold" },
  ];

  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_120px_-88px_hsl(var(--og-cyan))] backdrop-blur-xl sm:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-og-cyan via-og-lime to-white" />
        <div className="pointer-events-none absolute -right-28 -top-24 h-80 w-80 rounded-full bg-og-lime/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-20 h-80 w-80 rounded-full bg-og-cyan/10 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-og-cyan/40 bg-og-cyan/10 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan">
              <ShieldCheck className="h-3.5 w-3.5" /> Forensic tools live
            </div>
            <h2 className="max-w-4xl font-display text-5xl font-black uppercase leading-[0.88] tracking-tighter text-white text-glow sm:text-7xl">
              Solana token truth engine
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              Run mint forensics, prove first origin, score dominance, inspect holder and LP risk, track Pump.fun migrations, watch repeat dev wallets, monitor live runners, and route swaps with token context still on-screen.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onScanClick} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-[1.25rem] border border-og-lime bg-og-lime px-5 font-display text-lg font-black uppercase text-og-ink shadow-[0_0_42px_-16px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.985] sm:flex-none">
                Open Scanner <ArrowUpRight className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onSwitchTab("snipe-feed")} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/[0.075] px-5 font-display text-lg font-black uppercase text-white transition hover:border-og-cyan hover:text-og-cyan active:scale-[0.985] sm:flex-none">
                Launch Radar <Target className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="rounded-[1.65rem] border border-white/10 bg-black/24 p-4">
            <div className="mb-3 font-mono text-[10px] font-black uppercase tracking-[0.24em] text-og-gold">Truth rule</div>
            <p className="text-sm font-semibold leading-6 text-white/76">
              OG status comes from earliest provable on-chain creation and origin history — not market cap, migration, volume, or whoever is trending.
            </p>
            <button type="button" onClick={onChangeMint} className="mt-4 w-full rounded-[1rem] border border-og-gold/35 bg-og-gold/10 px-4 py-3 text-left font-mono text-[10px] font-black uppercase tracking-[0.2em] text-og-gold transition hover:bg-og-gold hover:text-og-ink">
              Current mint · {shortAddr(mint, 5)}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <button key={card.label} type="button" onClick={card.label === "Active mint" ? onChangeMint : () => undefined} className="group rounded-[1.55rem] border border-white/10 bg-white/[0.055] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition hover:border-og-cyan/60 hover:bg-white/[0.075] active:scale-[0.99]">
            <span className={cn("mb-4 grid h-11 w-11 place-items-center rounded-xl border", getAccentClass(card.accent, "icon"))}>
              <card.Icon className="h-5 w-5" />
            </span>
            <span className="block font-mono text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{card.label}</span>
            <span className="mt-1 block font-display text-2xl font-black uppercase leading-none text-white">{card.value}</span>
            <span className="mt-2 block text-xs font-bold text-white/52">{card.note}</span>
          </button>
        ))}
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl sm:p-5">
        <PanelTitle icon={Target} eyebrow="Start here" title="Most used tools" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {priorityTabs.map((tool: TabConfig) => (
            <ToolCard key={tool.id} tool={tool} onClick={() => onSwitchTab(tool.id)} featured />
          ))}
        </div>
      </section>
    </section>
  );
};

type SuiteOption<T extends string> = {
  id: T;
  label: string;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
};

const truthSuiteOptions: SuiteOption<"scanner" | "og-finder">[] = [
  {
    id: "scanner",
    label: "Scanner",
    eyebrow: "Mint or ticker scan",
    description: "Fast risk, liquidity, holder, ATH/ATL, authority, dominance, and classification scan.",
    Icon: Search,
    accent: "blue",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    eyebrow: "Origin proof",
    description: "Earliest credible Solana origin, lineage, legacy OG, revived official, contested, and clone checks.",
    Icon: Crosshair,
    accent: "white",
  },
];

const launchSuiteOptions: SuiteOption<"snipe-feed" | "migrations">[] = [
  {
    id: "snipe-feed",
    label: "Snipe Feed",
    eyebrow: "Fresh launches",
    description: "New Solana launches, repeat creators, watch alerts, and launch quality/rug signals.",
    Icon: Target,
    accent: "cyan",
  },
  {
    id: "migrations",
    label: "Migrations",
    eyebrow: "Pump.fun → DEX",
    description: "Migration timestamp, duration, bonding curve context, and breakout timing separated from OG status.",
    Icon: Rocket,
    accent: "gold",
  },
];

const marketSuiteOptions: SuiteOption<"feed" | "market-pulse" | "pairs" | "trending" | "whales" | "tx-feed">[] = [
  {
    id: "feed",
    label: "Live Feed",
    eyebrow: "Narrative tape",
    description: "Trending tokens, catalysts, runners, bundle flags, paid boosts, and dev-risk context.",
    Icon: Rss,
    accent: "lime",
  },
  {
    id: "market-pulse",
    label: "Vitals",
    eyebrow: "Active mint",
    description: "Price, liquidity, holders, market cap, DexScreener charting, and quick token retargeting.",
    Icon: Activity,
    accent: "blue",
  },
  {
    id: "pairs",
    label: "Pairs",
    eyebrow: "Pool discovery",
    description: "Fresh Solana pair radar for Raydium, Meteora, and other DEX pools before timeline hype.",
    Icon: Radar,
    accent: "cyan",
  },
  {
    id: "trending",
    label: "Trending",
    eyebrow: "Market heat",
    description: "The fastest-moving tokens and current Solana meme narratives in one scan lane.",
    Icon: Flame,
    accent: "cyan",
  },
  {
    id: "whales",
    label: "Whales",
    eyebrow: "Holder power",
    description: "Largest holders, concentration risk, and whale structure for the selected mint.",
    Icon: Wallet,
    accent: "white",
  },
  {
    id: "tx-feed",
    label: "Tx Tape",
    eyebrow: "Live prints",
    description: "Focused transaction tape for the currently selected token.",
    Icon: Activity,
    accent: "cyan",
  },
];

const SuiteNav = <T extends string,>({
  options,
  activeId,
  onChange,
}: {
  options: SuiteOption<T>[];
  activeId: T;
  onChange: (nextId: T) => void;
}) => (
  <div className="mb-4 rounded-[1.55rem] border border-white/10 bg-black/24 p-2">
    <div className="ios-scroll flex gap-2 overflow-x-auto" role="tablist" aria-label="Merged workspace modules">
      {options.map((option: SuiteOption<T>) => {
        const isActive: boolean = option.id === activeId;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "group flex min-w-[210px] shrink-0 items-start gap-3 rounded-[1.25rem] border p-3 text-left transition active:scale-[0.99]",
              isActive ? "border-og-lime bg-og-lime text-og-ink shadow-[0_0_34px_-18px_hsl(var(--og-lime))]" : "border-white/10 bg-white/[0.045] text-white/70 hover:border-og-cyan/60 hover:bg-white/[0.065] hover:text-white",
            )}
          >
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", isActive ? "border-og-ink/15 bg-og-ink/10" : getAccentClass(option.accent, "icon"))}>
              <option.Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block font-mono text-[8px] font-black uppercase tracking-[0.22em]", isActive ? "text-og-ink/65" : getAccentClass(option.accent, "text"))}>{option.eyebrow}</span>
              <span className="mt-1 block font-display text-base font-black uppercase leading-none">{option.label}</span>
              <span className={cn("mt-2 line-clamp-2 block text-[11px] font-semibold leading-4", isActive ? "text-og-ink/70" : "text-white/50")}>{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

const TruthScanSuite = ({ onSelect }: { onSelect: (mint: string) => void }) => {
  const [activeModule, setActiveModule] = useState<"scanner" | "og-finder">("scanner");

  return (
    <section>
      <SuiteNav options={truthSuiteOptions} activeId={activeModule} onChange={setActiveModule} />
      {activeModule === "scanner" ? <Scanner onSelect={onSelect} /> : <OgFinder onSelect={onSelect} />}
    </section>
  );
};

const LaunchRadarSuite = ({ onSelect }: { onSelect: (mint: string) => void }) => {
  const [activeModule, setActiveModule] = useState<"snipe-feed" | "migrations">("snipe-feed");

  return (
    <section>
      <SuiteNav options={launchSuiteOptions} activeId={activeModule} onChange={setActiveModule} />
      {activeModule === "snipe-feed" ? <SnipeFeed onSelect={onSelect} /> : <Migrations onSelect={onSelect} />}
    </section>
  );
};

const MarketFeedSuite = ({ mint, onSelect }: { mint: string; onSelect: (mint: string) => void }) => {
  const [activeModule, setActiveModule] = useState<"feed" | "market-pulse" | "pairs" | "trending" | "whales" | "tx-feed">("feed");

  return (
    <section>
      <SuiteNav options={marketSuiteOptions} activeId={activeModule} onChange={setActiveModule} />
      {activeModule === "feed" ? <Feed onSelect={onSelect} /> : null}
      {activeModule === "market-pulse" ? <OgStats mint={mint} onSelect={onSelect} /> : null}
      {activeModule === "pairs" ? <PairTracker onSelect={onSelect} /> : null}
      {activeModule === "trending" ? <Trending onSelect={onSelect} /> : null}
      {activeModule === "whales" ? <Whales mint={mint} /> : null}
      {activeModule === "tx-feed" ? <TxFeed mint={mint} /> : null}
    </section>
  );
};

const ToolPage = ({ tab, children }: { tab: TabConfig; children: ReactNode }) => {
  const accentTextClass: string = getAccentClass(tab.accent, "text");

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_120px_-88px_hsl(var(--og-cyan))] backdrop-blur-xl sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-og-cyan via-og-lime to-white" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-[1.25rem] border", getAccentClass(tab.accent, "icon"))}>
              <tab.Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className={cn("mb-1 flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.26em]", accentTextClass)}>
                <span className="h-px w-8 bg-current" /> {tab.group} workspace
              </div>
              <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tighter text-white sm:text-5xl">{tab.label}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">{tab.description}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:w-[410px]">
            <RouteChip label="Direct" value={`/${tab.slug}`} accent={tab.accent} />
            <RouteChip label="Embed" value={`/page/${tab.pageNumber}`} accent="cyan" />
            <RouteChip label="Alt" value={`page-${tab.pageNumber}`} accent="gold" />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#020917]/84 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_28px_110px_-86px_hsl(var(--og-cyan))] backdrop-blur-2xl sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-cyan/70 to-transparent" />
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-og-cyan/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-8 h-72 w-72 rounded-full bg-og-lime/8 blur-3xl" />
        <div className="relative mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className={cn("font-mono text-[9px] font-black uppercase tracking-[0.28em]", accentTextClass)}>Active tool canvas</div>
            <div className="mt-1 font-display text-xl font-black uppercase text-white">{tab.label} module</div>
          </div>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/54 sm:inline-flex">
            Clean boundary
          </span>
        </div>
        <div className="og-tool-shell og-tool-shell-redesign relative">{children}</div>
      </div>
    </section>
  );
};

const RouteChip = ({ label, value, accent }: { label: string; value: string; accent: TabAccent }) => (
  <div className="rounded-[1rem] border border-white/10 bg-black/22 px-3 py-2">
    <div className="font-mono text-[8px] font-black uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
    <div className={cn("mt-1 truncate font-mono text-[10px] font-black uppercase tracking-[0.16em]", getAccentClass(accent, "text"))}>{value}</div>
  </div>
);

const PanelTitle = ({ icon: Icon, eyebrow, title }: { icon: ComponentType<{ className?: string }>; eyebrow: string; title: string }) => (
  <div>
    <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
      <Icon className="h-3.5 w-3.5" /> {eyebrow}
    </div>
    <h3 className="font-display text-2xl font-black uppercase tracking-tight text-foreground">{title}</h3>
  </div>
);

const ToolCard = ({ tool, onClick, featured = false }: { tool: TabConfig; onClick: () => void; featured?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group relative min-h-[172px] overflow-hidden rounded-[1.55rem] border border-white/10 bg-white/[0.055] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_64px_-52px_hsl(var(--og-cyan))] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-og-lime hover:bg-og-lime/[0.07] active:scale-[0.99]",
      featured && "border-og-lime/35 bg-og-lime/10 shadow-[0_0_48px_-28px_hsl(var(--og-lime))]",
    )}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-lime/60 to-transparent opacity-0 transition group-hover:opacity-100" />
    <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl border", getAccentClass(tool.accent, "icon"))}>
      <tool.Icon className="h-5 w-5" />
    </div>
    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{tool.eyebrow}</div>
    <div className="mt-1 flex items-center justify-between gap-3">
      <span className="font-display text-xl font-black uppercase tracking-tight text-foreground">{tool.label}</span>
      <ChevronRight className="h-4 w-4 text-og-lime opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
    </div>
    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{tool.description}</p>
    <div className="absolute bottom-3 left-4 right-4 border-t border-white/10 pt-2 font-mono text-[8px] uppercase tracking-[0.22em] text-og-cyan">
      /{tool.slug} · page {tool.pageNumber}
    </div>
  </button>
);

const getAccentClass = (accent: TabAccent, part: "icon" | "text"): string => {
  if (part === "text") {
    if (accent === "gold") return "text-og-gold";
    if (accent === "cyan") return "text-og-cyan";
    if (accent === "white") return "text-white";
    return "text-og-lime";
  }

  if (accent === "gold") return "border-og-gold/50 bg-og-gold/10 text-og-gold shadow-og-gold";
  if (accent === "cyan") return "border-og-cyan/50 bg-og-cyan/10 text-og-cyan";
  if (accent === "white") return "border-white/25 bg-white/10 text-white";
  return "border-og-lime/50 bg-og-lime/10 text-og-lime shadow-og";
};

export default Index;
