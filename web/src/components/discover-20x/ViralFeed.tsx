/**
 * ViralFeed — Aggregates viral/trending meme coins from multiple signals.
 * Shows social buzz score, holder growth, volume spikes, narrative tags.
 */
import { useState, useEffect } from "react";
import { Zap, TrendingUp, Users, Volume2, Flame, MessageSquare, ArrowUpRight, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtNum, DEXSCREENER_WEB_BASE } from "@/lib/og";

interface ViralToken {
  address: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  marketCap: number;
  priceChange24h: number;
  volume24h: number;
  txns24h: number;
  viralScore: number; // 0-100
  signals: string[];
  narrative?: string;
}

interface Props {
  onSelectToken?: (address: string) => void;
}

const NARRATIVE_COLORS: Record<string, string> = {
  "AI": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Meme": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Political": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Animal": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "DeFi": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Gaming": "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

export const ViralFeed: React.FC<Props> = ({ onSelectToken }) => {
  const [tokens, setTokens] = useState<ViralToken[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchViral = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const solana = (Array.isArray(data) ? data : [])
        .filter((t: any) => t.chainId === "solana")
        .slice(0, 15);

      const results: ViralToken[] = [];
      for (const t of solana.slice(0, 10)) {
        try {
          const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${t.tokenAddress}`);
          if (!r.ok) continue;
          const d = await r.json();
          const pairs = Array.isArray(d) ? d : d?.pairs || [];
          const pair = pairs[0];
          if (!pair) continue;

          const vol = pair.volume?.h24 || 0;
          const txns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
          const change = pair.priceChange?.h24 || 0;
          const mcap = pair.marketCap || 0;

          // Compute viral score
          const signals: string[] = [];
          let score = 0;
          if (vol > 1_000_000) { score += 25; signals.push("🔊 High Volume"); }
          else if (vol > 100_000) { score += 10; }
          if (txns > 5000) { score += 25; signals.push("⚡ High Activity"); }
          else if (txns > 1000) { score += 10; }
          if (change > 100) { score += 25; signals.push("🚀 Pumping"); }
          else if (change > 20) { score += 10; }
          if (t.totalAmount > 500) { score += 25; signals.push("💎 Boosted"); }
          else if (t.totalAmount > 100) { score += 10; }

          // Narrative detection
          const nameL = (pair.baseToken?.name || "").toLowerCase();
          const symL = (pair.baseToken?.symbol || "").toLowerCase();
          let narrative: string | undefined;
          if (/ai|gpt|neural|agent/.test(nameL + symL)) narrative = "AI";
          else if (/trump|biden|maga|vote|politi/.test(nameL + symL)) narrative = "Political";
          else if (/dog|cat|frog|pepe|shib|doge|inu|bird|monkey/.test(nameL + symL)) narrative = "Animal";
          else narrative = "Meme";

          results.push({
            address: t.tokenAddress,
            symbol: pair.baseToken?.symbol || "???",
            name: pair.baseToken?.name || "Unknown",
            imageUrl: t.icon || pair.info?.imageUrl,
            marketCap: mcap,
            priceChange24h: change,
            volume24h: vol,
            txns24h: txns,
            viralScore: Math.min(score, 100),
            signals,
            narrative,
          });
        } catch {}
      }

      results.sort((a, b) => b.viralScore - a.viralScore);
      setTokens(results);
    } catch (e) {
      console.error("ViralFeed error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchViral(); }, []);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Zap className="h-4 w-4 text-amber-400" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Viral Feed</p>
          <p className="text-[10px] text-white/25">Tokens gaining rapid attention</p>
        </div>
        <button onClick={fetchViral} className="text-white/15 hover:text-white/30">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.03]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 text-white/10 animate-spin" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="py-8 text-center">
            <Zap className="h-6 w-6 text-white/[0.06] mx-auto mb-1" />
            <p className="text-[10px] text-white/20">No viral tokens detected</p>
          </div>
        ) : (
          tokens.map(t => (
            <button
              key={t.address}
              onClick={() => onSelectToken?.(t.address)}
              className="w-full p-3 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                {t.imageUrl ? (
                  <img src={t.imageUrl} className="w-9 h-9 rounded-full shrink-0" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/20 shrink-0">
                    {t.symbol?.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-white">{t.symbol}</span>
                    {t.narrative && (
                      <Badge className={cn("text-[7px] py-0", NARRATIVE_COLORS[t.narrative] || "bg-white/[0.04] text-white/20 border-white/[0.06]")}>
                        {t.narrative}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[9px] text-white/20">MC: {fmtUsd(t.marketCap)}</span>
                    <span className="text-[9px] text-white/20">Vol: {fmtUsd(t.volume24h)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {/* Viral score bar */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={cn("h-full rounded-full",
                          t.viralScore >= 70 ? "bg-amber-400" : t.viralScore >= 40 ? "bg-primary" : "bg-white/20"
                        )}
                        style={{ width: `${t.viralScore}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-amber-400">{t.viralScore}</span>
                  </div>
                  <span className={cn("text-[10px] font-bold",
                    t.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                  </span>
                </div>
              </div>
              {/* Signals */}
              {t.signals.length > 0 && (
                <div className="flex gap-1 mt-1.5 ml-[46px]">
                  {t.signals.map((s, i) => (
                    <span key={i} className="text-[8px] text-white/15">{s}</span>
                  ))}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default ViralFeed;
