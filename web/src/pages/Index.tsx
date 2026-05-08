import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronRight,
  Coins,
  Copy,
  Crosshair,
  Flame,
  Gauge,
  Layers3,
  Map,
  MoreHorizontal,
  Radar,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
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
import { SolToolsRoadmap } from "@/components/SolToolsRoadmap";
import { cn } from "@/lib/utils";
import { DEFAULT_OG_MINT, OGSCAN_X_URL, shortAddr, STORAGE_OG_MINT } from "@/lib/og";

const LEGACY_DEFAULT_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const STORAGE_TAB = "og_scanner.active_tab";

type TabId =
  | "home"
  | "snipe-feed"
  | "scanner"
  | "pairs"
  | "more"
  | "our-coin"
  | "roadmap"
  | "og-finder"
  | "migrations"
  | "trending"
  | "swap"
  | "tech";

type Tone = "blue" | "cyan" | "white" | "gold";

type TabConfig = {
  id: TabId;
  label: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  Icon: ComponentType<{ className?: string }>;
  tone: Tone;
};

const TABS: TabConfig[] = [
  {
    id: "home",
    label: "Home",
    shortLabel: "Home",
    title: "OGScan",
    subtitle: "A cleaner mobile command center for Solana discovery.",
    Icon: Gauge,
    tone: "blue",
  },
  {
    id: "snipe-feed",
    label: "Snipe Feed",
    shortLabel: "Snipe",
    title: "Live Snipe Feed",
    subtitle: "New launches, creator history, risk labels, and fast actions.",
    Icon: Target,
    tone: "cyan",
  },
  {
    id: "scanner",
    label: "Scanner",
    shortLabel: "Scan",
    title: "Token Scanner",
    subtitle: "Paste a mint and inspect signal, holders, tape, and market data.",
    Icon: Search,
    tone: "blue",
  },
  {
    id: "pairs",
    label: "New Pairs",
    shortLabel: "Pairs",
    title: "New Pair Radar",
    subtitle: "Track fresh Solana pairs before the timeline catches up.",
    Icon: Radar,
    tone: "cyan",
  },
  {
    id: "more",
    label: "More",
    shortLabel: "More",
    title: "Tool Library",
    subtitle: "Every SolTools screen, separated into clean app pages.",
    Icon: MoreHorizontal,
    tone: "white",
  },
  {
    id: "our-coin",
    label: "Token Soon",
    shortLabel: "Token",
    title: "Token Coming Soon",
    subtitle: "No official CA yet. This screen keeps launch info safe and clear.",
    Icon: Coins,
    tone: "gold",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    shortLabel: "Roadmap",
    title: "SolTools Roadmap",
    subtitle: "The path from OGScan tools into a full crypto community layer.",
    Icon: Map,
    tone: "cyan",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    shortLabel: "Finder",
    title: "OG Finder",
    subtitle: "Search tickers and separate the original from copycats.",
    Icon: Crosshair,
    tone: "blue",
  },
  {
    id: "migrations",
    label: "Migrations",
    shortLabel: "Moves",
    title: "Migration Watch",
    subtitle: "Find tokens breaking out of launch chaos into real liquidity.",
    Icon: Rocket,
    tone: "gold",
  },
  {
    id: "trending",
    label: "Trending",
    shortLabel: "Trend",
    title: "Trending Market",
    subtitle: "See what is actually moving across Solana right now.",
    Icon: Flame,
    tone: "cyan",
  },
  {
    id: "swap",
    label: "Swap",
    shortLabel: "Swap",
    title: "Jupiter Swap",
    subtitle: "Search coins and route swaps while keeping scanner context.",
    Icon: Zap,
    tone: "blue",
  },
  {
    id: "tech",
    label: "Tech Stack",
    shortLabel: "Tech",
    title: "How It Works",
    subtitle: "The data pipeline behind OG detection and live Solana signals.",
    Icon: Layers3,
    tone: "white",
  },
];

const PRIMARY_TAB_IDS: TabId[] = ["home", "snipe-feed", "scanner", "pairs", "more"];

const getToneRingClass = (tone: Tone): string => {
  if (tone === "cyan") return "border-sky-300/35 bg-sky-300/10 text-sky-200 shadow-[0_18px_60px_-36px_rgba(125,211,252,0.9)]";
  if (tone === "gold") return "border-amber-200/35 bg-amber-200/10 text-amber-100 shadow-[0_18px_60px_-36px_rgba(253,230,138,0.9)]";
  if (tone === "white") return "border-white/20 bg-white/10 text-white shadow-[0_18px_60px_-42px_rgba(255,255,255,0.8)]";
  return "border-blue-300/35 bg-blue-400/10 text-blue-100 shadow-[0_18px_60px_-36px_rgba(96,165,250,0.9)]";
};

