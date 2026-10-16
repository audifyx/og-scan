import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Bell, Copy, ExternalLink, Flame, Share2, CandlestickChart, Wallet, Info, Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LivingAvatar, type AvatarStats } from "./LivingAvatar";
import { AgentOffice3D } from "./AgentOffice3D";
import { LiveTrades } from "./LiveTrades";
import { fetchRpcSupply, useRpcTrades } from "./rpcFeed";
import { TokenArticle } from "./TokenArticle";
import { TokenChart } from "./TokenChart";
import { BurnTracker } from "./BurnTracker";
import { AIBrief } from "./AIBrief";
import { ShareButton, PriceAlerts, TokenomicsBars, DiamondHands } from "./TokenExtras";
import { WhatIf } from "./WhatIf";
import { EvolutionTimeline } from "./EvolutionTimeline";
import { AmbientToggle } from "./AmbientToggle";
import { TickerTape, StageProgress, StatCard, EvolutionCelebration, useCountUp, fmtUsdShort, fmtPriceSmart, fmtTokens } from "./TokenWidgets";
import { TopScreen, Hinge, BottomScreen, TouchButton, DialogueBox } from "./DS3Shell";
import { thoughtFor, moodForChange } from "./LivingAvatar";
import { THEMES, ThemeSwitcher, ThemeStyles } from "./TokenThemes";
import { RegretCalculator, TokenAge, KonamiCode, DoNotPress, SuggestionBox, Badges, Tamagotchi, WhaleSiren, SupplyCountdown, LoadingTips, unlockBadge } from "./TokenFun";
import { stageForMcap } from "./LivingAvatar";
import { cn } from "@/lib/utils";

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const INITIAL_SUPPLY = 1_000_000_000;

interface DexPair {
  priceUsd?: string;
  marketCap?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  url?: string;
}

async function fetchTokenStats(mint: string) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  if (!res.ok) throw new Error("dexscreener failed");
  const j = await res.json();
  const pairs: DexPair[] = j.pairs ?? [];
  const best = pairs
    .filter((p) => p.priceUsd && p.liquidity?.usd)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? pairs[0];
  if (!best) throw new Error("no pairs");
  return {
    price: parseFloat(best.priceUsd ?? "0"),
    mcap: best.marketCap ?? null,
    liquidity: best.liquidity?.usd ?? null,
    volume24h: best.volume?.h24 ?? null,
    change24h: best.priceChange?.h24 ?? null,
    dexUrl: best.url ?? `https://dexscreener.com/solana/${mint}`,
    pairAddress: best.pairAddress ?? null,
  };
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}


type Tab = "about" | "chart" | "buys" | "burns";

