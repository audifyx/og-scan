/**
 * OGDaily — Advanced daily crypto market brief.
 * Shows live data: Top Gainers, Losers, Volume, Hot Movers, New Launches,
 * Narrative Tracker, Whale Targets, Organic Score, Market Pulse.
 * Each section shows 10-15 tokens with full data.
 * Wired to: Jupiter trending/price, Jupiter top-traded, Jupiter organic score.
 */
import { useState, useEffect, useRef } from "react";
import {
  Newspaper, TrendingUp, TrendingDown, Flame, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, BarChart3, Zap, Rocket, Brain, Anchor, Target,
  Activity, Star, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  jupTrending, jupTopTraded, jupTopOrganic, jupPrice,
  type JupTokenInfo, fmtUsd, SOL_MINT,
} from "@/lib/og";

/* ────────────────────────── Types ────────────────────────── */

interface TokenRow {
  mint: string;
  symbol: string;
  name?: string;
  logoURI?: string;
  mcap?: number;
  volume?: number;
  change24h: number;
  change1h?: number;
  liquidity?: number;
  holderCount?: number;
  organicScore?: number;
  badge?: string;
  badgeColor?: string;
}

interface Section {
  id: string;
  title: string;
  emoji: string;
  description: string;
  tokens: TokenRow[];
  extraRows?: Array<{ label: string; value: string; sub?: string; color?: string }>;
  accentColor: string;
}

interface BriefData {
  date: string;
  headline: string;
  sentiment: "bullish" | "bearish" | "neutral";
  solPrice: number;
  solChange: number;
  totalVol: number;
  trendingCount: number;
  gainersCount: number;
  losersCount: number;
  sections: Section[];
  generatedAt: string;
}

interface Props { onSelectMint?: (mint: string) => void; }

/* ────────────────────────── Helpers ────────────────────────── */

function pct(t: JupTokenInfo) { return t.stats24h?.priceChange ?? (t as any).priceChange24h ?? 0; }
function pct1h(t: JupTokenInfo) { return t.stats1h?.priceChange ?? (t as any).priceChange1h ?? 0; }
function vol(t: JupTokenInfo) { return ((t.stats24h?.buyVolume ?? 0) + (t.stats24h?.sellVolume ?? 0)) || (t as any).volume24h || 0; }
function addr(t: JupTokenInfo): string { return (t as any).address ?? t.id; }
function logo(t: JupTokenInfo): string | undefined { return (t as any).logoURI ?? t.icon ?? undefined; }
function organic(t: JupTokenInfo): number { return (t as any).organicScore ?? (t as any).organic_score ?? 0; }

function toRow(t: JupTokenInfo, overrides?: Partial<TokenRow>): TokenRow {
  return {
    mint: addr(t),
    symbol: t.symbol || "???",
    name: t.name,
    logoURI: logo(t),
    mcap: t.mcap ?? undefined,
    volume: vol(t),
    change24h: pct(t),
    change1h: pct1h(t),
    liquidity: t.liquidity ?? undefined,
    holderCount: t.holderCount ?? undefined,
    organicScore: organic(t),
    ...overrides,
  };
}

const NARRATIVE_KEYWORDS: Record<string, string[]> = {
  "AI / Agents": ["ai", "gpt", "llm", "neural", "agent", "artificial"],
  "Meme": ["meme", "pepe", "doge", "shiba", "moon", "frog", "chad", "wojak", "lol", "haha"],
  "DeFi": ["swap", "yield", "stake", "lend", "defi", "vault", "pool", "finance"],
  "Gaming / NFT": ["game", "play", "nft", "metaverse", "quest", "arena", "pixel"],
  "Political": ["trump", "biden", "maga", "political", "freedom", "america"],
  "Animals": ["dog", "cat", "bear", "bull", "ape", "wif", "bonk", "popcat", "kitty", "fish"],
  "Infrastructure": ["solana", "layer", "chain", "bridge", "protocol", "network", "dao"],
};

function narrative(t: JupTokenInfo): string | null {
  const txt = `${t.symbol} ${t.name || ""}`.toLowerCase();
  for (const [n, kw] of Object.entries(NARRATIVE_KEYWORDS)) {
    if (kw.some(k => txt.includes(k))) return n;
  }
  return null;
}

/* ────────────────────── Token Row Component ────────────────── */

