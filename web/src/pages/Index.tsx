import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
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
import { DEFAULT_OG_MINT, STORAGE_OG_MINT } from "@/lib/og";

const LEGACY_DEFAULT_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const STORAGE_TAB = "og_scanner.active_site_tab";

type TabId =
  | "overview"
  | "our-coin"
  | "roadmap"
  | "snipe-feed"
  | "scanner"
  | "og-finder"
  | "pairs"
  | "migrations"
  | "trending"
  | "swap"
  | "tech";

type TabAccent = "blue" | "white" | "cyan" | "gold";

type TabConfig = {
  id: TabId;
  label: string;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
};

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Command",
    eyebrow: "MARKET COMMAND",
    description: "OGScan home base with market pulse, safety notice, whales, tape, and tool shortcuts.",
    Icon: Gauge,
    accent: "blue",
  },
  {
    id: "our-coin",
    label: "Token Soon",
    eyebrow: "OFFICIAL NOTICE",
    description: "No public CA yet. A clear launch room that protects users from fake contracts.",
    Icon: Coins,
    accent: "gold",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    eyebrow: "SOLTOOLS VISION",
    description: "The path from OGScan into the crypto-native community layer SolTools is building.",
    Icon: Map,
    accent: "cyan",
  },
  {
    id: "snipe-feed",
    label: "Snipe Feed",
    eyebrow: "DEV WALLET RADAR",
    description: "Track brand-new launches, repeat creators, watch alerts, and launch quality scores.",
    Icon: Target,
    accent: "cyan",
  },
  {
    id: "scanner",
    label: "Scanner",
    eyebrow: "RUN THE CHAIN",
    description: "Search tickers or paste a mint to inspect token signal, liquidity, holders, and risk.",
    Icon: Search,
    accent: "blue",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    eyebrow: "ORIGIN CHECK",
    description: "Separate the first trusted token from weak copycats using history and market quality.",
    Icon: Crosshair,
    accent: "white",
  },
  {
    id: "pairs",
    label: "Pairs",
    eyebrow: "NEW PAIR RADAR",
    description: "Monitor fresh Solana pairs before they hit timeline hype.",
    Icon: Radar,
    accent: "cyan",
  },
  {
    id: "migrations",
    label: "Migrations",
    eyebrow: "BREAKOUT WATCH",
    description: "Find launches leaving chaos behind and moving into stronger liquidity.",
    Icon: Rocket,
    accent: "gold",
  },
  {
    id: "trending",
    label: "Trending",
    eyebrow: "MARKET HEAT",
    description: "See what is actually moving across Solana right now.",
    Icon: Flame,
    accent: "cyan",
  },
  {
    id: "swap",
    label: "Swap",
    eyebrow: "JUPITER ROUTE",
    description: "Search coins and quote routes while keeping scanner context nearby.",
    Icon: Zap,
    accent: "blue",
  },
  {
    id: "tech",
    label: "Tech",
    eyebrow: "DATA PIPELINE",
    description: "The APIs and systems powering OG detection, candles, live tape, and token intel.",
    Icon: Cpu,
    accent: "white",
  },
];

const navItems = TABS.map((tab) => ({ id: tab.id, label: tab.label }));

