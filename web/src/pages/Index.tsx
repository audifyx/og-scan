import { useEffect, useState } from "react";
import {
  Gauge,
  Search,
  Crosshair,
  Radar,
  Activity,
  Crown,
  Zap,
  Cpu,
  Flame,
  Rocket,
  Coins,
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

const TABS: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "VITALS", Icon: Gauge },
  { id: "our-coin", label: "OUR COIN", Icon: Coins },
  { id: "scanner", label: "SCANNER", Icon: Search },
  { id: "og-finder", label: "OG FINDER", Icon: Crosshair },
  { id: "pairs", label: "NEW PAIRS", Icon: Radar },
  { id: "migrations", label: "MIGRATIONS", Icon: Rocket },
  { id: "trending", label: "TRENDING", Icon: Flame },
  { id: "swap", label: "SWAP", Icon: Zap },
  { id: "tech", label: "TECH", Icon: Cpu },
];

const STORAGE_TAB = "og_scanner.active_tab";

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
    setPendingScrollTarget(shouldScroll ? id : null);
    try {
      localStorage.setItem(STORAGE_TAB, id);
    } catch {
      /* noop */
    }
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
      <Scanlines />

      <SiteHeader mint={mint} />
      <StatusStrip mint={mint} onChangeMint={promptMint} />
      <Marquee />

      <Hero
        onScanClick={() => switchTab("scanner", true)}
        onSwapClick={() => switchTab("swap", true)}
      />

      {/* Tab bar */}
      <div className="sticky top-[88px] z-20 border-b border-og-grid bg-og-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
          {TABS.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => switchTab(tb.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                  active
                    ? "border-og-lime bg-og-lime text-og-ink"
                    : "border-og-grid text-foreground/70 hover:border-og-lime/60 hover:text-og-lime"
                }`}
              >
                <tb.Icon className="h-3 w-3" />
                {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
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
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;
