import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Bell, Copy, ExternalLink, Flame, Share2, CandlestickChart, Wallet, Info, Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LivingAvatar, type AvatarStats } from "./LivingAvatar";
import { AgentOffice3D } from "./AgentOffice3D";
import { LiveTrades } from "./LiveTrades";
import { fetchRpcSupply } from "./rpcFeed";
import { TokenArticle } from "./TokenArticle";
import { TokenChart } from "./TokenChart";
import { BurnTracker } from "./BurnTracker";
import { TickerTape, StageProgress, StatCard, useCountUp, fmtUsdShort } from "./TokenWidgets";
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

function fmtPrice(p: number | null | undefined): string {
  if (p == null || !isFinite(p) || p === 0) return "—";
  if (p < 0.0001) return `$${p.toExponential(2)}`;
  if (p < 1) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(2)}`;
}

type Tab = "about" | "chart" | "buys" | "burns";

export default function TokenPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("about");
  const [copied, setCopied] = useState(false);

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
    } catch { /* ignore */ }
  };

  const change = stats?.change24h;
  const stage = stageForMcap(stats?.mcap ?? null);
  const changeUp = (change ?? 0) >= 0;

  const tabs: { id: Tab; label: string; icon: typeof Info; badge?: number }[] = [
    { id: "about", label: "About", icon: Info },
    { id: "chart", label: "Chart", icon: CandlestickChart },
    { id: "buys", label: "Live buys", icon: Activity },
    { id: "burns", label: "Burns", icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-[#04070d] text-white">
      {/* sticky top bar */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#04070d]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold">ORBITX</span>
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />
            </div>
            <p className="text-xs text-white/40">Official token · Solana</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => {}} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Alerts">
              <Bell className="h-5 w-5" />
            </button>
            <button onClick={share} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Share">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {/* banner */}
        <div className="relative h-44 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(45,212,191,0.35),transparent_55%),radial-gradient(ellipse_at_75%_80%,rgba(59,130,246,0.4),transparent_55%),radial-gradient(ellipse_at_50%_50%,rgba(139,92,246,0.25),transparent_70%),#04070d]" />
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />
          {/* floating orbs */}
          {[["12%", "30%", "2.5s"], ["70%", "20%", "3.4s"], ["45%", "65%", "2.9s"], ["85%", "60%", "3.8s"]].map(([l, t, d], i) => (
            <div key={i} className="absolute h-2 w-2 rounded-full bg-teal-300/70 blur-[1px]"
              style={{ left: l, top: t, animation: `orbitTwinkle ${d} ease-in-out infinite` }} />
          ))}
          <div className="absolute bottom-3 right-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/70 backdrop-blur">
            ◎ Solana · SPL
          </div>
        </div>

        {/* profile header */}
        <div className="px-4">
          <div className="-mt-16 flex items-end justify-between">
            <div className="rounded-full border-4 border-[#04070d] bg-[#0a0f1a] p-1">
              <LivingAvatar stats={avatarStats} size={104} compact />
            </div>
            <div className="mb-2 flex gap-2">
              <button
                onClick={() => navigate("/trade")}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-400 to-sky-500 px-5 py-2 text-sm font-bold text-black shadow-[0_0_20px_rgba(45,212,191,0.4)] transition hover:brightness-110 active:scale-95"
              >
                <Wallet className="h-4 w-4" /> Trade
              </button>
              <a
                href={`https://dexscreener.com/solana/${ORBITX_MINT}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur transition hover:bg-white/10 active:scale-95"
              >
                <ExternalLink className="h-4 w-4" /> DEX
              </a>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-extrabold tracking-tight">ORBITX</h1>
              <BadgeCheck className="h-5 w-5 text-sky-400" />
            </div>
            <p className="text-sm text-white/45">$ORBITX · The fuel of the OrbitX universe</p>
          </div>

          {/* mint chip */}
          <button onClick={copyMint} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.07]">
            <code className="flex-1 truncate font-mono text-xs text-teal-200/90">{ORBITX_MINT}</code>
            <Copy className="h-3.5 w-3.5 shrink-0 text-white/50" />
            <span className="shrink-0 text-[11px] font-semibold text-white/50">{copied ? "Copied!" : "Copy"}</span>
          </button>

          {/* stat grid */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            <StatCard label="Price" value={fmtPrice(stats?.price)} />
            <StatCard label="MCap" value={fmtUsdShort(useCountUp(stats?.mcap))} sub={change != null ? `${changeUp ? "+" : ""}${change.toFixed(1)}%` : null} subUp={changeUp} />
            <StatCard label="Liquidity" value={fmtUsdShort(useCountUp(stats?.liquidity))} />
            <StatCard label="24h Vol" value={fmtUsdShort(useCountUp(stats?.volume24h))} />
          </div>

          {/* evolution progress */}
          <div className="mt-3">
            <StageProgress mcap={stats?.mcap} stage={stage} />
          </div>

          {/* links */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Solscan", href: `https://solscan.io/token/${ORBITX_MINT}` },
              { label: "DexScreener", href: stats?.dexUrl ?? `https://dexscreener.com/solana/${ORBITX_MINT}` },
              { label: "X", href: "https://x.com/orbitx_wrld" },
              { label: "Telegram", href: "https://t.me/orbitxwrld" },
            ].map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white">
                {l.label} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>

        {/* live ticker tape */}
        <div className="mt-5 overflow-hidden rounded-2xl">
          <TickerTape items={[
            `ORBITX ${fmtPrice(stats?.price)}`,
            `MCAP ${fmtUsdShort(stats?.mcap)}`,
            `24H ${change != null ? `${changeUp ? "+" : ""}${change.toFixed(1)}%` : "—"}`,
            `LIQ ${fmtUsdShort(stats?.liquidity)}`,
            `BURNED ${fmtUsdShort(burned)}`,
            `STAGE ${stage + 1}/6 · ${["EGG","SPROUT","WHELP","GUARDIAN","TITAN","COSMIC"][stage]}`,
          ]} />
        </div>

        {/* tabs */}
        <div className="sticky top-[57px] z-30 mt-5 border-b border-white/10 bg-[#04070d]/90 backdrop-blur-xl">
          <div className="flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn("relative flex flex-1 items-center justify-center gap-1.5 px-2 py-3.5 text-sm font-semibold transition",
                  tab === t.id ? "text-white" : "text-white/40 hover:bg-white/5 hover:text-white/70")}
              >
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(" ")[0]}</span>
                {t.badge != null && (
                  <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-300">{t.badge}</span>
                )}
                {tab === t.id && <span className="absolute inset-x-8 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-teal-400 to-sky-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* tab content */}
        <div className="px-4 pb-24 pt-5">
          {tab === "about" && (
            <div className="space-y-8">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-4 sm:p-6">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-300">Meet Orbit</span>
                  <span className="text-[11px] text-white/35">· the living agent of $ORBITX</span>
                </div>
                <AgentOffice3D stats={avatarStats} />
              </div>
              <TokenArticle />
            </div>
          )}
          {tab === "chart" && (
            <TokenChart pool={stats?.pairAddress ?? null} fallbackMint={ORBITX_MINT} />
          )}
          {tab === "buys" && (
            <LiveTrades mint={ORBITX_MINT} />
          )}
          {tab === "burns" && (
            <BurnTracker mint={ORBITX_MINT} />
          )}
        </div>
      </div>
    </div>
  );
}
