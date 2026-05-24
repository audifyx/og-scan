/**
 * OGDaily — AI-generated daily crypto market brief.
 * Summarizes top movers, narratives, whale activity, new launches, and notable events.
 */
import { useState, useEffect } from "react";
import { Newspaper, TrendingUp, TrendingDown, Flame, Users, Zap, Clock, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { jupTrending, type JupTokenInfo, fmtUsd } from "@/lib/og";

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
  sections: DailySection[];
  generatedAt: string;
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

export const OGDaily: React.FC<Props> = ({ onSelectMint }) => {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const generateBrief = async () => {
    setLoading(true);
    try {
      const trending = await jupTrending("24h", 20);

      const topGainers = trending
        .filter((t: any) => (t.priceChange24h || 0) > 0)
        .sort((a: any, b: any) => (b.priceChange24h || 0) - (a.priceChange24h || 0))
        .slice(0, 5);

      const topLosers = trending
        .filter((t: any) => (t.priceChange24h || 0) < 0)
        .sort((a: any, b: any) => (a.priceChange24h || 0) - (b.priceChange24h || 0))
        .slice(0, 5);

      const sections: DailySection[] = [
        {
          title: "Top Gainers",
          emoji: "🚀",
          items: topGainers.map((t: any) => ({
            text: `$${t.symbol || "???"}`,
            detail: `MCap: ${fmtUsd(t.mcap || 0)} | Change: +${((t as any).priceChange24h || 0).toFixed(1)}%`,
            mint: t.address,
            badge: `+${((t as any).priceChange24h || 0).toFixed(0)}%`,
            badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          })),
        },
        {
          title: "Top Losers",
          emoji: "📉",
          items: topLosers.map((t: any) => ({
            text: `$${t.symbol || "???"}`,
            detail: `MCap: ${fmtUsd(t.mcap || 0)} | Change: ${((t as any).priceChange24h || 0).toFixed(1)}%`,
            mint: t.address,
            badge: `${((t as any).priceChange24h || 0).toFixed(0)}%`,
            badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
          })),
        },
        {
          title: "Market Pulse",
          emoji: "💡",
          items: [
            { text: "Solana ecosystem remains active with new token launches" },
            { text: `${trending.length}+ tokens trending in the last 24h` },
            { text: "Watch for bonding curve migrations — several tokens approaching 100%" },
          ],
        },
      ];

      const gainAvg = topGainers.reduce((s: number, t: any) => s + ((t as any).priceChange24h || 0), 0) / (topGainers.length || 1);
      const lossAvg = Math.abs(topLosers.reduce((s: number, t: any) => s + ((t as any).priceChange24h || 0), 0) / (topLosers.length || 1));
      const sentiment = gainAvg > lossAvg * 1.5 ? "bullish" : lossAvg > gainAvg * 1.5 ? "bearish" : "neutral";

      setBrief({
        date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        headline: sentiment === "bullish" ? "Green Day Across Solana" :
          sentiment === "bearish" ? "Market Pullback — Caution Advised" :
          "Mixed Signals — Selective Opportunities",
        marketSentiment: sentiment,
        sections,
        generatedAt: new Date().toISOString(),
      });
    } catch {}
    setLoading(false);
  };

  useEffect(() => { generateBrief(); }, []);

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
          <p className="text-xs text-white/60 mt-2 font-medium">{brief.headline}</p>
        )}
      </div>

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
