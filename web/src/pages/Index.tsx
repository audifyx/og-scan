import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  CalendarClock,
  ChevronRight,
  Coins,
  Cpu,
  Crosshair,
  Flame,
  Gauge,
  Map,
  Radar,
  Rocket,
  Search,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";
import { Scanlines } from "@/components/Scanlines";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusStrip } from "@/components/StatusStrip";
import { Marquee } from "@/components/Marquee";
import { Hero } from "@/components/Hero";
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
import { SolToolsRoadmap } from "@/components/SolToolsRoadmap";
import { SiteFooter } from "@/components/SiteFooter";
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
  | "scanner"
  | "og-finder"
  | "pairs"
  | "migrations"
  | "trending"
  | "whales"
  | "tx-feed"
  | "swap"
  | "tech";

type TabAccent = "blue" | "white" | "cyan" | "gold";

type TabConfig = {
  id: TabId;
  label: string;
  slug: string;
  pageNumber: number;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
};

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Command",
    slug: "command",
    pageNumber: 1,
    eyebrow: "MARKET COMMAND",
    description: "OGScan home base with market pulse, safety notice, whales, tape, and tool shortcuts.",
    Icon: Gauge,
    accent: "blue",
  },
  {
    id: "our-coin",
    label: "Our Coin",
    slug: "our-coin",
    pageNumber: 2,
    eyebrow: "OFFICIAL TOKEN LIVE",
    description: "Official OGScan coin CA, dev wallet, chart links, and copy buttons in one verified room.",
    Icon: Coins,
    accent: "gold",
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
  },
  {
    id: "market-pulse",
    label: "Market Pulse",
    slug: "market-pulse",
    pageNumber: 4,
    eyebrow: "LIVE OVERVIEW",
    description: "A dedicated market pulse screen for the active mint with price, liquidity, holders, and core signal stats.",
    Icon: Activity,
    accent: "blue",
  },
  {
    id: "snipe-feed",
    label: "Snipe Feed",
    slug: "snipe-feed",
    pageNumber: 5,
    eyebrow: "DEV WALLET RADAR",
    description: "Track brand-new launches, repeat creators, watch alerts, and launch quality scores.",
    Icon: Target,
    accent: "cyan",
  },
  {
    id: "scanner",
    label: "Scanner",
    slug: "scanner",
    pageNumber: 6,
    eyebrow: "RUN THE CHAIN",
    description: "Search tickers or paste a mint to inspect token signal, liquidity, holders, and risk.",
    Icon: Search,
    accent: "blue",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    slug: "og-finder",
    pageNumber: 7,
    eyebrow: "ORIGIN CHECK",
    description: "Separate the earliest on-chain mint from copycats using token creation time only — not price or migration.",
    Icon: Crosshair,
    accent: "white",
  },
  {
    id: "pairs",
    label: "Pairs",
    slug: "pairs",
    pageNumber: 8,
    eyebrow: "NEW PAIR RADAR",
    description: "Monitor fresh Solana pairs before they hit timeline hype.",
    Icon: Radar,
    accent: "cyan",
  },
  {
    id: "migrations",
    label: "Migrations",
    slug: "migrations",
    pageNumber: 9,
    eyebrow: "BREAKOUT WATCH",
    description: "Find launches leaving chaos behind and moving into stronger liquidity.",
    Icon: Rocket,
    accent: "gold",
  },
  {
    id: "trending",
    label: "Trending",
    slug: "trending",
    pageNumber: 10,
    eyebrow: "MARKET HEAT",
    description: "See what is actually moving across Solana right now.",
    Icon: Flame,
    accent: "cyan",
  },
  {
    id: "whales",
    label: "Whales",
    slug: "whales",
    pageNumber: 11,
    eyebrow: "WALLET RADAR",
    description: "A standalone whale watch screen for holder concentration and largest token accounts.",
    Icon: Radar,
    accent: "white",
  },
  {
    id: "tx-feed",
    label: "Tx Feed",
    slug: "tx-feed",
    pageNumber: 12,
    eyebrow: "LIVE TRANSACTIONS",
    description: "A focused transaction tape for the selected mint, separated from every other tool.",
    Icon: Activity,
    accent: "cyan",
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
  },
  {
    id: "tech",
    label: "Tech",
    slug: "tech",
    pageNumber: 14,
    eyebrow: "DATA PIPELINE",
    description: "The APIs and systems powering OG detection, candles, live tape, and token intel.",
    Icon: Cpu,
    accent: "white",
  },
];

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
    market: "market-pulse",
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