const getToneTextClass = (tone: Tone): string => {
  if (tone === "cyan") return "text-sky-200";
  if (tone === "gold") return "text-amber-100";
  if (tone === "white") return "text-white";
  return "text-blue-100";
};

const getAccentGlowClass = (tone: Tone): string => {
  if (tone === "cyan") return "from-sky-400/30 via-cyan-300/10 to-transparent";
  if (tone === "gold") return "from-amber-300/30 via-white/10 to-transparent";
  if (tone === "white") return "from-white/20 via-slate-300/10 to-transparent";
  return "from-blue-500/30 via-sky-300/10 to-transparent";
};

const Index = () => {
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [tab, setTab] = useState<TabId>("home");

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
  const bottomActiveId: TabId = PRIMARY_TAB_IDS.includes(tab) ? tab : "more";
  const moreTools: TabConfig[] = useMemo<TabConfig[]>(
    () => TABS.filter((item) => !PRIMARY_TAB_IDS.includes(item.id)),
    [],
  );

  const switchTab = (nextTab: TabId): void => {
    setTab(nextTab);
    try {
      localStorage.setItem(STORAGE_TAB, nextTab);
    } catch {
      /* noop */
    }
  };

  const updateMint = (nextMint: string, nextTab: TabId = "home"): void => {
    setMint(nextMint);
    try {
      localStorage.setItem(STORAGE_OG_MINT, nextMint);
    } catch {
      /* noop */
    }
    switchTab(nextTab);
  };

  const promptMint = (): void => {
    const nextMint: string | null = window.prompt("Paste any Solana mint address to inspect:", mint);
    if (nextMint && nextMint.trim().length > 20) updateMint(nextMint.trim(), "scanner");
  };

  const copyMint = (): void => {
    void navigator.clipboard?.writeText(mint);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#02040b] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(59,130,246,0.34),transparent_38%),radial-gradient(circle_at_90%_8%,rgba(34,211,238,0.16),transparent_30%),linear-gradient(180deg,#07111f_0%,#02040b_45%,#02040b_100%)]" />
      <div className="fixed inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden border-x border-white/10 bg-[#07101d]/92 shadow-[0_0_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <NativeTopBar activeTab={activeTab} mint={mint} onChangeMint={promptMint} onCopyMint={copyMint} />

        <main className="ios-scroll min-h-[calc(100vh-88px)] px-4 pb-32 pt-4">
          {tab === "home" && <HomeScreen mint={mint} onSelectMint={updateMint} onSwitchTab={switchTab} onChangeMint={promptMint} />}
          {tab === "snipe-feed" && (
            <ToolScreen tab={activeTab} trailing={<LiveBadge label="New launches" />}>
              <SnipeFeed onSelect={updateMint} />
            </ToolScreen>
          )}
          {tab === "scanner" && (
            <ToolScreen tab={activeTab} trailing={<button onClick={promptMint} className="ios-mini-button">Paste CA</button>}>
              <Scanner onSelect={updateMint} />
            </ToolScreen>
          )}
          {tab === "pairs" && (
            <ToolScreen tab={activeTab} trailing={<LiveBadge label="Pair radar" />}>
              <PairTracker onSelect={updateMint} />
            </ToolScreen>
          )}
          {tab === "more" && <MoreScreen tools={moreTools} onSwitchTab={switchTab} />}
          {tab === "our-coin" && (
            <ToolScreen tab={activeTab} trailing={<LiveBadge label="No CA yet" tone="gold" />}>
              <OurCoin />
            </ToolScreen>
          )}
          {tab === "roadmap" && (
            <ToolScreen tab={activeTab} trailing={<LiveBadge label="Vision" />}>
              <SolToolsRoadmap />
            </ToolScreen>
          )}
          {tab === "og-finder" && (
            <ToolScreen tab={activeTab} trailing={<button onClick={promptMint} className="ios-mini-button">Target</button>}>
              <OgFinder onSelect={updateMint} />
            </ToolScreen>
          )}
          {tab === "migrations" && (
            <ToolScreen tab={activeTab} trailing={<LiveBadge label="Breakouts" tone="gold" />}>
              <Migrations onSelect={updateMint} />
            </ToolScreen>
          )}
          {tab === "trending" && (
            <ToolScreen tab={activeTab} trailing={<LiveBadge label="Market heat" />}>
              <Trending onSelect={updateMint} />
            </ToolScreen>
          )}
          {tab === "swap" && (
            <ToolScreen tab={activeTab} trailing={<button onClick={promptMint} className="ios-mini-button">Target</button>}>
              <SwapPanel ogMint={mint} onSelectMint={(nextMint: string) => updateMint(nextMint, "swap")} />
            </ToolScreen>
          )}
          {tab === "tech" && (
            <ToolScreen tab={activeTab} trailing={<LiveBadge label="Pipeline" tone="white" />}>
              <TechStack />
            </ToolScreen>
          )}
        </main>

        <BottomTabs activeId={bottomActiveId} onSwitchTab={switchTab} />
      </div>
    </div>
  );
};

