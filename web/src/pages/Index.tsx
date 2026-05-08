import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Coins,
  Compass,
  Copy,
  Crosshair,
  Flame,
  Gauge,
  Layers3,
  Map,
  Radar,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { Hero } from "@/components/Hero";
import { Migrations } from "@/components/Migrations";
import { OgFinder } from "@/components/OgFinder";
import { OgStats } from "@/components/OgStats";
import { OurCoin } from "@/components/OurCoin";
import { PairTracker } from "@/components/PairTracker";
import { Scanner } from "@/components/Scanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SnipeFeed } from "@/components/SnipeFeed";
import { SolToolsRoadmap } from "@/components/SolToolsRoadmap";
import { StatusStrip } from "@/components/StatusStrip";
import { SwapPanel } from "@/components/SwapPanel";
import { TechStack } from "@/components/TechStack";
import { Trending } from "@/components/Trending";
import { TxFeed } from "@/components/TxFeed";
import { Whales } from "@/components/Whales";
import { cn } from "@/lib/utils";
import { DEFAULT_OG_MINT, STORAGE_OG_MINT, shortAddr } from "@/lib/og";

const LEGACY_DEFAULT_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

type ToolId =
  | "snipe-feed"
  | "scanner"
  | "pairs"
  | "og-finder"
  | "migrations"
  | "trending"
  | "swap"
  | "token"
  | "roadmap"
  | "tech";

type NavId = "home" | ToolId;
type Tone = "blue" | "cyan" | "white" | "gold";

type ToolConfig = {
  id: ToolId;
  label: string;
  shortLabel: string;
  path: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  Icon: ComponentType<{ className?: string }>;
  tone: Tone;
};

type NavItem = {
  id: NavId;
  label: string;
};

export const TOOL_ROUTES: ToolConfig[] = [
  {
    id: "snipe-feed",
    label: "Snipe Feed",
    shortLabel: "Snipe",
    path: "/snipe-feed",
    title: "Live Snipe Feed",
    eyebrow: "new launches",
    subtitle: "A dedicated launch radar page with creator history, risk labels, and fast chart actions.",
    Icon: Target,
    tone: "cyan",
  },
  {
    id: "scanner",
    label: "Scanner",
    shortLabel: "Scanner",
    path: "/scanner",
    title: "Token Scanner",
    eyebrow: "paste ca or ticker",
    subtitle: "Search any Solana token and inspect price, liquidity, holders, history, and market signal.",
    Icon: Search,
    tone: "blue",
  },
  {
    id: "pairs",
    label: "New Pairs",
    shortLabel: "Pairs",
    path: "/pairs",
    title: "New Pair Radar",
    eyebrow: "dex discovery",
    subtitle: "Track fresh pairs as a full workspace instead of burying them in a scrolling dashboard.",
    Icon: Radar,
    tone: "cyan",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    shortLabel: "Finder",
    path: "/og-finder",
    title: "OG Finder",
    eyebrow: "copycat filter",
    subtitle: "Search tickers and separate the real original from low-liquidity clones and copycats.",
    Icon: Crosshair,
    tone: "gold",
  },
  {
    id: "migrations",
    label: "Migrations",
    shortLabel: "Moves",
    path: "/migrations",
    title: "Migration Watch",
    eyebrow: "breakout monitor",
    subtitle: "Find tokens moving from launch chaos into stronger liquidity and cleaner market structure.",
    Icon: Rocket,
    tone: "gold",
  },
  {
    id: "trending",
    label: "Trending",
    shortLabel: "Trending",
    path: "/trending",
    title: "Trending Market",
    eyebrow: "market heat",
    subtitle: "See what is actually moving across Solana right now with a cleaner full-page view.",
    Icon: Flame,
    tone: "cyan",
  },
  {
    id: "swap",
    label: "Swap",
    shortLabel: "Swap",
    path: "/swap",
    title: "Jupiter Swap",
    eyebrow: "route preview",
    subtitle: "Search coins and preview Jupiter routes without the swap widget blending into other tools.",
    Icon: Zap,
    tone: "blue",
  },
  {
    id: "token",
    label: "Token Soon",
    shortLabel: "Token",
    path: "/token",
    title: "No Token Out Yet",
    eyebrow: "official safety room",
    subtitle: "A clear launch notice page so nobody mistakes fake contracts or fake charts for OGScan.",
    Icon: Coins,
    tone: "gold",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    shortLabel: "Roadmap",
    path: "/roadmap",
    title: "SolTools Roadmap",
    eyebrow: "ecosystem plan",
    subtitle: "The path from OGScan tools into the broader SolTools crypto community platform.",
    Icon: Map,
    tone: "white",
  },
  {
    id: "tech",
    label: "Tech Stack",
    shortLabel: "Tech",
    path: "/tech",
    title: "How It Works",
    eyebrow: "data pipeline",
    subtitle: "A technical page for the infrastructure behind OG detection, routing, and live signals.",
    Icon: Layers3,
    tone: "white",
  },
];

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home" },
  ...TOOL_ROUTES.map((tool) => ({ id: tool.id, label: tool.shortLabel })),
];

