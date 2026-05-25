/**
 * NarrativeClusters — Auto-group trending tokens by narrative/theme.
 * AI tokens, political tokens, animal coins, etc. Shows which narrative is hottest.
 * Wired to: Jupiter trending API (self-fetching when no tokens prop).
 */
import { useState, useEffect, useMemo } from "react";
import { Layers, Flame, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd, jupTrending, type JupTokenInfo } from "@/lib/og";

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  mcap: number;
  priceChange24h: number;
  volume24h: number;
  logoURI?: string;
}

interface Narrative {
  id: string;
  name: string;
  emoji: string;
  keywords: string[];
  color: string;
  tokens: TokenInfo[];
  avgChange: number;
  totalVolume: number;
  totalMcap: number;
  strength: number;
}

interface Props {
  tokens?: TokenInfo[];
  onSelect?: (mint: string) => void;
  onSelectMint?: (mint: string) => void;
}

const NARRATIVE_PATTERNS: Array<{ id: string; name: string; emoji: string; keywords: string[]; color: string }> = [
  { id: "ai", name: "AI / Artificial Intelligence", emoji: "🤖", keywords: ["ai", "gpt", "llm", "neural", "brain", "machine", "deep", "bot", "algo", "intelligence", "agent"], color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { id: "political", name: "Political / Government", emoji: "🏛️", keywords: ["trump", "biden", "elon", "musk", "president", "election", "senate", "congress", "white house", "government", "political", "freedom", "liberty"], color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { id: "animal", name: "Animal / Pet Coins", emoji: "🐕", keywords: ["dog", "cat", "pepe", "frog", "bear", "bull", "ape", "monkey", "fish", "bird", "shiba", "wif", "bonk", "doge", "popcat", "pup", "kitty"], color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { id: "defi", name: "DeFi / Finance", emoji: "💰", keywords: ["swap", "yield", "stake", "lend", "borrow", "vault", "pool", "dex", "amm", "defi", "finance", "protocol", "liquidity"], color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { id: "gaming", name: "Gaming / Metaverse", emoji: "🎮", keywords: ["game", "play", "nft", "metaverse", "virtual", "quest", "arena", "battle", "rpg", "world"], color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  { id: "meme", name: "Pure Meme / Culture", emoji: "😂", keywords: ["meme", "lol", "moon", "lambo", "wen", "wagmi", "gm", "based", "chad", "alpha", "sigma", "rizz", "skibidi", "brainrot"], color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  { id: "infra", name: "Infrastructure / L1/L2", emoji: "⚡", keywords: ["layer", "chain", "bridge", "oracle", "node", "validator", "consensus", "rollup", "zk", "proof"], color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  { id: "celeb", name: "Celebrity / Influencer", emoji: "⭐", keywords: ["celeb", "famous", "influencer", "youtuber", "streamer", "rapper", "artist", "tiktoker"], color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
];

function classifyToken(token: TokenInfo): string[] {
  const text = `${token.symbol} ${token.name}`.toLowerCase();
  const matches: string[] = [];
  for (const pattern of NARRATIVE_PATTERNS) {
    if (pattern.keywords.some(kw => text.includes(kw))) {
      matches.push(pattern.id);
    }
  }
  if (matches.length === 0) matches.push("other");
  return matches;
}

function mapJupToTokenInfo(t: JupTokenInfo): TokenInfo {
  return {
    mint: (t as any).address ?? t.id,
    symbol: t.symbol || "???",
    name: t.name || "",
    mcap: t.mcap || 0,
    priceChange24h: t.stats24h?.priceChange ?? (t as any).priceChange24h ?? 0,
    volume24h: ((t.stats24h?.buyVolume ?? 0) + (t.stats24h?.sellVolume ?? 0)) || (t as any).volume24h || 0,
    logoURI: (t as any).logoURI ?? t.icon,
  };
}

export const NarrativeClusters: React.FC<Props> = ({ tokens: externalTokens, onSelect, onSelectMint }) => {
  const handleSelect = onSelect || onSelectMint;
  const [expandedNarrative, setExpandedNarrative] = useState<string | null>(null);
  const [fetchedTokens, setFetchedTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const tokens = externalTokens && externalTokens.length > 0 ? externalTokens : fetchedTokens;

  const refresh = () => {
    if (externalTokens && externalTokens.length > 0) return;
    setLoading(true);
    jupTrending("24h", 50)
      .then(res => setFetchedTokens(res.map(mapJupToTokenInfo)))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Self-fetch if no external tokens
  useEffect(() => { refresh(); }, [externalTokens]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (externalTokens && externalTokens.length > 0) return;
    const iv = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [externalTokens]);

  const narratives = useMemo(() => {
    const groups: Record<string, TokenInfo[]> = {};
    tokens.forEach(t => {
      const cats = classifyToken(t);
      cats.forEach(cat => {
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(t);
      });
    });

    return NARRATIVE_PATTERNS
      .map(pattern => {
        const patternTokens = groups[pattern.id] || [];
        if (patternTokens.length === 0) return null;

        const avgChange = patternTokens.reduce((s, t) => s + t.priceChange24h, 0) / patternTokens.length;
        const totalVolume = patternTokens.reduce((s, t) => s + t.volume24h, 0);
        const totalMcap = patternTokens.reduce((s, t) => s + t.mcap, 0);
        const strength = Math.min(100, Math.round(
          (tokens.length > 0 ? (patternTokens.length / tokens.length) * 40 : 0) +
          Math.min(Math.abs(avgChange), 100) * 0.4 +
          Math.min(totalVolume / 1000000, 20)
        ));

        return {
          ...pattern,
          tokens: patternTokens.sort((a, b) => b.priceChange24h - a.priceChange24h),
          avgChange,
          totalVolume,
          totalMcap,
          strength,
        } as Narrative;
      })
      .filter(Boolean)
      .sort((a, b) => (b as Narrative).strength - (a as Narrative).strength) as Narrative[];
  }, [tokens]);

  if (loading && tokens.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  if (narratives.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Layers className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Narrative Clusters</p>
          <p className="text-[10px] text-white/25">{narratives.length} active narratives · {tokens.length} tokens</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-lg border border-white/[0.06] text-white/20 hover:text-white/40 transition-colors"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>

      <div className="p-3 space-y-1.5">
        {narratives.map(narrative => (
          <div key={narrative.id}>
            <button
              onClick={() => setExpandedNarrative(expandedNarrative === narrative.id ? null : narrative.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                expandedNarrative === narrative.id
                  ? narrative.color
                  : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08]"
              )}
            >
              <span className="text-lg">{narrative.emoji}</span>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{narrative.name}</span>
                  <Badge className={cn("text-[8px]", narrative.color)}>
                    {narrative.tokens.length} token{narrative.tokens.length !== 1 ? "s" : ""}
                  </Badge>
                  {narrative.strength >= 70 && <Flame className="h-3 w-3 text-orange-400 animate-pulse" />}
                </div>
                <div className="flex items-center gap-3 text-[10px] mt-0.5">
                  <span className={narrative.avgChange >= 0 ? "text-emerald-400" : "text-red-400"}>
                    Avg: {narrative.avgChange >= 0 ? "+" : ""}{narrative.avgChange.toFixed(1)}%
                  </span>
                  <span className="text-white/20">Vol: {fmtUsd(narrative.totalVolume)}</span>
                </div>
              </div>

              <div className="w-12 flex flex-col items-end gap-0.5">
                <span className="text-[9px] font-bold text-white/40">{narrative.strength}</span>
                <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn("h-full rounded-full",
                      narrative.strength >= 70 ? "bg-emerald-500" :
                      narrative.strength >= 40 ? "bg-amber-500" : "bg-white/20"
                    )}
                    style={{ width: `${narrative.strength}%` }}
                  />
                </div>
              </div>

              {expandedNarrative === narrative.id
                ? <ChevronUp className="h-3 w-3 text-white/20" />
                : <ChevronDown className="h-3 w-3 text-white/20" />
              }
            </button>

            {expandedNarrative === narrative.id && (
              <div className="mt-1 ml-6 space-y-0.5">
                {narrative.tokens.slice(0, 10).map(t => (
                  <button
                    key={t.mint}
                    onClick={() => handleSelect?.(t.mint)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-white/[0.02] transition-colors text-left"
                  >
                    {t.logoURI && <img src={t.logoURI} className="w-4 h-4 rounded-full" alt="" />}
                    <span className="text-[10px] font-bold text-white">{t.symbol}</span>
                    <span className="text-[9px] text-white/15 truncate flex-1">{t.name}</span>
                    <span className={cn("text-[10px] font-bold tabular-nums",
                      t.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-white/15">{fmtUsd(t.mcap)}</span>
                  </button>
                ))}
                {narrative.tokens.length > 10 && (
                  <p className="text-[9px] text-white/15 text-center py-1">+{narrative.tokens.length - 10} more</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NarrativeClusters;