function TokenCard({ row, rank, onSelect, showField = "change24h" }: {
  row: TokenRow;
  rank: number;
  onSelect?: (mint: string) => void;
  showField?: "change24h" | "change1h" | "volume" | "organic";
}) {
  const change = showField === "change1h" ? (row.change1h ?? row.change24h) : row.change24h;
  const isUp = change >= 0;

  const badge = showField === "volume"
    ? fmtUsd(row.volume ?? 0)
    : showField === "organic"
    ? `${(row.organicScore ?? 0).toFixed(0)} OG`
    : `${isUp ? "+" : ""}${change.toFixed(1)}%`;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.mint)}
      className="group flex items-center gap-3 w-full rounded-xl px-3 py-2.5 transition hover:bg-white/[0.04] active:scale-[0.99] text-left"
    >
      {/* rank */}
      <span className="w-5 text-center text-[10px] font-black text-white/20 shrink-0">{rank}</span>

      {/* logo */}
      {row.logoURI ? (
        <img src={row.logoURI} alt="" className="h-8 w-8 rounded-full object-cover bg-white/[0.04] border border-white/[0.06] shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-black text-white/40 border border-white/[0.05] shrink-0">
          {row.symbol.slice(0, 2)}
        </div>
      )}

      {/* name + details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-black text-white truncate">${row.symbol}</span>
          {row.change1h !== undefined && showField === "change24h" && (
            <span className={cn("text-[9px] font-bold", (row.change1h ?? 0) >= 0 ? "text-og-lime/70" : "text-red-400/70")}>
              {(row.change1h ?? 0) >= 0 ? "↑" : "↓"}{Math.abs(row.change1h ?? 0).toFixed(0)}% 1h
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/30 truncate">
          {row.mcap ? `MCap: ${fmtUsd(row.mcap)}` : ""}
          {row.volume ? ` · Vol: ${fmtUsd(row.volume)}` : ""}
        </p>
      </div>

      {/* badge */}
      <div className={cn(
        "shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black border",
        showField === "volume"
          ? "text-blue-400 border-blue-400/20 bg-blue-400/10"
          : showField === "organic"
          ? "text-og-cyan border-og-cyan/20 bg-og-cyan/10"
          : isUp
          ? "text-og-lime border-og-lime/20 bg-og-lime/10"
          : "text-red-400 border-red-400/20 bg-red-400/10"
      )}>
        {showField !== "volume" && showField !== "organic" && (
          isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />
        )}
        {badge}
      </div>

      <ExternalLink className="h-3 w-3 text-white/10 group-hover:text-white/40 shrink-0 transition" />
    </button>
  );
}

/* ────────────────────── Main Component ─────────────────────── */

const SECTIONS_EXPANDED_DEFAULT = new Set(["Top Gainers", "Top Losers", "Volume Leaders"]);