const normalizePath = (pathname: string): string => pathname.replace(/\/+$/, "") || "/";

const findToolById = (id: ToolId): ToolConfig => TOOL_ROUTES.find((tool) => tool.id === id) ?? TOOL_ROUTES[0];

const getToneFrameClass = (tone: Tone): string => {
  if (tone === "cyan") return "border-og-cyan/45 bg-og-cyan/10 text-og-cyan shadow-[0_24px_90px_-58px_hsl(var(--og-cyan)/0.85)]";
  if (tone === "gold") return "border-og-gold/45 bg-og-gold/10 text-og-gold shadow-[0_24px_90px_-58px_hsl(var(--og-gold)/0.8)]";
  if (tone === "white") return "border-white/25 bg-white/10 text-white shadow-[0_24px_90px_-64px_rgba(255,255,255,0.72)]";
  return "border-og-lime/45 bg-og-lime/10 text-og-lime shadow-[0_24px_90px_-58px_hsl(var(--og-lime)/0.82)]";
};

const getToneGlowClass = (tone: Tone): string => {
  if (tone === "cyan") return "from-og-cyan/24 via-og-lime/8 to-transparent";
  if (tone === "gold") return "from-og-gold/24 via-og-cyan/8 to-transparent";
  if (tone === "white") return "from-white/18 via-og-cyan/8 to-transparent";
  return "from-og-lime/24 via-og-cyan/8 to-transparent";
};

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [headerQuery, setHeaderQuery] = useState<string>("");
  const [scannerQuery, setScannerQuery] = useState<string>("");

  useEffect(() => {
    try {
      const savedMint: string | null = localStorage.getItem(STORAGE_OG_MINT);
      if (savedMint && savedMint !== LEGACY_DEFAULT_MINT) {
        setMint(savedMint);
      } else {
        localStorage.setItem(STORAGE_OG_MINT, DEFAULT_OG_MINT);
      }
    } catch {
      /* localStorage can be unavailable in restricted browser contexts */
    }
  }, []);

  const currentPath: string = normalizePath(location.pathname);
  const activeTool: ToolConfig | null = useMemo<ToolConfig | null>(
    () => TOOL_ROUTES.find((tool) => tool.path === currentPath) ?? null,
    [currentPath],
  );
  const activeNavId: NavId = activeTool?.id ?? "home";

  const navigateTo = useCallback(
    (nextId: NavId): void => {
      if (nextId === "home") {
        navigate("/");
        return;
      }
      navigate(findToolById(nextId).path);
    },
    [navigate],
  );

  const updateMint = useCallback(
    (nextMint: string, nextTool: ToolId = "scanner"): void => {
      setMint(nextMint);
      setHeaderQuery(nextMint);
      setScannerQuery(nextMint);
      try {
        localStorage.setItem(STORAGE_OG_MINT, nextMint);
      } catch {
        /* noop */
      }
      navigate(findToolById(nextTool).path);
    },
    [navigate],
  );

  const runHeaderSearch = useCallback(
    (query?: string): void => {
      const cleanQuery: string = (query ?? headerQuery).trim();
      if (cleanQuery.length < 2) return;

      setHeaderQuery(cleanQuery);
      setScannerQuery(cleanQuery);

      const looksLikeMint: boolean = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanQuery);
      if (looksLikeMint) {
        setMint(cleanQuery);
        try {
          localStorage.setItem(STORAGE_OG_MINT, cleanQuery);
        } catch {
          /* noop */
        }
      }

      navigate(findToolById("scanner").path);
    },
    [headerQuery, navigate],
  );

  const promptMint = useCallback((): void => {
    const nextMint: string | null = window.prompt("Paste any Solana mint address to inspect:", mint);
    if (nextMint && nextMint.trim().length > 20) updateMint(nextMint.trim(), "scanner");
  }, [mint, updateMint]);

  const copyMint = useCallback((): void => {
    void navigator.clipboard?.writeText(mint);
  }, [mint]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-og-ink text-foreground">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_22%_0%,hsl(var(--og-lime)/0.22),transparent_34%),radial-gradient(circle_at_86%_10%,hsl(var(--og-cyan)/0.16),transparent_32%),linear-gradient(180deg,hsl(var(--og-ink)),hsl(var(--background))_44%,hsl(var(--og-ink)))]" />
      <div className="fixed inset-0 grid-bg opacity-35" />
      <div className="fixed inset-0 noise" />

      <div className="relative">
        <SiteHeader
          navItems={NAV_ITEMS}
          activeId={activeNavId}
          mint={mint}
          query={headerQuery}
          onQueryChange={setHeaderQuery}
          onRunSearch={runHeaderSearch}
          onCopyMint={copyMint}
          onNavigate={(id: string) => navigateTo(id as NavId)}
        />
        <StatusStrip mint={mint} onChangeMint={promptMint} />

        <main>
          {activeTool ? (
            <ToolPage
              activeTool={activeTool}
              mint={mint}
              scannerQuery={scannerQuery}
              onSelectMint={updateMint}
              onPromptMint={promptMint}
              onNavigate={navigateTo}
            />
          ) : (
            <HomePage mint={mint} onSelectMint={updateMint} onNavigate={navigateTo} />
          )}
        </main>

        <SiteFooter />
      </div>
    </div>
  );
};