const NativeTopBar = ({
  activeTab,
  mint,
  onChangeMint,
  onCopyMint,
}: {
  activeTab: TabConfig;
  mint: string;
  onChangeMint: () => void;
  onCopyMint: () => void;
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07101d]/82 px-4 pb-3 pt-4 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2.5">
          <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-[1rem] border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
            <img src="/icon.png" alt="OGScan" className="h-full w-full scale-110 object-cover" />
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-[#07101d] bg-sky-300" />
          </span>
          <span>
            <span className="block text-[15px] font-black tracking-tight text-white">OGScan</span>
            <span className="block text-[11px] font-semibold text-white/45">SolTools mobile beta</span>
          </span>
        </a>

        <button
          onClick={onChangeMint}
          className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-[11px] font-bold text-white/75 active:scale-95"
        >
          Change CA
        </button>
      </div>

      <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.075] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.9)]" />
              current screen
            </div>
            <h1 className="truncate text-[28px] font-black leading-none tracking-[-0.05em] text-white">{activeTab.title}</h1>
          </div>
          <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-[1.05rem] border", getToneRingClass(activeTab.tone))}>
            <activeTab.Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1 pl-3">
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/55">Target: {shortAddr(mint, 5)}</span>
          <button
            onClick={onCopyMint}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 active:scale-95"
            aria-label="Copy target contract address"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

const HomeScreen = ({
  mint,
  onSelectMint,
  onSwitchTab,
  onChangeMint,
}: {
  mint: string;
  onSelectMint: (nextMint: string, nextTab?: TabId) => void;
  onSwitchTab: (nextTab: TabId) => void;
  onChangeMint: () => void;
}) => {
  const featuredTools: TabConfig[] = TABS.filter((item) => item.id !== "home" && item.id !== "more");

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(125,211,252,0.22),transparent_35%),radial-gradient(circle_at_100%_20%,rgba(59,130,246,0.24),transparent_32%)]" />
        <div className="relative">
          <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35">
            <img src="/og-brand.jpg" alt="OG Scan radar banner" className="h-40 w-full object-contain p-4" />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-sky-200">
            <Sparkles className="h-3.5 w-3.5" /> iOS-style redesign
          </div>
          <h2 className="mt-2 text-[38px] font-black leading-[0.9] tracking-[-0.07em] text-white">
            Crypto tools that feel like an app.
          </h2>
          <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-white/58">
            Bottom tabs, separated screens, native cards, and no more endless chaotic dashboard.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={() => onSwitchTab("snipe-feed")} className="ios-primary-button">
              <Target className="h-4 w-4" /> Live Feed
            </button>
            <button onClick={() => onSwitchTab("scanner")} className="ios-secondary-button">
              <Search className="h-4 w-4" /> Scan Token
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[1.65rem] border border-amber-200/20 bg-amber-200/[0.08] p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">
          <ShieldCheck className="h-4 w-4" /> Official token notice
        </div>
        <p className="text-xl font-black tracking-[-0.04em] text-white">No token out yet. Coming soon.</p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-white/55">
          No public CA or official chart is live. This protects the community from fake contracts.
        </p>
        <button onClick={() => onSwitchTab("our-coin")} className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-amber-100">
          Open token room <ChevronRight className="h-4 w-4" />
        </button>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Activity} title="Market Pulse" action="Live" />
        <div className="ios-tool-surface">
          <OgStats mint={mint} onSelect={onSelectMint} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Bell} title="Tool Stack" action="Swipe-ready" />
        <div className="grid grid-cols-2 gap-3">
          {featuredTools.map((tool) => (
            <ToolLauncherCard key={tool.id} tool={tool} onPress={() => onSwitchTab(tool.id)} />
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <MiniPanel title="Whales" icon={Wallet} tone="cyan">
          <Whales mint={mint} />
        </MiniPanel>
        <MiniPanel title="Live Tape" icon={BarChart3} tone="gold">
          <TxFeed mint={mint} />
        </MiniPanel>
      </section>

      <button onClick={onChangeMint} className="w-full rounded-[1.4rem] border border-white/10 bg-white/[0.07] px-4 py-4 text-sm font-black text-white/75 active:scale-[0.99]">
        Change scan target
      </button>
    </div>
  );
};

const ToolScreen = ({ tab, trailing, children }: { tab: TabConfig; trailing?: ReactNode; children: ReactNode }) => {
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
        <div className={cn("absolute inset-0 bg-gradient-to-br", getAccentGlowClass(tab.tone))} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={cn("mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em]", getToneTextClass(tab.tone))}>
              <tab.Icon className="h-3.5 w-3.5" /> app page
            </div>
            <h2 className="text-[34px] font-black leading-[0.92] tracking-[-0.07em] text-white">{tab.title}</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-white/56">{tab.subtitle}</p>
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
      </section>

      <div className="ios-tool-surface">{children}</div>
    </div>
  );
};