const Index = () => {
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    try {
      const savedMint: string | null = localStorage.getItem(STORAGE_OG_MINT);
      if (savedMint && savedMint !== LEGACY_DEFAULT_MINT) {
        setMint(savedMint);
      } else {
        localStorage.setItem(STORAGE_OG_MINT, DEFAULT_OG_MINT);
      }

      const savedTab: string | null = localStorage.getItem(STORAGE_TAB);
      if (savedTab && TABS.some((item) => item.id === savedTab)) {
        setTab(savedTab as TabId);
      }
    } catch {
      /* localStorage can be unavailable in restricted browser contexts */
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const activeTab: TabConfig = useMemo<TabConfig>(() => TABS.find((item) => item.id === tab) ?? TABS[0], [tab]);

  const switchTab = (nextTab: string): void => {
    const safeTab: TabId = TABS.some((item) => item.id === nextTab) ? (nextTab as TabId) : "overview";
    setTab(safeTab);
    try {
      localStorage.setItem(STORAGE_TAB, safeTab);
    } catch {
      /* noop */
    }
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
          <ToolPage tab={activeTab} onBack={() => switchTab("overview")}>
            {tab === "our-coin" && <OurCoin />}
            {tab === "roadmap" && <SolToolsRoadmap />}
            {tab === "snipe-feed" && <SnipeFeed onSelect={updateMint} />}
            {tab === "scanner" && <Scanner onSelect={updateMint} />}
            {tab === "og-finder" && <OgFinder onSelect={updateMint} />}
            {tab === "pairs" && <PairTracker onSelect={updateMint} />}
            {tab === "migrations" && <Migrations onSelect={updateMint} />}
            {tab === "trending" && <Trending onSelect={updateMint} />}
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

  return (
    <>
      <Hero onScanClick={onScanClick} onSwapClick={onSwapClick} />

      <section className="relative border-b border-og-grid bg-og-ink/60">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.35em] text-og-cyan">
                <span className="h-px w-12 bg-og-cyan" /> SOLTOOLS DECK
              </div>
              <h2 className="font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
                Site UI is back. Tools are separated.
              </h2>
            </div>
            <div className="border border-og-gold/45 bg-og-gold/10 px-4 py-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.24em] text-og-gold lg:max-w-sm">
              No token out yet · Coming soon · Ignore fake CAs
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
            <section className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
              <div className="mb-4 flex items-center justify-between gap-3">
                <PanelTitle icon={ShieldCheck} eyebrow="Official notice" title="Token safety banner" />
                <button onClick={() => onSwitchTab("our-coin")} className="border border-og-gold/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-og-gold transition hover:bg-og-gold hover:text-og-ink">
                  Open
                </button>
              </div>
              <div className="relative overflow-hidden border border-og-gold/35 bg-og-gold/5 p-5">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-og-gold/10 blur-3xl" />
                <div className="relative">
                  <p className="font-display text-4xl font-black uppercase leading-none tracking-tighter text-og-gold text-glow-gold sm:text-5xl">
                    No token out yet.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    OGScan has no public contract address or official chart live. This dashboard remains focused on scanning and discovery until launch.
                  </p>
                </div>
              </div>
            </section>

            <section className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
              <PanelTitle icon={Activity} eyebrow="Live overview" title="Market pulse" />
              <div className="mt-4">
                <OgStats mint={mint} onSelect={onSelectMint} />
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
              <PanelTitle icon={Target} eyebrow="Quick launch" title="Open a tool" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                {featuredTabs.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} onClick={() => onSwitchTab(tool.id)} />
                ))}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
              <div className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
                <PanelTitle icon={Radar} eyebrow="Wallet radar" title="Whales" />
                <div className="mt-4 border border-og-grid bg-black/20 p-3">
                  <Whales mint={mint} />
                </div>
              </div>
              <div className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
                <PanelTitle icon={Activity} eyebrow="Tape" title="Live transactions" />
                <div className="mt-4 border border-og-grid bg-black/20 p-3">
                  <TxFeed mint={mint} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
};

const ToolPage = ({ tab, onBack, children }: { tab: TabConfig; onBack: () => void; children: ReactNode }) => {
  return (
    <section className="relative min-h-screen border-b border-og-grid bg-background">
      <div className="absolute inset-0 grid-bg opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--og-lime)/0.1),transparent_34%),linear-gradient(180deg,hsl(var(--og-ink)/0.25),hsl(var(--background)))]" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-5 border border-og-grid bg-og-ink/88 p-4 shadow-og sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className={cn("grid h-14 w-14 shrink-0 place-items-center border", getAccentClass(tab.accent, "icon"))}>
                <tab.Icon className="h-7 w-7" />
              </div>
              <div>
                <div className={cn("mb-2 font-mono text-[10px] uppercase tracking-[0.34em]", getAccentClass(tab.accent, "text"))}>
                  {tab.eyebrow}
                </div>
                <h1 className="font-display text-4xl font-black uppercase leading-none tracking-tighter text-foreground sm:text-6xl">
                  {tab.label}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {tab.description}
                </p>
              </div>
            </div>
            <button onClick={onBack} className="inline-flex items-center justify-center gap-2 border border-og-grid bg-black/20 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime">
              Command deck <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="border border-og-grid bg-og-ink/72 p-3 shadow-og sm:p-5">
          {children}
        </div>
      </div>
    </section>
  );
};

const PanelTitle = ({ icon: Icon, eyebrow, title }: { icon: ComponentType<{ className?: string }>; eyebrow: string; title: string }) => (
  <div>
    <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
      <Icon className="h-3.5 w-3.5" /> {eyebrow}
    </div>
    <h3 className="font-display text-2xl font-black uppercase tracking-tight text-foreground">{title}</h3>
  </div>
);

const ToolCard = ({ tool, onClick }: { tool: TabConfig; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group relative min-h-[132px] overflow-hidden border border-og-grid bg-black/22 p-4 text-left transition hover:border-og-lime hover:bg-og-lime/5"
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-lime/50 to-transparent opacity-0 transition group-hover:opacity-100" />
    <div className={cn("mb-3 grid h-10 w-10 place-items-center border", getAccentClass(tool.accent, "icon"))}>
      <tool.Icon className="h-5 w-5" />
    </div>
    <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">{tool.eyebrow}</div>
    <div className="mt-1 flex items-center justify-between gap-3">
      <span className="font-display text-xl font-black uppercase tracking-tight text-foreground">{tool.label}</span>
      <ChevronRight className="h-4 w-4 text-og-lime opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
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
