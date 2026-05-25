/**
 * MomentumHeatmap — Visual grid of top tokens colored by momentum.
 * Green = pumping, red = dumping, size = volume. Click to dive in.
 * Wired to: Jupiter trending API with real price change data.
 */
import { useState, useEffect, useMemo } from "react";
import { Flame, RefreshCw, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { jupTrending, type JupTokenInfo, fmtUsd } from "@/lib/og";

interface HeatmapCell {
  mint: string;
  symbol: string;
  name: string;
  priceChange: number;
  volume: number;
  mcap: number;
  logoURI?: string;
}

interface Props {
  onSelect?: (mint: string) => void;
  onSelectMint?: (mint: string) => void;
  tokens?: JupTokenInfo[];
}

function pctChange(t: JupTokenInfo): number {
  return t.stats24h?.priceChange ?? (t as any).priceChange24h ?? 0;
}
function vol24h(t: JupTokenInfo): number {
  return ((t.stats24h?.buyVolume ?? 0) + (t.stats24h?.sellVolume ?? 0)) || (t as any).volume24h || 0;
}

function getHeatColor(change: number): string {
  if (change >= 50) return "bg-emerald-500/40 border-emerald-500/30 hover:bg-emerald-500/50";
  if (change >= 20) return "bg-emerald-500/25 border-emerald-500/20 hover:bg-emerald-500/35";
  if (change >= 5) return "bg-emerald-500/12 border-emerald-500/12 hover:bg-emerald-500/20";
  if (change >= 0) return "bg-emerald-500/5 border-emerald-500/8 hover:bg-emerald-500/10";
  if (change >= -5) return "bg-red-500/5 border-red-500/8 hover:bg-red-500/10";
  if (change >= -20) return "bg-red-500/12 border-red-500/12 hover:bg-red-500/20";
  if (change >= -50) return "bg-red-500/25 border-red-500/20 hover:bg-red-500/35";
  return "bg-red-500/40 border-red-500/30 hover:bg-red-500/50";
}

function getTextColor(change: number): string {
  if (change >= 5) return "text-emerald-300";
  if (change >= 0) return "text-emerald-400/70";
  if (change >= -5) return "text-red-400/70";
  return "text-red-300";
}

export const MomentumHeatmap: React.FC<Props> = ({ onSelect, onSelectMint, tokens: externalTokens }) => {
  const handleSelect = onSelect || onSelectMint;
  const [tokens, setTokens] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const mapTokens = (list: JupTokenInfo[]): HeatmapCell[] =>
    list.slice(0, 50).map(t => ({
      mint: (t as any).address ?? t.id,
      symbol: t.symbol || "???",
      name: t.name || "",
      priceChange: pctChange(t),
      volume: vol24h(t),
      mcap: t.mcap || 0,
      logoURI: (t as any).logoURI ?? t.icon,
    }));

  const refresh = () => {
    if (externalTokens && externalTokens.length > 0) {
      setTokens(mapTokens(externalTokens));
      return;
    }
    setLoading(true);
    jupTrending("24h", 50)
      .then(res => setTokens(mapTokens(res)))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [externalTokens]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    if (externalTokens) return;
    const iv = setInterval(refresh, 3 * 60 * 1000);
    return () => clearInterval(iv);
  }, [externalTokens]);

  const sorted = useMemo(() =>
    [...tokens].sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange)),
    [tokens]
  );

  const displayCount = expanded ? sorted.length : Math.min(25, sorted.length);
  const gainers = tokens.filter(t => t.priceChange > 0).length;
  const losers = tokens.filter(t => t.priceChange <= 0).length;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Flame className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Momentum Heatmap</p>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-emerald-400">{gainers} gaining</span>
            <span className="text-white/15">·</span>
            <span className="text-red-400">{losers} losing</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/[0.06] text-white/20 hover:text-white/40 transition-colors"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg border border-white/[0.06] text-white/20 hover:text-white/40 transition-colors"
          >
            {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {loading && tokens.length === 0 ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/20" />
        </div>
      ) : (
        <div className="p-3">
          <div className="flex flex-wrap gap-1.5">
            {sorted.slice(0, displayCount).map(token => {
              const maxVol = Math.max(...sorted.map(t => t.volume), 1);
              const sizeMultiplier = 0.7 + (token.volume / maxVol) * 0.5;

              return (
                <button
                  key={token.mint}
                  onClick={() => handleSelect?.(token.mint)}
                  className={cn(
                    "rounded-lg border p-2 transition-all cursor-pointer",
                    getHeatColor(token.priceChange)
                  )}
                  style={{
                    minWidth: `${Math.round(64 * sizeMultiplier)}px`,
                    flex: `${sizeMultiplier} 1 0`,
                  }}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    {token.logoURI && (
                      <img src={token.logoURI} className="w-3.5 h-3.5 rounded-full" alt="" />
                    )}
                    <span className="text-[10px] font-bold text-white truncate">{token.symbol}</span>
                  </div>
                  <div className={cn("text-xs font-black tabular-nums", getTextColor(token.priceChange))}>
                    {token.priceChange >= 0 ? "+" : ""}{token.priceChange.toFixed(1)}%
                  </div>
                  {token.mcap > 0 && (
                    <div className="text-[8px] text-white/20 mt-0.5">{fmtUsd(token.mcap)}</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-white/[0.04]">
            <span className="text-[8px] text-red-400">-50%+</span>
            <div className="flex h-1.5 rounded-full overflow-hidden w-32">
              <div className="flex-1 bg-red-500/40" />
              <div className="flex-1 bg-red-500/20" />
              <div className="flex-1 bg-red-500/8" />
              <div className="flex-1 bg-emerald-500/8" />
              <div className="flex-1 bg-emerald-500/20" />
              <div className="flex-1 bg-emerald-500/40" />
            </div>
            <span className="text-[8px] text-emerald-400">+50%+</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MomentumHeatmap;