const MoreScreen = ({ tools, onSwitchTab }: { tools: TabConfig[]; onSwitchTab: (nextTab: TabId) => void }) => {
  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/45">
          <MoreHorizontal className="h-4 w-4" /> all screens
        </div>
        <h2 className="text-[36px] font-black leading-[0.9] tracking-[-0.07em] text-white">Every tool has its own page.</h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-white/55">
          Tap a screen below. Each opens as a clean full-page app view instead of blending into one long feed.
        </p>
      </section>

      <div className="grid gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onSwitchTab(tool.id)}
            className="group flex items-center gap-3 rounded-[1.45rem] border border-white/10 bg-white/[0.07] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-[0.99]"
          >
            <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-[1.05rem] border", getToneRingClass(tool.tone))}>
              <tool.Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-black text-white">{tool.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs font-medium leading-relaxed text-white/45">{tool.subtitle}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/25 transition group-hover:text-white/65" />
          </button>
        ))}
      </div>
    </div>
  );
};

const BottomTabs = ({ activeId, onSwitchTab }: { activeId: TabId; onSwitchTab: (nextTab: TabId) => void }) => {
  const primaryTabs: TabConfig[] = TABS.filter((item) => PRIMARY_TAB_IDS.includes(item.id));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] border-t border-white/10 bg-[#07101d]/88 px-3 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-2 backdrop-blur-2xl">
      <div className="grid grid-cols-5 gap-1 rounded-[1.65rem] border border-white/10 bg-black/24 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        {primaryTabs.map((item) => {
          const isActive: boolean = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSwitchTab(item.id)}
              className={cn(
                "group flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[10px] font-black transition active:scale-95",
                isActive ? "bg-white text-[#07101d] shadow-[0_12px_34px_-20px_rgba(255,255,255,0.9)]" : "text-white/45 hover:bg-white/[0.06] hover:text-white/75",
              )}
            >
              <item.Icon className="h-5 w-5" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const ToolLauncherCard = ({ tool, onPress }: { tool: TabConfig; onPress: () => void }) => (
  <button
    onClick={onPress}
    className="group min-h-[132px] rounded-[1.55rem] border border-white/10 bg-white/[0.07] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-[0.98]"
  >
    <span className={cn("mb-3 grid h-11 w-11 place-items-center rounded-[1rem] border", getToneRingClass(tool.tone))}>
      <tool.Icon className="h-5 w-5" />
    </span>
    <span className="block text-[15px] font-black text-white">{tool.label}</span>
    <span className="mt-1 line-clamp-2 block text-xs font-medium leading-relaxed text-white/45">{tool.subtitle}</span>
  </button>
);

const MiniPanel = ({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  children: ReactNode;
}) => (
  <section className="rounded-[1.65rem] border border-white/10 bg-white/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
    <div className={cn("mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]", getToneTextClass(tone))}>
      <Icon className="h-4 w-4" /> {title}
    </div>
    <div className="overflow-hidden rounded-[1.15rem] border border-white/10 bg-black/20 p-2">{children}</div>
  </section>
);

const SectionTitle = ({ icon: Icon, title, action }: { icon: ComponentType<{ className?: string }>; title: string; action: string }) => (
  <div className="flex items-center justify-between px-1">
    <div className="flex items-center gap-2 text-lg font-black tracking-[-0.04em] text-white">
      <Icon className="h-5 w-5 text-sky-200" /> {title}
    </div>
    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/48">{action}</span>
  </div>
);

const LiveBadge = ({ label, tone = "cyan" }: { label: string; tone?: Tone }) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]", getToneRingClass(tone))}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" /> {label}
  </span>
);

export default Index;