const HomePage = ({
  mint,
  onSelectMint,
  onNavigate,
}: {
  mint: string;
  onSelectMint: (nextMint: string, nextTool?: ToolId) => void;
  onNavigate: (nextId: NavId) => void;
}) => {
  const featuredTools: ToolConfig[] = useMemo<ToolConfig[]>(
    () => TOOL_ROUTES.filter((tool) => tool.id !== "token" && tool.id !== "tech"),
    [],
  );

  return (
    <>
      <Hero onScanClick={() => onNavigate("scanner")} onSwapClick={() => onNavigate("swap")} />

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-10">
        <div className="space-y-5">
          <section className="relative overflow-hidden border border-og-gold/45 bg-og-gold/[0.08] p-5 shadow-og-gold">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,hsl(var(--og-gold)/0.18),transparent_32%),linear-gradient(90deg,hsl(var(--og-gold)/0.08),transparent)]" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-og-gold">
                  <ShieldCheck className="h-4 w-4" /> official token notice
                </div>
                <h2 className="font-display text-3xl font-black uppercase tracking-tight text-og-gold text-glow-gold sm:text-5xl">
                  No token out yet. Coming soon.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  The tools are live, but OGScan has no official contract address or buy chart yet. Anything claiming otherwise is unofficial.
                </p>
              </div>
              <button
                onClick={() => onNavigate("token")}
                className="inline-flex shrink-0 items-center justify-center gap-2 border border-og-gold bg-og-gold px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-ink transition hover:bg-transparent hover:text-og-gold"
              >
                Open safety page <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.34em] text-og-cyan">
                  <Compass className="h-4 w-4" /> page directory
                </div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-og-gold">Pick one tool. Open one page.</h2>
              </div>
              <span className="border border-og-grid bg-black/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                no endless tool stack
              </span>
            </div>
            <ToolDirectoryGrid tools={featuredTools} onNavigate={onNavigate} />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
            <MiniHeader icon={Activity} title="Market Pulse" action="Live" />
            <div className="mt-4 overflow-hidden border border-og-grid bg-black/25 p-3">
              <OgStats mint={mint} onSelect={(nextMint: string) => onSelectMint(nextMint, "scanner")} />
            </div>
          </section>

          <section className="grid gap-4">
            <MiniPanel title="Whales" icon={Wallet} tone="cyan">
              <Whales mint={mint} />
            </MiniPanel>
            <MiniPanel title="Live Tape" icon={BarChart3} tone="gold">
              <TxFeed mint={mint} compact />
            </MiniPanel>
          </section>
        </aside>
      </section>
    </>
  );
};