export default function TokenPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("about");
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("orbitx-token-theme") || "orbitx"; } catch { return "orbitx"; }
  });
  const changeTheme = (t: string) => {
    setTheme(t);
    try { localStorage.setItem("orbitx-token-theme", t); } catch { /* ignore */ }
  };

  const { data: stats } = useQuery({
    queryKey: ["orbitx-token-stats"],
    queryFn: () => fetchTokenStats(ORBITX_MINT),
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: supply } = useQuery({
    queryKey: ["orbitx-token-supply"],
    queryFn: () => fetchRpcSupply(ORBITX_MINT),
    refetchInterval: 120_000,
    retry: 1,
  });

  const burned = useMemo(() => {
    if (supply == null) return null;
    return Math.max(0, INITIAL_SUPPLY - supply);
  }, [supply]);

  // Shared live trade feed (powers Live tab + Tamagotchi + Whale siren)
  const feed = useRpcTrades(ORBITX_MINT, 15, 20000);
  const buyCount = useMemo(() => feed.trades.filter((t) => t.side === "BUY").length, [feed.trades]);
  const lastBigBuy = useMemo(() => {
    const big = feed.trades
      .filter((t) => t.side === "BUY" && (t.usd ?? 0) >= 5000)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    return big ? { amountUsd: big.usd ?? 0, time: big.timestamp } : null;
  }, [feed.trades]);

  const avatarStats: AvatarStats = useMemo(
    () => ({
      mcap: stats?.mcap ?? null,
      liquidity: stats?.liquidity ?? null,
      change24h: stats?.change24h ?? null,
      burned,
      price: stats?.price ?? null,
    }),
    [stats, burned]
  );

  useEffect(() => {
    document.title = "ORBITX · Official Token";
    return () => { document.title = "OrbitX"; };
  }, []);

  const copyMint = async () => {
    try {
      await navigator.clipboard.writeText(ORBITX_MINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "ORBITX Token", url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
      window.dispatchEvent(new CustomEvent("orbitx-shared"));
      unlockBadge("shiller");
    } catch { /* ignore */ }
  };

  const change = stats?.change24h;
  const stage = stageForMcap(stats?.mcap ?? null);
  const changeUp = (change ?? 0) >= 0;
  const mood = moodForChange(change);

  // Orbit's dialogue for the top-screen dialogue box (crossfade rotation)
  const [thought, setThought] = useState(() => thoughtFor(avatarStats, stage, mood));
  const [thoughtVisible, setThoughtVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setThoughtVisible(false);
      setTimeout(() => {
        setThought(thoughtFor(avatarStats, stage, mood));
        setThoughtVisible(true);
      }, 350);
    }, 9000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.mcap, stats?.liquidity, stats?.change24h, stage, mood]);

  const tabs: { id: Tab; label: string; icon: typeof Info; badge?: number }[] = [
    { id: "about", label: "About", icon: Info },
    { id: "chart", label: "Chart", icon: CandlestickChart },
    { id: "buys", label: "Live buys", icon: Activity },
    { id: "burns", label: "Burns", icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-[#04070d] text-white" data-theme={theme}>
      <ThemeStyles theme={theme} />
      <EvolutionCelebration stage={stage} />
      <WhaleSiren lastBigBuy={lastBigBuy} />
      <KonamiCode onTrigger={() => window.dispatchEvent(new CustomEvent("orbitx-konami"))} />

      {/* slim device top bar */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#04070d]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold">ORBITX</span>
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />
            </div>
            <p className="text-xs text-white/40">Official token · Solana</p>
          </div>
          <AmbientToggle />
          <button onClick={share} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Share">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 3DS device */}
      <div className="mx-auto max-w-2xl px-2 pb-8 pt-3">
        {/* TOP SCREEN: the game */}
        <TopScreen>
          <AgentOffice3D stats={avatarStats} />
          {/* HUD */}
          <div className="pointer-events-none absolute left-2 top-2 flex gap-1.5">
            <span className="rounded-full border border-teal-300/30 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-teal-200 backdrop-blur">
              {["EGG","SPROUT","WHELP","GUARDIAN","TITAN","COSMIC"][stage]}
            </span>
            <span className="rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur">
              {fmtPriceSmart(stats?.price)}
            </span>
          </div>
          <div className={`pointer-events-none absolute inset-x-2 bottom-2 transition-opacity duration-300 ${thoughtVisible ? "opacity-100" : "opacity-0"}`}>
            <DialogueBox text={thought} speaker="Orbit" />
          </div>
        </TopScreen>

        <Hinge />

        {/* BOTTOM SCREEN: touch data */}
        <BottomScreen>
          <div className="space-y-3 p-3">
            {/* profile row */}
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border-2 border-white/15 bg-[#0a0f1a] p-0.5">
                <LivingAvatar stats={avatarStats} size={56} compact />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold tracking-tight">ORBITX</h1>
                  <BadgeCheck className="h-4 w-4 text-sky-400" />
                </div>
                <button onClick={copyMint} className="mt-0.5 flex w-full items-center gap-1.5 text-left">
                  <code className="flex-1 truncate font-mono text-[10px] text-teal-200/80">{ORBITX_MINT}</code>
                  {copied ? <span className="text-[10px] font-bold text-emerald-300">Copied!</span> : <Copy className="h-3 w-3 text-white/40" />}
                </button>
              </div>
              <ShareButton price={stats?.price} change={stats?.change24h} mcap={stats?.mcap} />
            </div>

            {/* stat grid */}
            <div className="grid grid-cols-4 gap-1.5">
              <StatCard label="Price" value={fmtPriceSmart(stats?.price)} />
              <StatCard label="MCap" value={fmtUsdShort(useCountUp(stats?.mcap))} sub={change != null ? `${changeUp ? "+" : ""}${change.toFixed(1)}%` : null} subUp={changeUp} />
              <StatCard label="Liq" value={fmtUsdShort(useCountUp(stats?.liquidity))} />
              <StatCard label="Vol" value={fmtUsdShort(useCountUp(stats?.volume24h))} />
            </div>

            <StageProgress mcap={stats?.mcap} stage={stage} />

            <div className="overflow-hidden rounded-xl">
              <TickerTape items={[
                `ORBITX ${fmtPriceSmart(stats?.price)}`,
                `MCAP ${fmtUsdShort(stats?.mcap)}`,
                `24H ${change != null ? `${changeUp ? "+" : ""}${change.toFixed(1)}%` : "—"}`,
                `LIQ ${fmtUsdShort(stats?.liquidity)}`,
                `BURNED ${fmtTokens(burned)} ORBITX`,
                `STAGE ${stage + 1}/6`,
              ]} />
            </div>

            {/* tab content */}
            <div className="min-h-[300px]">
              {tab === "about" && (
                <div className="space-y-3">
                  <AIBrief stats={avatarStats} burned={burned} />
                  <Tamagotchi buyCount={buyCount} />
                  <DiamondHands />
                  <Badges />
                  <PriceAlerts price={stats?.price} />
                  <TokenomicsBars burned={burned} supply={supply} />
                  <SupplyCountdown burned={burned} />
                  <WhatIf price={stats?.price} mcap={stats?.mcap} burned={burned} />
                  <RegretCalculator price={stats?.price} />
                  <EvolutionTimeline stage={stage} />
                  <TokenAge />
                  <SuggestionBox />
                  <DoNotPress />
                  <LoadingTips />
                  <TokenArticle />
                </div>
              )}
              {tab === "chart" && <TokenChart pool={stats?.pairAddress ?? null} fallbackMint={ORBITX_MINT} />}
              {tab === "buys" && <LiveTrades mint={ORBITX_MINT} feed={feed} />}
              {tab === "burns" && <BurnTracker mint={ORBITX_MINT} />}
            </div>

            {/* theme switcher */}
            <div className="pt-1">
              <ThemeSwitcher theme={theme} setTheme={changeTheme} />
            </div>

            {/* 3DS touch navigation */}
            <div className="sticky bottom-3 z-30">
              <div className="flex gap-1.5 rounded-2xl border border-white/10 bg-black/70 p-1.5 backdrop-blur-xl">
                {tabs.map((t) => (
                  <TouchButton
                    key={t.id}
                    icon={t.icon}
                    label={t.label}
                    active={tab === t.id}
                    onClick={() => setTab(t.id)}
                    badge={t.badge}
                  />
                ))}
              </div>
            </div>
          </div>
        </BottomScreen>
      </div>
    </div>
  );
}
