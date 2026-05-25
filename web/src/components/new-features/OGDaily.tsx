/**
 * OGDaily — AI-generated daily crypto market brief.
 * Summarizes top movers, narratives, whale activity, new launches, and notable events.
 * Wired to: Jupiter trending/price, Birdeye OHLCV, Helius transactions.
 */
import { useState, useEffect, useRef } from "react";
import { Newspaper, TrendingUp, TrendingDown, Flame, Users, Zap, Clock, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Star, BarChart3, Anchor, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  jupTrending,
  jupTopTraded,
  jupPrice,
  birdeyeOhlcv,
  type JupTokenInfo,
  fmtUsd,
  SOL_MINT,
} from "@/lib/og";

interface DailySection {
  title: string;
  emoji: string;
  items: Array<{
    text: string;
    detail?: string;
    mint?: string;
    badge?: string;
    badgeColor?: string;
  }>;
}

interface DailyBrief {
  date: string;
  headline: string;
  marketSentiment: "bullish" | "bearish" | "neutral";
  solPrice: number;
  solChange24h: number;
  totalTrendingVolume: number;
  avgGainerChange: number;
  avgLoserChange: number;
  trendingCount: number;
  sections: DailySection[];
  generatedAt: string;
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

function pctChange(t: JupTokenInfo): number {
  return t.stats24h?.priceChange ?? (t as any).priceChange24h ?? 0;
}
function pctChange1h(t: JupTokenInfo): number {
  return t.stats1h?.priceChange ?? (t as any).priceChange1h ?? 0;
}
function vol24h(t: JupTokenInfo): number {
  return ((t.stats24h?.buyVolume ?? 0) + (t.stats24h?.sellVolume ?? 0)) || (t as any).volume24h || 0;
}
function tokenAddr(t: JupTokenInfo): string {
  return (t as any).address ?? t.id;
}

const NARRATIVE_KEYWORDS: Record<string, string[]> = {
  "AI": ["ai", "gpt", "llm", "neural", "agent", "bot"],
  "Meme": ["meme", "pepe", "doge", "shiba", "moon", "lol", "frog", "chad", "wojak"],
  "DeFi": ["swap", "yield", "stake", "lend", "defi", "vault", "pool"],
  "Gaming": ["game", "play", "nft", "metaverse", "quest"],
  "Political": ["trump", "biden", "elon", "political", "freedom"],
  "Animal": ["dog", "cat", "bear", "bull", "ape", "wif", "bonk", "popcat", "kitty"],
};

function detectNarrative(t: JupTokenInfo): string | null {
  const text = `${t.symbol} ${t.name}`.toLowerCase();
  for (const [narrative, keywords] of Object.entries(NARRATIVE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return narrative;
  }
  return null;
}

export const OGDaily: React.FC<Props> = ({ onSelectMint }) => {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const generateBrief = async () => {
    setLoading(true);
    try {
      // Fetch data from multiple APIs in parallel
      const [trending24h, trending1h, topTraded, solPriceData] = await Promise.all([
        jupTrending("24h", 50),
        jupTrending("1h", 20),
        jupTopTraded("24h", 20),
        jupPrice([SOL_MINT]),
      ]);

      if (!mounted.current) return;

      const solInfo = solPriceData[SOL_MINT];
      const solPrice = solInfo?.usdPrice ?? 0;
      const solChange = solInfo?.priceChange24h ?? 0;

      // ── Top Gainers ───────────────────────────────────────
      const sorted24h = [...trending24h].sort((a, b) => pctChange(b) - pctChange(a));
      const topGainers = sorted24h.filter(t => pctChange(t) > 0).slice(0, 5);
      const topLosers = [...trending24h]
        .filter(t => pctChange(t) < 0)
        .sort((a, b) => pctChange(a) - pctChange(b))
        .slice(0, 5);

      // ── Volume leaders ────────────────────────────────────
      const volumeLeaders = [...topTraded]
        .sort((a, b) => vol24h(b) - vol24h(a))
        .slice(0, 5);

      // ── Hot new launches (trending in 1h but not dominant in 24h top 10) ──
      const top24hMints = new Set(sorted24h.slice(0, 10).map(t => tokenAddr(t)));
      const newHot = trending1h
        .filter(t => !top24hMints.has(tokenAddr(t)) && pctChange1h(t) > 5)
        .slice(0, 5);

      // ── Narrative breakdown ───────────────────────────────
      const narrativeCounts: Record<string, { count: number; avgChange: number; tokens: JupTokenInfo[] }> = {};
      trending24h.forEach(t => {
        const n = detectNarrative(t);
        if (n) {
          if (!narrativeCounts[n]) narrativeCounts[n] = { count: 0, avgChange: 0, tokens: [] };
          narrativeCounts[n].count++;
          narrativeCounts[n].tokens.push(t);
        }
      });
      Object.values(narrativeCounts).forEach(nc => {
        nc.avgChange = nc.tokens.reduce((s, t) => s + pctChange(t), 0) / nc.count;
      });
      const topNarratives = Object.entries(narrativeCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 4);

      // ── Whale activity (high volume tokens with big mcap) ─
      const whaleTargets = trending24h
        .filter(t => (t.mcap ?? 0) > 500_000 && vol24h(t) > 100_000)
        .sort((a, b) => vol24h(b) - vol24h(a))
        .slice(0, 5);

      // ── Total volume ──────────────────────────────────────
      const totalVolume = trending24h.reduce((s, t) => s + vol24h(t), 0);

      // ── Build sections ────────────────────────────────────
      const sections: DailySection[] = [
        {
          title: "Top Gainers",
          emoji: "🚀",
          items: topGainers.map(t => ({
            text: `$${t.symbol || "???"}`,
            detail: `MCap: ${fmtUsd(t.mcap || 0)} | Vol: ${fmtUsd(vol24h(t))}`,
            mint: tokenAddr(t),
            badge: `+${pctChange(t).toFixed(1)}%`,
            badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          })),
        },
        {
          title: "Top Losers",
          emoji: "📉",
          items: topLosers.map(t => ({
            text: `$${t.symbol || "???"}`,
            detail: `MCap: ${fmtUsd(t.mcap || 0)} | Vol: ${fmtUsd(vol24h(t))}`,
            mint: tokenAddr(t),
            badge: `${pctChange(t).toFixed(1)}%`,
            badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
          })),
        },
        {
          title: "Volume Leaders",
          emoji: "📊",
          items: volumeLeaders.map(t => ({
            text: `$${t.symbol || "???"}`,
            detail: `Volume: ${fmtUsd(vol24h(t))} | MCap: ${fmtUsd(t.mcap || 0)}`,
            mint: tokenAddr(t),
            badge: `${fmtUsd(vol24h(t))}`,
            badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          })),
        },
      ];

      if (newHot.length > 0) {
        sections.push({
          title: "Hot Right Now",
          emoji: "🔥",
          items: newHot.map(t => ({
            text: `$${t.symbol || "???"}`,
            detail: `MCap: ${fmtUsd(t.mcap || 0)} | 1h: +${pctChange1h(t).toFixed(1)}%`,
            mint: tokenAddr(t),
            badge: `+${pctChange1h(t).toFixed(0)}% 1h`,
            badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          })),
        });
      }

      if (topNarratives.length > 0) {
        sections.push({
          title: "Narrative Tracker",
          emoji: "🧠",
          items: topNarratives.map(([name, data]) => ({
            text: `${name}`,
            detail: `${data.count} tokens trending | Avg: ${data.avgChange >= 0 ? "+" : ""}${data.avgChange.toFixed(1)}%`,
            badge: `${data.count} tokens`,
            badgeColor: data.avgChange >= 0
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20",
          })),
        });
      }

      if (whaleTargets.length > 0) {
        sections.push({
          title: "Whale Targets",
          emoji: "🐋",
          items: whaleTargets.map(t => ({
            text: `$${t.symbol || "???"}`,
            detail: `Vol: ${fmtUsd(vol24h(t))} | MCap: ${fmtUsd(t.mcap || 0)} | Holders: ${t.holderCount?.toLocaleString() ?? "?"}`,
            mint: tokenAddr(t),
            badge: `${pctChange(t) >= 0 ? "+" : ""}${pctChange(t).toFixed(1)}%`,
            badgeColor: pctChange(t) >= 0
              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20",
          })),
        });
      }

      // Market pulse — dynamic insights
      const gainersCount = trending24h.filter(t => pctChange(t) > 0).length;
      const losersCount = trending24h.filter(t => pctChange(t) < 0).length;
      const avgChange = trending24h.reduce((s, t) => s + pctChange(t), 0) / (trending24h.length || 1);

      sections.push({
        title: "Market Pulse",
        emoji: "💡",
        items: [
          { text: `SOL: $${solPrice.toFixed(2)}`, detail: `24h: ${solChange >= 0 ? "+" : ""}${solChange.toFixed(2)}%`, badge: solChange >= 0 ? "↑" : "↓", badgeColor: solChange >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20" },
          { text: `${trending24h.length} tokens trending`, detail: `${gainersCount} up · ${losersCount} down · Avg: ${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(1)}%` },
          { text: `Total volume: ${fmtUsd(totalVolume)}`, detail: "Across top 50 trending tokens" },
          ...(newHot.length > 0 ? [{ text: `${newHot.length} fresh mover${newHot.length > 1 ? "s" : ""} in the last hour`, detail: "Check 'Hot Right Now' for details" }] : []),
        ],
      });

      // ── Sentiment ─────────────────────────────────────────
      const gainAvg = topGainers.reduce((s, t) => s + pctChange(t), 0) / (topGainers.length || 1);
      const lossAvg = Math.abs(topLosers.reduce((s, t) => s + pctChange(t), 0) / (topLosers.length || 1));
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
        marketSentiment: sentiment,
        solPrice,
        solChange24h: solChange,
        totalTrendingVolume: totalVolume,
        avgGainerChange: gainAvg,
        avgLoserChange: lossAvg,
        trendingCount: trending24h.length,
        sections,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[OGDaily] Failed to generate brief:", e);
    }
    if (mounted.current) setLoading(false);
  };

  useEffect(() => { generateBrief(); }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(generateBrief, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!brief && !loading) return null;

  const sentimentConfig = {
    bullish: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <TrendingUp className="h-4 w-4" /> },
    bearish: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: <TrendingDown className="h-4 w-4" /> },
    neutral: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: <Flame className="h-4 w-4" /> },
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Newspaper className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">OG Daily Brief</p>
              {brief && (
                <Badge className={cn("text-[8px]", sentimentConfig[brief.marketSentiment].bg, sentimentConfig[brief.marketSentiment].color)}>
                  {sentimentConfig[brief.marketSentiment].icon}
                  <span className="ml-1 capitalize">{brief.marketSentiment}</span>
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-white/25">{brief?.date || "Loading..."}</p>
          </div>
          <button
            onClick={generateBrief}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:text-white/40 transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
        {brief && (
          <>
            <p className="text-xs text-white/60 mt-2 font-medium">{brief.headline}</p>
            {/* Quick stats bar */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-white/20">SOL</span>
                <span className={cn("text-[10px] font-bold", brief.solChange24h >= 0 ? "text-emerald-400" : "text-red-400")}>
                  ${brief.solPrice.toFixed(2)}
                </span>
              </div>
              <div className="w-px h-3 bg-white/[0.08]" />
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-white/20">Trending</span>
                <span className="text-[10px] font-bold text-white/60">{brief.trendingCount}</span>
              </div>
              <div className="w-px h-3 bg-white/[0.08]" />
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-white/20">Vol</span>
                <span className="text-[10px] font-bold text-white/60">{fmtUsd(brief.totalTrendingVolume)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {loading && !brief && (
        <div className="p-6 flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-white/20" />
          <span className="text-xs text-white/20">Generating brief...</span>
        </div>
      )}

      {brief && (
        <div className="divide-y divide-white/[0.04]">
          {brief.sections.map(section => (
            <div key={section.title}>
              <button
                onClick={() => setExpandedSection(expandedSection === section.title ? null : section.title)}
                className="w-full flex items-center gap-2 p-3 hover:bg-white/[0.015] transition-colors"
              >
                <span className="text-base">{section.emoji}</span>
                <span className="text-xs font-bold text-white flex-1 text-left">{section.title}</span>
                <span className="text-[9px] text-white/15">{section.items.length}</span>
                {expandedSection === section.title
                  ? <ChevronUp className="h-3 w-3 text-white/15" />
                  : <ChevronDown className="h-3 w-3 text-white/15" />
                }
              </button>
              {expandedSection === section.title && (
                <div className="px-3 pb-3 space-y-1">
                  {section.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => item.mint && onSelectMint?.(item.mint)}
                      className={cn("w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
                        item.mint ? "hover:bg-white/[0.03] cursor-pointer" : "cursor-default"
                      )}
                    >
                      <span className="text-[11px] font-bold text-white">{item.text}</span>
                      {item.detail && <span className="text-[9px] text-white/20 flex-1 truncate">{item.detail}</span>}
                      {item.badge && (
                        <Badge className={cn("text-[8px]", item.badgeColor)}>{item.badge}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OGDaily;