const ToolPage = ({
  activeTool,
  mint,
  scannerQuery,
  onSelectMint,
  onPromptMint,
  onNavigate,
}: {
  activeTool: ToolConfig;
  mint: string;
  scannerQuery: string;
  onSelectMint: (nextMint: string, nextTool?: ToolId) => void;
  onPromptMint: () => void;
  onNavigate: (nextId: NavId) => void;
}) => {
  return (
    <section className="mx-auto min-h-[calc(100vh-9rem)] max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-32 space-y-4">
            <ToolRail activeId={activeTool.id} onNavigate={onNavigate} />
            <section className="border border-og-grid bg-og-ink/78 p-4 shadow-og">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-og-cyan">
                <Copy className="h-3.5 w-3.5" /> target ca
              </div>
              <div className="break-all font-mono text-xs text-muted-foreground">{shortAddr(mint, 6)}</div>
              <button
                onClick={onPromptMint}
                className="mt-3 w-full border border-og-grid px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime"
              >
                Change target
              </button>
            </section>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <ToolHeroCard tool={activeTool} />
          <div className="relative overflow-hidden border border-og-grid bg-og-ink/86 p-3 shadow-og sm:p-5">
            <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b opacity-75", getToneGlowClass(activeTool.tone))} />
            <div className="relative min-w-0">{renderTool(activeTool.id, mint, scannerQuery, onSelectMint, onPromptMint)}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

function renderTool(
  id: ToolId,
  mint: string,
  scannerQuery: string,
  onSelectMint: (nextMint: string, nextTool?: ToolId) => void,
  onPromptMint: () => void,
): ReactNode {
  switch (id) {
    case "snipe-feed":
      return <SnipeFeed onSelect={(nextMint: string) => onSelectMint(nextMint, "scanner")} />;
    case "scanner":
      return <Scanner onSelect={(nextMint: string) => onSelectMint(nextMint, "scanner")} initialQuery={scannerQuery} />;
    case "pairs":
      return <PairTracker onSelect={(nextMint: string) => onSelectMint(nextMint, "scanner")} />;
    case "og-finder":
      return <OgFinder onSelect={(nextMint: string) => onSelectMint(nextMint, "scanner")} />;
    case "migrations":
      return <Migrations onSelect={(nextMint: string) => onSelectMint(nextMint, "scanner")} />;
    case "trending":
      return <Trending onSelect={(nextMint: string) => onSelectMint(nextMint, "scanner")} />;
    case "swap":
      return <SwapPanel ogMint={mint} onSelectMint={(nextMint: string) => onSelectMint(nextMint, "swap")} />;
    case "token":
      return <OurCoin />;
    case "roadmap":
      return <SolToolsRoadmap />;
    case "tech":
      return <TechStack />;
    default:
      return null;
  }
}

const ToolHeroCard = ({ tool }: { tool: ToolConfig }) => (
  <section className="relative overflow-hidden border border-og-grid bg-og-ink/88 p-5 shadow-og sm:p-7">
    <div className="absolute inset-0 grid-bg opacity-40" />
    <div className={cn("absolute inset-0 bg-gradient-to-br", getToneGlowClass(tool.tone))} />
    <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <span className={cn("grid h-14 w-14 place-items-center border", getToneFrameClass(tool.tone))}>
            <tool.Icon className="h-7 w-7" />
          </span>
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.34em] text-og-cyan">{tool.eyebrow}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{tool.path}</div>
          </div>
        </div>
        <h1 className="font-display text-[clamp(2.5rem,7vw,5.8rem)] font-black uppercase leading-[0.86] tracking-tighter text-og-gold text-glow-gold">
          {tool.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-foreground/78 sm:text-lg">{tool.subtitle}</p>
      </div>
      <div className="border border-og-grid bg-black/30 px-4 py-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-muted-foreground md:max-w-xs md:text-right">
        Dedicated page view. Header tab active. No stacked scrolling tool chaos.
      </div>
    </div>
  </section>
);

const ToolRail = ({ activeId, onNavigate }: { activeId: ToolId; onNavigate: (nextId: NavId) => void }) => (
  <nav className="border border-og-grid bg-og-ink/80 p-2 shadow-og" aria-label="Tool pages">
    <button
      onClick={() => onNavigate("home")}
      className="mb-2 flex w-full items-center gap-2 border border-og-grid bg-black/30 px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition hover:border-og-lime hover:text-og-lime"
    >
      <Gauge className="h-3.5 w-3.5" /> Home
    </button>
    <div className="space-y-1">
      {TOOL_ROUTES.map((tool) => {
        const isActive: boolean = activeId === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onNavigate(tool.id)}
            className={cn(
              "group flex w-full items-center gap-2 border px-3 py-2.5 text-left transition",
              isActive
                ? "border-og-lime bg-og-lime text-og-ink"
                : "border-transparent text-muted-foreground hover:border-og-grid hover:bg-og-lime/[0.08] hover:text-og-lime",
            )}
          >
            <tool.Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-[0.2em]">{tool.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

const ToolDirectoryGrid = ({ tools, onNavigate }: { tools: ToolConfig[]; onNavigate: (nextId: NavId) => void }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {tools.map((tool) => (
      <button
        key={tool.id}
        onClick={() => onNavigate(tool.id)}
        className="group relative min-h-[174px] overflow-hidden border border-og-grid bg-black/24 p-4 text-left transition hover:-translate-y-0.5 hover:border-og-lime hover:bg-og-lime/6"
      >
        <div className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-0 transition group-hover:opacity-100", getToneGlowClass(tool.tone))} />
        <div className="relative flex h-full flex-col">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className={cn("grid h-11 w-11 place-items-center border", getToneFrameClass(tool.tone))}>
              <tool.Icon className="h-5 w-5" />
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-og-lime" />
          </div>
          <div className="font-display text-xl font-bold tracking-tight text-foreground">{tool.label}</div>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{tool.subtitle}</p>
          <div className="mt-auto pt-4 font-mono text-[9px] uppercase tracking-[0.24em] text-og-cyan">Open page</div>
        </div>
      </button>
    ))}
  </div>
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
  <section className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
    <MiniHeader icon={Icon} title={title} action={tone === "gold" ? "Tape" : "Watch"} />
    <div className="mt-4 overflow-hidden border border-og-grid bg-black/24 p-3">{children}</div>
  </section>
);

const MiniHeader = ({ icon: Icon, title, action }: { icon: ComponentType<{ className?: string }>; title: string; action: string }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-foreground">
      <Icon className="h-5 w-5 text-og-cyan" /> {title}
    </div>
    <span className="border border-og-grid bg-black/30 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{action}</span>
  </div>
);

export default Index;