export const OGDaily: React.FC<Props> = ({ onSelectMint }) => {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(SECTIONS_EXPANDED_DEFAULT);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const toggleSection = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const generate = async () => {
    setLoading(true);
    try {
      // Fetch all data sources in parallel — use large limits for better coverage
      const [t24, t1h, traded, organic, solData] = await Promise.all([
        jupTrending("24h", 100),
        jupTrending("1h", 50),
        jupTopTraded("24h", 50),
        jupTopOrganic("24h", 50),
        jupPrice([SOL_MINT]),
      ]);

      if (!mounted.current) return;

      const solPrice = solData[SOL_MINT]?.usdPrice ?? 0;
      const solChange = solData[SOL_MINT]?.priceChange24h ?? 0;
      const totalVol = t24.reduce((s, t) => s + vol(t), 0);

      // Sort all tokens by 24h change
      const sortedUp = [...t24].sort((a, b) => pct(b) - pct(a));
      const sortedDown = [...t24].sort((a, b) => pct(a) - pct(b));

      // TOP GAINERS — top 15 positive movers
      const gainers = sortedUp.filter(t => pct(t) > 0).slice(0, 15);
      // Fill up to 10 even if market is green
      const gainersSection: Section = {
        id: "gainers", title: "Top Gainers", emoji: "🚀", accentColor: "text-og-lime",
        description: `${gainers.length} tokens with biggest gains in 24h`,
        tokens: gainers.map(t => toRow(t, {
          badge: `+${pct(t).toFixed(1)}%`,
          badgeColor: "bg-og-lime/10 text-og-lime border-og-lime/20",
        })),
      };

      // TOP LOSERS — take bottom 15 from all available; if < 10 use bottom sorted
      const losers = sortedDown.filter(t => pct(t) < 0).slice(0, 15);
      // If not enough losers (green market), show weakest performers
      const loserFill = losers.length < 10
        ? sortedDown.slice(0, Math.max(15 - losers.length, 0)).filter(t => !losers.some(l => addr(l) === addr(t)))
        : [];
      const allLosers = [...losers, ...loserFill].slice(0, 15);

      const losersSection: Section = {
        id: "losers", title: "Top Losers", emoji: "📉", accentColor: "text-red-400",
        description: losers.length < 5 ? `Market mostly green — showing weakest performers` : `${allLosers.length} tokens with biggest drops in 24h`,
        tokens: allLosers.map(t => toRow(t, {
          badge: `${pct(t) >= 0 ? "+" : ""}${pct(t).toFixed(1)}%`,
          badgeColor: pct(t) < 0 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20",
        })),
      };

      // VOLUME LEADERS — top 15 by volume from traded list
      const volLeaders = [...traded].sort((a, b) => vol(b) - vol(a)).slice(0, 15);
      const volSection: Section = {
        id: "volume", title: "Volume Leaders", emoji: "📊", accentColor: "text-blue-400",
        description: `Highest 24h trading volume — ${fmtUsd(totalVol)} total`,
        tokens: volLeaders.map(t => toRow(t, { badge: fmtUsd(vol(t)), badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" })),
      };

      // HOT RIGHT NOW — 1h trending, not in 24h top 10
      const top24Mints = new Set(sortedUp.slice(0, 10).map(addr));
      const hot1h = t1h
        .filter(t => !top24Mints.has(addr(t)) && pct1h(t) > 3)
        .sort((a, b) => pct1h(b) - pct1h(a))
        .slice(0, 15);
      const hotSection: Section = {
        id: "hot", title: "Hot Right Now", emoji: "🔥", accentColor: "text-orange-400",
        description: "1h trending movers — fresh momentum not yet in 24h top",
        tokens: hot1h.map(t => toRow(t, { badge: `+${pct1h(t).toFixed(0)}% 1h`, badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20" })),
      };

      // NEW LAUNCHES — small mcap tokens in 1h trending
      const newLaunches = t1h
        .filter(t => (t.mcap ?? 0) < 5_000_000 && pct1h(t) > 0)
        .sort((a, b) => pct1h(b) - pct1h(a))
        .slice(0, 12);
      const launchSection: Section = {
        id: "launches", title: "New Launches", emoji: "⚡", accentColor: "text-og-cyan",
        description: "Small cap tokens heating up in the last hour",
        tokens: newLaunches.map(t => toRow(t, {
          badge: `${fmtUsd(t.mcap ?? 0)}`,
          badgeColor: "bg-og-cyan/10 text-og-cyan border-og-cyan/20",
        })),
      };

      // ORGANIC SCORE — most organically traded (no bot activity)
      const organicTop = [...organic]
        .sort((a, b) => organic(b) - organic(a))
        .slice(0, 15);
      const organicSection: Section = {
        id: "organic", title: "Organic Score", emoji: "🧬", accentColor: "text-og-cyan",
        description: "Tokens with highest organic trading — minimal bot activity",
        tokens: organicTop.map(t => toRow(t, {
          badge: `${organic(t).toFixed(0)} OG`,
          badgeColor: "bg-og-cyan/10 text-og-cyan border-og-cyan/20",
        })),
      };

      // NARRATIVE TRACKER
      const narrativeCounts: Record<string, { count: number; totalChange: number; tokens: JupTokenInfo[] }> = {};
      t24.forEach(t => {
        const n = narrative(t);
        if (n) {
          if (!narrativeCounts[n]) narrativeCounts[n] = { count: 0, totalChange: 0, tokens: [] };
          narrativeCounts[n].count++;
          narrativeCounts[n].totalChange += pct(t);
          narrativeCounts[n].tokens.push(t);
        }
      });
      const topNarratives = Object.entries(narrativeCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 7);

      const narrativeSection: Section = {
        id: "narrative", title: "Narrative Tracker", emoji: "🧠", accentColor: "text-purple-400",
        description: "Active crypto themes and their market performance",
        tokens: [],
        extraRows: topNarratives.map(([name, data]) => {
          const avg = data.totalChange / data.count;
          const topTok = data.tokens.sort((a, b) => pct(b) - pct(a))[0];
          return {
            label: `${name}`,
            value: `${data.count} tokens`,
            sub: `Avg: ${avg >= 0 ? "+" : ""}${avg.toFixed(1)}% · Top: $${topTok?.symbol ?? "?"}`,
            color: avg >= 0 ? "text-og-lime" : "text-red-400",
          };
        }),
      };

      // WHALE TARGETS — high mcap + high volume
      const whaleTargets = t24
        .filter(t => (t.mcap ?? 0) > 1_000_000 && vol(t) > 200_000)
        .sort((a, b) => vol(b) - vol(a))
        .slice(0, 15);
      const whaleSection: Section = {
        id: "whale", title: "Whale Targets", emoji: "🐋", accentColor: "text-purple-400",
        description: "High mcap tokens with heavy whale volume",
        tokens: whaleTargets.map(t => toRow(t, {
          badge: fmtUsd(vol(t)),
          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        })),
      };

      // MARKET PULSE — summary metrics
      const gainersCount = t24.filter(t => pct(t) > 0).length;
      const losersCount = t24.filter(t => pct(t) < 0).length;
      const avgChange = t24.reduce((s, t) => s + pct(t), 0) / (t24.length || 1);
      const gainAvg = gainers.reduce((s, t) => s + pct(t), 0) / (gainers.length || 1);
      const lossAvg = Math.abs(losers.reduce((s, t) => s + pct(t), 0)) / (losers.length || 1);

      const pulseSection: Section = {
        id: "pulse", title: "Market Pulse", emoji: "💡", accentColor: "text-amber-400",
        description: "Live market breadth and key statistics",
        tokens: [],
        extraRows: [
          { label: `SOL Price`, value: `$${solPrice.toFixed(2)}`, sub: `24h: ${solChange >= 0 ? "+" : ""}${solChange.toFixed(2)}%`, color: solChange >= 0 ? "text-og-lime" : "text-red-400" },
          { label: `Market Breadth`, value: `${gainersCount}↑ / ${losersCount}↓`, sub: `Avg 24h: ${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(1)}%`, color: gainersCount > losersCount ? "text-og-lime" : "text-red-400" },
          { label: `Total Volume`, value: fmtUsd(totalVol), sub: `Across ${t24.length} trending tokens` },
          { label: `Top Gainer`, value: gainers[0] ? `$${gainers[0].symbol}` : "—", sub: gainers[0] ? `+${pct(gainers[0]).toFixed(1)}%` : "", color: "text-og-lime" },
          { label: `Top Volume`, value: volLeaders[0] ? `$${volLeaders[0].symbol}` : "—", sub: volLeaders[0] ? fmtUsd(vol(volLeaders[0])) : "", color: "text-blue-400" },
          { label: `Trending Tokens`, value: `${t24.length} active`, sub: `1h movers: ${t1h.length}` },
          { label: `New Launches`, value: `${newLaunches.length} spotted`, sub: `MCap < $5M with momentum` },
        ],
      };

      // Sentiment
      let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
      if (gainAvg > lossAvg * 1.3 && solChange > -2) sentiment = "bullish";
      else if (lossAvg > gainAvg * 1.3 || solChange < -5) sentiment = "bearish";

      setBrief({
        date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        headline: sentiment === "bullish"
          ? `Green Day — SOL at $${solPrice.toFixed(2)} (${solChange >= 0 ? "+" : ""}${solChange.toFixed(1)}%)`
          : sentiment === "bearish"
          ? `Market Pullback — SOL at $${solPrice.toFixed(2)} (${solChange.toFixed(1)}%)`
          : `Mixed Signals — SOL at $${solPrice.toFixed(2)} (${solChange >= 0 ? "+" : ""}${solChange.toFixed(1)}%)`,
        sentiment,
        solPrice,
        solChange,
        totalVol,
        trendingCount: t24.length,
        gainersCount,
        losersCount,
        sections: [gainersSection, losersSection, volSection, hotSection, launchSection, organicSection, narrativeSection, whaleSection, pulseSection],
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[OGDaily] Error:", e);
    }
    if (mounted.current) setLoading(false);
  };

  useEffect(() => { generate(); }, []);
  useEffect(() => {
    const iv = setInterval(generate, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  if (!brief && !loading) return null;

  const sentimentBadge = {
    bullish: { cls: "bg-og-lime/10 text-og-lime border-og-lime/20", Icon: TrendingUp, label: "Bullish" },
    bearish: { cls: "bg-red-500/10 text-red-400 border-red-500/20", Icon: TrendingDown, label: "Bearish" },
    neutral: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", Icon: Minus, label: "Neutral" },
  };

  const sectionIcons: Record<string, React.ElementType> = {
    gainers: Rocket, losers: TrendingDown, volume: BarChart3,
    hot: Flame, launches: Zap, organic: Activity,
    narrative: Brain, whale: Anchor, pulse: Star,
  };

  return (
    <div className="flex flex-col rounded-[1.75rem] border border-white/[0.08] bg-[#07101e] overflow-hidden">
      {/* ── Header ── */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-og-cyan/10 border border-og-cyan/20 flex items-center justify-center shrink-0">
            <Newspaper className="h-5 w-5 text-og-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-black text-white">OG Daily Brief</p>
              {brief && (() => {
                const s = sentimentBadge[brief.sentiment];
                return (
                  <span className={cn("flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black border", s.cls)}>
                    <s.Icon className="h-3 w-3" /> {s.label}
                  </span>
                );
              })()}
            </div>
            <p className="text-[10px] text-white/30">{brief?.date || "Loading…"}</p>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/30 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {brief && (
          <>
            <p className="text-[12px] text-white/60 mt-2.5 font-bold">{brief.headline}</p>
            {/* quick stats */}
            <div className="flex items-center gap-0 mt-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-x divide-white/[0.06]">
              {[
                { label: "SOL", value: `$${brief.solPrice.toFixed(2)}`, color: brief.solChange >= 0 ? "text-og-lime" : "text-red-400" },
                { label: "Gainers", value: String(brief.gainersCount), color: "text-og-lime" },
                { label: "Losers", value: String(brief.losersCount), color: "text-red-400" },
                { label: "Volume", value: fmtUsd(brief.totalVol), color: "text-blue-400" },
                { label: "Trending", value: String(brief.trendingCount), color: "text-white/60" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex-1 flex flex-col items-center py-2">
                  <span className="text-[8px] text-white/25 uppercase tracking-widest">{label}</span>
                  <span className={cn("text-[11px] font-black", color)}>{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && !brief && (
        <div className="flex items-center justify-center gap-2 py-10">
          <RefreshCw className="h-4 w-4 animate-spin text-og-cyan" />
          <span className="text-[12px] text-white/30">Generating brief…</span>
        </div>
      )}

      {/* ── Sections ── */}
      {brief && (
        <div className="divide-y divide-white/[0.04]">
          {brief.sections.map(section => {
            const isOpen = expanded.has(section.id);
            const SectionIcon = sectionIcons[section.id] || Target;
            const count = section.tokens.length + (section.extraRows?.length ?? 0);

            return (
              <div key={section.id}>
                {/* section header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.015] transition-colors text-left"
                >
                  <span className="text-[18px] shrink-0">{section.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-white">{section.title}</p>
                    {isOpen && <p className="text-[10px] text-white/30 truncate">{section.description}</p>}
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black border",
                    count > 0
                      ? "bg-white/[0.05] text-white/40 border-white/[0.07]"
                      : "bg-red-500/10 text-red-400/60 border-red-500/10"
                  )}>
                    {count}
                  </span>
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-white/20 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-white/20 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="pb-2">
                    {/* token rows */}
                    {section.tokens.map((row, i) => (
                      <TokenCard
                        key={row.mint}
                        row={row}
                        rank={i + 1}
                        onSelect={onSelectMint}
                        showField={
                          section.id === "volume" ? "volume"
                          : section.id === "hot" || section.id === "launches" ? "change1h"
                          : section.id === "organic" ? "organic"
                          : "change24h"
                        }
                      />
                    ))}

                    {/* extra rows (narrative / pulse) */}
                    {section.extraRows && section.extraRows.length > 0 && (
                      <div className="mx-4 mt-1 rounded-[1.1rem] border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                        {section.extraRows.map((row, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-white truncate">{row.label}</p>
                              {row.sub && <p className="text-[10px] text-white/30 truncate">{row.sub}</p>}
                            </div>
                            <span className={cn("text-[12px] font-black shrink-0", row.color || "text-white/60")}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {count === 0 && (
                      <p className="text-center text-[11px] text-white/25 py-4">No data available</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OGDaily;
