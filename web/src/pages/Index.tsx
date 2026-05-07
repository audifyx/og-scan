import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronRight,
  Coins,
  Compass,
  Cpu,
  Crosshair,
  Crown,
  Flame,
  Gauge,
  LayoutGrid,
  Radar,
  Rocket,
  Search,
  ShieldCheck,
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
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";
import { DEFAULT_OG_MINT, STORAGE_OG_MINT } from "@/lib/og";

type TabId =
  | "overview"
  | "our-coin"
  | "scanner"
  | "og-finder"
  | "pairs"
  | "migrations"
  | "trending"
  | "swap"
  | "tech";

type TabAccent = "blue" | "white" | "cyan";

type TabConfig = {
  id: TabId;
  label: string;
  eyebrow: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: TabAccent;
};

const TABS: TabConfig[] = [
  { id: "overview", label: "Vitals", eyebrow: "LIVE TOKEN ROOM", description: "Price, liquidity, whales, and real-time tape in one command view.", Icon: Gauge, accent: "blue" },
  { id: "our-coin", label: "Our Coin", eyebrow: "OFFICIAL OG", description: "Brand, links, and the official OG Scan coin destination.", Icon: Coins, accent: "white" },
  { id: "scanner", label: "Scanner", eyebrow: "RUN THE CHAIN", description: "Paste a mint and inspect signal, score, holders, and market data.", Icon: Search, accent: "blue" },
  { id: "og-finder", label: "OG Finder", eyebrow: "FIND THE ORIGIN", description: "Search tickers and separate the real OG from dead copycats.", Icon: Crosshair, accent: "cyan" },
  { id: "pairs", label: "New Pairs", eyebrow: "PAIR RADAR", description: "Watch fresh Solana pairs before the timeline catches up.", Icon: Radar, accent: "blue" },
  { id: "migrations", label: "Migrations", eyebrow: "BREAKOUT WATCH", description: "Track tokens moving from launch chaos into real liquidity.", Icon: Rocket, accent: "white" },
  { id: "trending", label: "Trending", eyebrow: "NARRATIVE HEAT", description: "See what is actually moving across the Solana market.", Icon: Flame, accent: "cyan" },
  { id: "swap", label: "Swap", eyebrow: "JUPITER ROUTER", description: "Search coins and route swaps while keeping the scanner context.", Icon: Zap, accent: "blue" },
  { id: "tech", label: "Tech", eyebrow: "HOW IT WORKS", description: "The data pipeline behind OG detection and live Solana signals.", Icon: Cpu, accent: "white" },
];

const STORAGE_TAB = "og_scanner.active_tab";
const WORKSPACE_ID = "workspace";

const getFeatureButtonClass = (active: boolean, accent: TabAccent) => {
  if (active) {
    if (accent === "white") return "border-og-gold bg-og-gold text-og-ink shadow-og-gold";
    if (accent === "cyan") return "border-og-cyan bg-og-cyan text-og-ink shadow-og";
    return "border-og-lime bg-og-lime text-og-ink shadow-og";
  }

  if (accent === "white") return "border-og-grid bg-og-ink/70 text-foreground/75 hover:border-og-gold hover:bg-og-gold/10 hover:text-og-gold";
  if (accent === "cyan") return "border-og-grid bg-og-ink/70 text-foreground/75 hover:border-og-cyan hover:bg-og-cyan/10 hover:text-og-cyan";
  return "border-og-grid bg-og-ink/70 text-foreground/75 hover:border-og-lime hover:bg-og-lime/10 hover:text-og-lime";
};

const getAccentTextClass = (accent: TabAccent) => {
  if (accent === "white") return "text-og-gold";
  if (accent === "cyan") return "text-og-cyan";
  return "text-og-lime";
};

