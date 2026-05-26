/**
 * MultiChainLaunchTracker — Track new token launches across ALL chains.
 * Enhanced version of LaunchTracker with chain filtering.
 *
 * DOES NOT replace LaunchTracker — this is an additive component.
 */
import { useState, useEffect } from "react";
import { Rocket, Clock, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtNum } from "@/lib/og";
import { SUPPORTED_CHAINS, getChain } from "@/lib/chains";
import { ChainSelector } from "./ChainSelector";

interface LaunchToken {
  address: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  age: string;
  ageMinutes: number;
  txns24h: number;
  riskLevel: "low" | "medium" | "high";
  chainId: string;
  chainEmoji: string;
}

type TimeFilter = "1h" | "6h" | "24h";

interface Props {
  onSelectMint?: (mint: string) => void;
}

export const MultiChainLaunchTracker: React.FC<Props> = ({ onSelectMint }) => {
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("6h");
  const [sortBy, setSortBy] = useState<"age" | "mcap" | "volume">("age");
  const [expanded, setExpanded] = useState(true);

  const fetchNewLaunches = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://api.dexscreener.com/token-boosts/latest/v1");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      const chainIds = selectedChain === "all"
        ? new Set(SUPPORTED_CHAINS.map(c => c.dexScreenerSlug))
        : new Set([getChain(selectedChain).dexScreenerSlug]);

      const filtered = (Array.isArray(data) ? data : [])
        .filter((t: any) => t.chainId && chainIds.has(t.chainId))
        .slice(0, 25);

      const results: LaunchToken[] = [];
      for (const t of filtered.slice(0, 15)) {
        try {
          const chain = SUPPORTED_CHAINS.find(c => c.dexScreenerSlug === t.chainId);
          if (!chain) continue;

          const r = await fetch(`https://api.dexscreener.com/tokens/v1/${t.chainId}/${t.tokenAddress}`);
          if (!r.ok) continue;
          const d = await r.json();
          const pairs = Array.isArray(d) ? d : d?.pairs || [];
          const pair = pairs[0];
          if (!pair) continue;

          const created = pair.pairCreatedAt ? new Date(pair.pairCreatedAt) : null;
          const ageMs = created ? Date.now() - created.getTime() : 0;
          const ageMins = Math.floor(ageMs / 60000);
          let age = "";
          if (ageMins < 60) age = `${ageMins}m`;
          else if (ageMins < 1440) age = `${Math.floor(ageMins / 60)}h`;
          else age = `${Math.floor(ageMins / 1440)}d`;

          const liq = pair.liquidity?.usd || 0;
          const mcap = pair.marketCap || 0;
          let risk: "low" | "medium" | "high" = "medium";
          if (liq < 5000 || mcap < 10000) risk = "high";
          else if (liq > 50000 && mcap > 100000) risk = "low";

          results.push({
            address: t.tokenAddress,
            symbol: pair.baseToken?.symbol || "???",
            name: pair.baseToken?.name || "Unknown",
            imageUrl: t.icon || pair.info?.imageUrl,
            price: parseFloat(pair.priceUsd || "0"),
            marketCap: mcap,
            liquidity: liq,
            volume24h: pair.volume?.h24 || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            age,
            ageMinutes: ageMins,
            txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
            riskLevel: risk,
            chainId: chain.id,
            chainEmoji: chain.emoji,
          });
        } catch {}
      }

      // Filter by time
      const maxMins = timeFilter === "1h" ? 60 : timeFilter === "6h" ? 360 : 1440;
      const timeFiltered = results.filter(t => t.ageMinutes <= maxMins || t.ageMinutes === 0);

      switch (sortBy) {
        case "age": timeFiltered.sort((a, b) => a.ageMinutes - b.ageMinutes); break;
        case "mcap": timeFiltered.sort((a, b) => b.marketCap - a.marketCap); break;
        case "volume": timeFiltered.sort((a, b) => b.volume24h - a.volume24h); break;
      }

      setTokens(timeFiltered);
    } catch (e) {
      console.error("MultiChainLaunchTracker error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNewLaunches(); }, [timeFilter, selectedChain]);

  const riskConfig = {
    low: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Low Risk" },
    medium: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Medium" },
    high: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "High Risk" },
  };

  return (
    <div className="space-y-3">
      {/* Chain selector */}
      <ChainSelector selectedChain={selectedChain} onSelectChain={setSelectedChain} compact />

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-4 border-b border-white/[0.06] hover:bg-white/[0.015] transition-colors text-left">
          <Rocket className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Launch Tracker</p>
            <p className="text-[10px] text-white/25">
              New token launches • {tokens.length} found
              {selectedChain !== "all" && ` on ${getChain(selectedChain).name}`}
            </p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); fetchNewLaunches(); }} className="text-white/15 hover:text-white/30 mr-2">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-white/15" /> : <ChevronDown className="h-3.5 w-3.5 text-white/15" />}
        </button>

        {expanded && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
              <div className="flex gap-1">
                {(["1h", "6h", "24h"] as TimeFilter[]).map(tf => (
                  <button key={tf} onClick={() => setTimeFilter(tf)}
                    className={cn("px-2 py-0.5 rounded text-[9px]",
                      timeFilter === tf ? "bg-primary/10 text-primary" : "text-white/15"
                    )}>
                    {tf}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex gap-1">
                {(["age", "mcap", "volume"] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)}
                    className={cn("px-2 py-0.5 rounded text-[9px]",
                      sortBy === s ? "bg-primary/10 text-primary" : "text-white/15"
                    )}>
                    {s === "age" ? "Newest" : s === "mcap" ? "MCap" : "Volume"}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.03]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 text-white/10 animate-spin" />
                </div>
              ) : tokens.length === 0 ? (
                <div className="py-8 text-center">
                  <Rocket className="h-6 w-6 text-white/[0.06] mx-auto mb-1" />
                  <p className="text-[10px] text-white/20">No new launches in timeframe</p>
                </div>
              ) : (
                tokens.map(t => {
                  const risk = riskConfig[t.riskLevel];
                  const chain = getChain(t.chainId);
                  return (
                    <button key={`${t.chainId}:${t.address}`} onClick={() => onSelectMint?.(t.address)}
                      className="w-full p-3 hover:bg-white/[0.02] transition-colors text-left">
                      <div className="flex items-center gap-2.5">
                        {t.imageUrl ? (
                          <img src={t.imageUrl} className="w-8 h-8 rounded-full shrink-0" alt=""
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/20 shrink-0">
                            {t.symbol?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-white">{t.symbol}</span>
                            <Badge className={cn("text-[7px] py-0", chain.accent)}>
                              {chain.emoji} {chain.shortName}
                            </Badge>
                            <Badge className={cn("text-[7px] py-0", risk.bg, risk.color, risk.border)}>
                              {risk.label}
                            </Badge>
                            <span className="text-[8px] text-white/15">{t.age} ago</span>
                          </div>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-[9px] text-white/20">MC: {fmtUsd(t.marketCap)}</span>
                            <span className="text-[9px] text-white/20">Liq: {fmtUsd(t.liquidity)}</span>
                            <span className="text-[9px] text-white/20">{fmtNum(t.txns24h)} txns</span>
                          </div>
                        </div>
                        <span className={cn("text-[10px] font-bold",
                          t.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(0)}%
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MultiChainLaunchTracker;