const navItems = TABS.map((tabConfig: TabConfig) => ({ id: tabConfig.id, label: tabConfig.label }));

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

  const activeTab: TabConfig = useMemo<TabConfig>(() => TABS.find((item) => item.id === tab) ?? TABS[0], [tab]);

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

  const openScanner = (): void => switchTab("scanner");
  const openSwap = (): void => switchTab("swap");

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Scanlines />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,hsl(var(--og-lime)/0.18),transparent_36%),radial-gradient(circle_at_85%_8%,hsl(var(--og-cyan)/0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--og-ink)))]" />

      <SiteHeader navItems={navItems} activeId={tab} onNavigate={switchTab} />
      <StatusStrip mint={mint} onChangeMint={promptMint} />
      <Marquee />

      <main>
        {tab === "overview" ? (
          <OverviewPage mint={mint} onSelectMint={updateMint} onSwitchTab={(nextTab: TabId) => switchTab(nextTab)} onScanClick={openScanner} onSwapClick={openSwap} />
        ) : (
          <ToolPage tab={activeTab} allTabs={TABS} activeId={tab} onBack={() => switchTab("overview")} onSwitchTab={switchTab}>
            {tab === "our-coin" && <OurCoin />}
            {tab === "roadmap" && <SolToolsRoadmap />}
            {tab === "market-pulse" && <OgStats mint={mint} onSelect={updateMint} />}
            {tab === "snipe-feed" && <SnipeFeed onSelect={updateMint} />}
            {tab === "scanner" && <Scanner onSelect={updateMint} />}
            {tab === "og-finder" && <OgFinder onSelect={updateMint} />}
            {tab === "pairs" && <PairTracker onSelect={updateMint} />}
            {tab === "migrations" && <Migrations onSelect={updateMint} />}
            {tab === "trending" && <Trending onSelect={updateMint} />}
            {tab === "whales" && <Whales mint={mint} />}
            {tab === "tx-feed" && <TxFeed mint={mint} />}
            {tab === "swap" && <SwapPanel ogMint={mint} onSelectMint={updateMint} />}
            {tab === "tech" && <TechStack />}
          </ToolPage>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

const OverviewPage = ({
  mint,
  onSelectMint,
  onSwitchTab,
  onScanClick,
  onSwapClick,
}: {
  mint: string;
  onSelectMint: (nextMint: string) => void;
  onSwitchTab: (nextTab: TabId) => void;
  onScanClick: () => void;
  onSwapClick: () => void;
}) => {
  const featuredTabs: TabConfig[] = TABS.filter((item) => item.id !== "overview");
  const priorityTabs: TabConfig[] = [TAB_BY_ID.scanner, TAB_BY_ID["snipe-feed"], TAB_BY_ID["og-finder"], TAB_BY_ID.migrations];
  const intelligenceTabs: TabConfig[] = [TAB_BY_ID["market-pulse"], TAB_BY_ID.pairs, TAB_BY_ID.trending, TAB_BY_ID.whales, TAB_BY_ID["tx-feed"], TAB_BY_ID.swap];
  const projectTabs: TabConfig[] = [TAB_BY_ID["our-coin"], TAB_BY_ID.roadmap, TAB_BY_ID.tech];
  const toolGroups: { title: string; eyebrow: string; Icon: ComponentType<{ className?: string }>; tabs: TabConfig[] }[] = [
    { title: "Most used tools", eyebrow: "Start here", Icon: Target, tabs: priorityTabs },
    { title: "Market intelligence", eyebrow: "Live data", Icon: Activity, tabs: intelligenceTabs },
    { title: "Project pages", eyebrow: "Official", Icon: ShieldCheck, tabs: projectTabs },
  ];

  return (
    <>
      <Hero onScanClick={onScanClick} onSwapClick={onSwapClick} />

      <section className="relative border-b border-og-grid bg-og-ink/62">
        <div className="absolute inset-0 grid-bg opacity-24" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-lime/70 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.34em] text-og-cyan">
                <span className="h-px w-12 bg-og-cyan" /> CLEAN TOOL LAUNCHER
              </div>
              <h2 className="max-w-4xl font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
                Choose the exact tool you need. No more hunting through one long messy page.
              </h2>
            </div>
            <button onClick={() => onSwitchTab("our-coin")} className="rounded-[1.4rem] border border-og-gold/45 bg-og-gold/10 px-4 py-3 text-left font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-og-gold transition hover:bg-og-gold hover:text-og-ink">
              Token live · CA {shortAddr(OGSCAN_TOKEN_MINT, 5)} · Dev {shortAddr(OGSCAN_DEV_WALLET, 5)}
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
            <section className="relative overflow-hidden rounded-[2rem] border border-og-lime/45 bg-og-lime/10 p-5 shadow-og">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-og-lime/20 blur-3xl" />
              <div className="relative">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-og-lime/55 bg-og-lime/15 text-og-lime">
                  <Search className="h-7 w-7" />
                </div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-og-lime">Primary action</p>
                <h3 className="mt-2 font-display text-4xl font-black uppercase leading-none tracking-tight text-white">Run OG Scanner</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Paste a mint or search a ticker. OG status is based on when the coin was created on-chain — not price, migration, or hype.
                </p>
                <button onClick={onScanClick} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-og-lime bg-og-lime px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-og-ink transition hover:bg-white active:scale-[0.98]">
                  Open scanner now <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={onSwapClick} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-5 py-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/78 transition hover:border-og-cyan hover:text-og-cyan active:scale-[0.98]">
                  Need a quote? Open swap
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl sm:p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <PanelTitle icon={CalendarClock} eyebrow="Direct pages" title="Everything has its own route" />
                <p className="max-w-md font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-muted-foreground">
                  Routes stay intact: /scanner, /snipe-feed, /migrations, /page/6, and every numbered page still works.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {priorityTabs.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} onClick={() => onSwitchTab(tool.id)} featured />
                ))}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {toolGroups.map((group) => (
              <section key={group.title} className="rounded-[1.7rem] border border-white/10 bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <PanelTitle icon={group.Icon} eyebrow={group.eyebrow} title={group.title} />
                <div className="mt-4 grid gap-2">
                  {group.tabs.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => onSwitchTab(tool.id)}
                      className="group flex items-center gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.045] p-3 text-left transition hover:border-og-lime/70 hover:bg-og-lime/5 active:scale-[0.99]"
                    >
                      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", getAccentClass(tool.accent, "icon"))}>
                        <tool.Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-base font-black uppercase leading-none text-white">{tool.label}</span>
                        <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">/{tool.slug} · page {tool.pageNumber}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-og-lime opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

const ToolPage = ({
  tab,
  allTabs,
  activeId,
  onBack,
  onSwitchTab,
  children,
}: {
  tab: TabConfig;
  allTabs: TabConfig[];
  activeId: TabId;
  onBack: () => void;
  onSwitchTab: (nextTab: string) => void;
  children: ReactNode;
}) => {
  const toolTabs: TabConfig[] = allTabs.filter((item: TabConfig) => item.id !== "overview");
  const quickTabs: TabConfig[] = [TAB_BY_ID.scanner, TAB_BY_ID["snipe-feed"], TAB_BY_ID["og-finder"], TAB_BY_ID.migrations];
  const quickTabIds: TabId[] = quickTabs.map((item: TabConfig) => item.id);
  const secondaryTabs: TabConfig[] = toolTabs.filter((item: TabConfig) => !quickTabIds.includes(item.id));
  const accentTextClass: string = getAccentClass(tab.accent, "text");

  return (
    <section className="relative min-h-screen overflow-hidden border-b border-white/10 bg-[#010611]">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_-8%,hsl(var(--og-cyan)/0.22),transparent_34%),radial-gradient(circle_at_86%_2%,hsl(var(--og-lime)/0.14),transparent_28%),radial-gradient(circle_at_50%_100%,hsl(var(--og-gold)/0.07),transparent_40%),linear-gradient(180deg,#020915_0%,hsl(var(--background))_55%,#010308_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.055] to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
        <div className="mb-5 overflow-x-auto rounded-[1.35rem] border border-white/10 bg-white/[0.065] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_64px_-52px_hsl(var(--og-cyan))] backdrop-blur-xl ios-scroll xl:hidden">
          <div className="flex min-w-max gap-2">
            <button
              type="button"
              onClick={onBack}
              className="og-pill px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/76 transition hover:border-og-lime hover:text-og-lime active:scale-[0.98]"
            >
              All tools
            </button>
            {toolTabs.map((item: TabConfig) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSwitchTab(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] transition active:scale-[0.98]",
                  activeId === item.id
                    ? "border-og-lime bg-og-lime text-og-ink shadow-[0_0_28px_-12px_hsl(var(--og-lime))]"
                    : "border-white/10 bg-black/20 text-muted-foreground hover:border-og-cyan hover:text-og-cyan",
                )}
              >
                <item.Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[316px_minmax(0,1fr)] xl:items-start">
          <aside className="hidden xl:sticky xl:top-36 xl:block">
            <div className="og-glass-frame p-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={onBack}
                  className="group mb-4 flex w-full items-center justify-between overflow-hidden rounded-[1.35rem] border border-og-lime/35 bg-og-lime/10 p-4 text-left transition hover:bg-og-lime hover:text-og-ink active:scale-[0.99]"
                >
                  <span>
                    <span className="block font-mono text-[9px] font-black uppercase tracking-[0.22em] opacity-70">Workspace map</span>
                    <span className="mt-1 block font-display text-2xl font-black uppercase leading-none">All tools</span>
                  </span>
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>

                <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-mono text-[9px] font-black uppercase tracking-[0.28em] text-og-cyan">Priority tools</div>
                    <span className="rounded-full bg-og-cyan/10 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.2em] text-og-cyan">Fast</span>
                  </div>
                  <div className="space-y-2">
                    {quickTabs.map((item: TabConfig) => (
                      <SideToolButton key={item.id} item={item} activeId={activeId} onSwitchTab={onSwitchTab} />
                    ))}
                  </div>
                </div>

                <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="font-mono text-[9px] font-black uppercase tracking-[0.28em] text-muted-foreground">Standalone pages</div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-og-gold">/{tab.slug}</span>
                </div>
                <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1 ios-scroll">
                  {secondaryTabs.map((item: TabConfig) => (
                    <SideToolButton key={item.id} item={item} activeId={activeId} onSwitchTab={onSwitchTab} compact />
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="og-glass-frame mb-5 p-0">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-og-cyan via-og-lime to-white" />
              <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch">
                <div className="flex min-w-0 flex-col justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <div className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-[1.35rem] border backdrop-blur", getAccentClass(tab.accent, "icon"))}>
                      <tab.Icon className="h-8 w-8" />
                    </div>
                    <div className="min-w-0">
                      <div className={cn("mb-2 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.3em]", accentTextClass)}>
                        <span className="h-px w-9 bg-current" /> {tab.eyebrow}
                      </div>
                      <h1 className="font-display text-4xl font-black uppercase leading-none tracking-tighter text-foreground text-glow sm:text-6xl lg:text-7xl">
                        {tab.label}
                      </h1>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base">
                        {tab.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 font-mono text-[9px] font-black uppercase tracking-[0.2em]">
                    <span className={cn("og-pill px-3 py-2", accentTextClass)}>
                      <tab.Icon className="h-3.5 w-3.5" /> /{tab.slug}
                    </span>
                    <span className="og-pill px-3 py-2 text-og-cyan">/page/{tab.pageNumber}</span>
                    <span className="og-pill px-3 py-2 text-og-gold">page-{tab.pageNumber}</span>
                    <span className="og-pill px-3 py-2 text-white/62">WebView ready</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => onSwitchTab("scanner")}
                    className="group relative overflow-hidden rounded-[1.3rem] border border-og-lime bg-og-lime px-4 py-4 text-left text-og-ink shadow-[0_0_40px_-16px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.985]"
                  >
                    <span className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/40 blur-2xl transition group-hover:translate-x-2" />
                    <span className="relative flex items-center justify-between gap-3">
                      <span>
                        <span className="block font-mono text-[9px] font-black uppercase tracking-[0.24em] opacity-70">Need proof?</span>
                        <span className="mt-1 block font-display text-xl font-black uppercase leading-none">Run scanner</span>
                      </span>
                      <Search className="h-5 w-5" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded-[1.3rem] border border-white/10 bg-white/[0.065] px-4 py-4 text-left font-mono text-[10px] font-black uppercase leading-relaxed tracking-[0.2em] text-white/76 transition hover:border-og-cyan hover:text-og-cyan active:scale-[0.985]"
                  >
                    Back to organized tool grid <ChevronRight className="ml-2 inline h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="og-glass-frame p-3 sm:p-5">
              <div className="relative mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className={cn("mb-1 flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.28em]", accentTextClass)}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_16px_currentColor]" /> Tool canvas starts here
                  </div>
                  <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">{tab.label} workspace</h2>
                </div>
                <div className="flex flex-wrap gap-2 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="og-pill px-3 py-2">Dedicated page</span>
                  <span className="og-pill px-3 py-2">Clean boundary</span>
                </div>
              </div>

              <div className="og-tool-shell relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#020917]/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:p-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-cyan/75 to-transparent" />
                <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-og-cyan/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 left-8 h-56 w-56 rounded-full bg-og-lime/8 blur-3xl" />
                <div className="relative">{children}</div>
              </div>

              <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 font-mono text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                <span>Tool canvas ends</span>
                <span className={accentTextClass}>/{tab.slug} · page {tab.pageNumber}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const SideToolButton = ({
  item,
  activeId,
  onSwitchTab,
  compact = false,
}: {
  item: TabConfig;
  activeId: TabId;
  onSwitchTab: (nextTab: string) => void;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={() => onSwitchTab(item.id)}
    className={cn(
      "group flex w-full items-center gap-3 overflow-hidden rounded-[1.15rem] border p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition active:scale-[0.99]",
      activeId === item.id
        ? "border-og-lime bg-og-lime text-og-ink shadow-[0_0_30px_-16px_hsl(var(--og-lime))]"
        : "border-white/10 bg-white/[0.05] text-white/76 hover:border-og-lime/65 hover:bg-og-lime/[0.07] hover:text-white",
      compact && "p-2.5",
    )}
  >
    <span className={cn("grid shrink-0 place-items-center rounded-full border", activeId === item.id ? "h-9 w-9 border-og-ink/20 bg-og-ink/10" : getAccentClass(item.accent, "icon"), compact ? "h-8 w-8" : "h-9 w-9")}>
      <item.Icon className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-display text-sm font-black uppercase leading-none">{item.label}</span>
      <span className={cn("mt-1 block truncate font-mono text-[8px] uppercase tracking-[0.18em]", activeId === item.id ? "text-og-ink/70" : "text-muted-foreground")}>
        /{item.slug} · page {item.pageNumber}
      </span>
    </span>
    <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition", activeId === item.id ? "text-og-ink/70" : "text-og-cyan opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100")} />
  </button>
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
    onClick={onClick}
    className={cn(
      "group relative min-h-[170px] overflow-hidden rounded-[1.55rem] border border-white/10 bg-white/[0.055] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_64px_-52px_hsl(var(--og-cyan))] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-og-lime hover:bg-og-lime/[0.07] active:scale-[0.99]",
      featured && "border-og-lime/35 bg-og-lime/10 shadow-[0_0_48px_-28px_hsl(var(--og-lime))]",
    )}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-lime/60 to-transparent opacity-0 transition group-hover:opacity-100" />
    <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-full border", getAccentClass(tool.accent, "icon"))}>
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
    if (accent === "white") return "text-og-gold";
    return "text-og-lime";
  }

  if (accent === "gold") return "border-og-gold/50 bg-og-gold/10 text-og-gold shadow-og-gold";
  if (accent === "cyan") return "border-og-cyan/50 bg-og-cyan/10 text-og-cyan";
  if (accent === "white") return "border-foreground/25 bg-foreground/10 text-foreground";
  return "border-og-lime/50 bg-og-lime/10 text-og-lime shadow-og";
};

export default Index;