const Index = () => {
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [tab, setTab] = useState<TabId>("overview");
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_OG_MINT);
      if (saved) setMint(saved);
      const t = localStorage.getItem(STORAGE_TAB) as TabId | null;
      if (t && TABS.some((x) => x.id === t)) setTab(t);
    } catch {
      /* noop */
    }
  }, []);

  const activeTab = useMemo<TabConfig>(() => TABS.find((x) => x.id === tab) ?? TABS[0], [tab]);
  const headerNavItems = useMemo(() => TABS.map(({ id, label }) => ({ id, label })), []);

  const updateMint = (next: string, nextTab: TabId = "overview") => {
    setMint(next);
    try {
      localStorage.setItem(STORAGE_OG_MINT, next);
    } catch {
      /* noop */
    }
    setTab(nextTab);
    try {
      localStorage.setItem(STORAGE_TAB, nextTab);
    } catch {
      /* noop */
    }
  };

  const promptMint = () => {
    const v = window.prompt("Paste $OG mint address (Solana SPL):", mint);
    if (v && v.trim().length > 20) updateMint(v.trim());
  };

  const switchTab = (id: TabId, shouldScroll: boolean = false) => {
    setTab(id);
    setPendingScrollTarget(shouldScroll ? WORKSPACE_ID : null);
    try {
      localStorage.setItem(STORAGE_TAB, id);
    } catch {
      /* noop */
    }
  };

  const handleNavigate = (id: string) => {
    if (TABS.some((x) => x.id === id)) switchTab(id as TabId, true);
  };

  useEffect(() => {
    if (!pendingScrollTarget) return;

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(pendingScrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollTarget(null);
    }, 50);

    return () => window.clearTimeout(scrollTimer);
  }, [pendingScrollTarget, tab]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-og-ink text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,hsl(var(--og-lime)/0.18),transparent_32%),radial-gradient(circle_at_82%_0%,hsl(var(--og-cyan)/0.14),transparent_28%),linear-gradient(180deg,hsl(var(--og-ink)),hsl(var(--background)))]" />
      <Scanlines />

      <SiteHeader mint={mint} navItems={headerNavItems} activeId={tab} onNavigate={handleNavigate} />
      <StatusStrip mint={mint} onChangeMint={promptMint} />
      <Marquee />

      <Hero
        onScanClick={() => switchTab("scanner", true)}
        onSwapClick={() => switchTab("swap", true)}
      />

      <section className="relative border-y border-og-grid bg-og-ink/75 backdrop-blur" aria-labelledby="feature-map-title">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 border border-og-lime/40 bg-og-lime/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-og-lime">
                <LayoutGrid className="h-3.5 w-3.5" /> OG Scan Control Deck
              </div>
              <h2 id="feature-map-title" className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-4xl">
                Pick a lane. Nothing is hidden.
              </h2>
            </div>
            <div className="max-w-xl text-xs uppercase leading-relaxed tracking-[0.2em] text-muted-foreground">
              The old tiny tabs are now a visible launch board: scanner, OG finder, swap, live pairs, tech, and every existing tool stay here.
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TABS.map((tb, index) => (
              <button
                key={tb.id}
                onClick={() => switchTab(tb.id, true)}
                className={cn(
                  "group min-h-28 border p-4 text-left transition duration-200 hover:-translate-y-0.5",
                  getFeatureButtonClass(tab === tb.id, tb.accent),
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center border border-current/35 bg-og-ink/25">
                      <tb.Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-display text-lg font-bold uppercase tracking-tight">{tb.label}</div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.24em] opacity-70">0{index + 1} · {tb.eyebrow}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <p className="mt-3 text-xs leading-relaxed opacity-75">{tb.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <main id={WORKSPACE_ID} className="mx-auto max-w-7xl scroll-mt-32 px-4 py-6 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)] lg:items-start">
          <aside className="hidden lg:block lg:sticky lg:top-[116px]">
            <div className="overflow-hidden border border-og-grid bg-og-ink/82 shadow-og backdrop-blur">
              <div className="border-b border-og-grid bg-og-lime px-4 py-3 text-og-ink">
                <div className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight">
                  <Compass className="h-5 w-5" /> Navigation
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] opacity-75">always visible module list</div>
              </div>
              <div className="grid gap-1 p-2">
                {TABS.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => switchTab(tb.id)}
                    className={cn(
                      "flex items-center gap-3 border px-3 py-3 text-left transition",
                      getFeatureButtonClass(tab === tb.id, tb.accent),
                    )}
                  >
                    <tb.Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.18em]">{tb.label}</span>
                      <span className="mt-0.5 block truncate text-[10px] uppercase tracking-widest opacity-60">{tb.eyebrow}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 border border-og-cyan/40 bg-og-cyan/10 p-4 text-og-cyan">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em]">
                <ShieldCheck className="h-4 w-4" /> Signal first
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                Use Scanner for a mint, OG Finder for a ticker, then Swap when the signal is clean.
              </p>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-4 overflow-hidden border border-og-grid bg-og-ink/78 shadow-og backdrop-blur">
              <div className="flex flex-col gap-4 border-b border-og-grid p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn("grid h-12 w-12 place-items-center border bg-og-ink", getAccentTextClass(activeTab.accent))}>
                    <activeTab.Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className={cn("font-mono text-[10px] uppercase tracking-[0.32em]", getAccentTextClass(activeTab.accent))}>{activeTab.eyebrow}</div>
                    <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-4xl">{activeTab.label}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{activeTab.description}</p>
                  </div>
                </div>
                <button
                  onClick={promptMint}
                  className="inline-flex items-center justify-center gap-2 border border-og-grid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime"
                >
                  Change Mint <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
                <span className="border border-og-grid px-2 py-1">Solana mainnet</span>
                <span className="border border-og-grid px-2 py-1">Live APIs</span>
                <span className="border border-og-grid px-2 py-1">No feature removed</span>
              </div>
            </div>

            {tab === "overview" && (
              <div className="grid gap-4">
                <OgStats mint={mint} onSelect={updateMint} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="border border-og-grid bg-og-ink/70 p-4">
                    <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-og-cyan">
                      <Crown className="h-3 w-3" /> WHALES · LIVE
                    </div>
                    <Whales mint={mint} />
                  </div>
                  <div className="border border-og-grid bg-og-ink/70 p-4">
                    <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-og-gold">
                      <Activity className="h-3 w-3" /> TAPE · LIVE
                    </div>
                    <TxFeed mint={mint} />
                  </div>
                </div>
              </div>
            )}

            {tab === "our-coin" && <OurCoin />}
            {tab === "scanner" && <Scanner onSelect={updateMint} />}
            {tab === "og-finder" && <OgFinder onSelect={updateMint} />}
            {tab === "pairs" && <PairTracker onSelect={updateMint} />}
            {tab === "migrations" && <Migrations onSelect={updateMint} />}
            {tab === "trending" && <Trending onSelect={updateMint} />}
            {tab === "swap" && <SwapPanel ogMint={mint} onSelectMint={(next) => updateMint(next, "swap")} />}
            {tab === "tech" && <TechStack />}
          </section>
        </div>
      </main>

      <SiteFooter navItems={headerNavItems} activeId={tab} onNavigate={handleNavigate} />
    </div>
  );
};

export default Index;
