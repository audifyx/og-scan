/**
 * MultiChainLaunchpadExplorer — Browse tokens launched on launchpads across ALL chains.
 * Extends the original LaunchpadExplorer concept to EVM chains.
 * Shows chain-specific launchpads (Pump.fun for Solana, Uniswap for ETH, Aerodrome for Base, etc.)
 *
 * DOES NOT replace LaunchpadExplorer — this is an additive component.
 */
import { useState, useEffect, useCallback } from "react";
import { Rocket, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtNum, DEXSCREENER_WEB_BASE } from "@/lib/og";
import { SUPPORTED_CHAINS, getChain, type ChainConfig } from "@/lib/chains";
import { ChainSelector } from "./ChainSelector";

interface LaunchpadToken {
  address: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  txns24h: number;
  pairAddress?: string;
  age?: string;
  chainId: string;
  chainEmoji: string;
}

interface LaunchpadDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  searchTerms: string[];
  chainId: string;
  chainEmoji: string;
  color: string;
  website?: string;
}

type SortBy = "volume" | "mcap" | "change" | "newest";

/** Collect all launchpads from all chains + assign colors */
const LAUNCHPAD_COLORS = [
  "from-green-500/10 to-emerald-500/10 border-green-500/20",
  "from-purple-500/10 to-indigo-500/10 border-purple-500/20",
  "from-amber-500/10 to-orange-500/10 border-amber-500/20",
  "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
  "from-red-500/10 to-pink-500/10 border-red-500/20",
  "from-teal-500/10 to-emerald-500/10 border-teal-500/20",
  "from-violet-500/10 to-purple-500/10 border-violet-500/20",
  "from-rose-500/10 to-pink-500/10 border-rose-500/20",
  "from-cyan-500/10 to-sky-500/10 border-cyan-500/20",
  "from-lime-500/10 to-green-500/10 border-lime-500/20",
];

function buildLaunchpadList(chainFilter: string): LaunchpadDef[] {
  let colorIdx = 0;
  const pads: LaunchpadDef[] = [];
  const chains = chainFilter === "all" ? SUPPORTED_CHAINS : SUPPORTED_CHAINS.filter(c => c.id === chainFilter);

  for (const chain of chains) {
    for (const lp of chain.launchpads || []) {
      pads.push({
        ...lp,
        chainId: chain.id,
        chainEmoji: chain.emoji,
        color: LAUNCHPAD_COLORS[colorIdx % LAUNCHPAD_COLORS.length],
      });
      colorIdx++;
    }
  }
  return pads;
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

export const MultiChainLaunchpadExplorer: React.FC<Props> = ({ onSelectMint }) => {
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [launchpads, setLaunchpads] = useState<LaunchpadDef[]>(() => buildLaunchpadList("all"));
  const [selectedPadId, setSelectedPadId] = useState<string>("");
  const [tokens, setTokens] = useState<LaunchpadToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("volume");
  const [selectedToken, setSelectedToken] = useState<LaunchpadToken | null>(null);

  // Rebuild launchpad list when chain changes
  useEffect(() => {
    const pads = buildLaunchpadList(selectedChain);
    setLaunchpads(pads);
    if (pads.length > 0 && !pads.find(p => p.id === selectedPadId)) {
      setSelectedPadId(pads[0].id);
    }
  }, [selectedChain]);

  // Set initial pad
  useEffect(() => {
    if (!selectedPadId && launchpads.length > 0) setSelectedPadId(launchpads[0].id);
  }, [launchpads]);

  const pad = launchpads.find(l => l.id === selectedPadId);

  const fetchTokens = useCallback(async () => {
    if (!pad) return;
    setLoading(true);
    try {
      const allTokens: LaunchpadToken[] = [];
      const seen = new Set<string>();
      const targetChainSlug = getChain(pad.chainId).dexScreenerSlug;

      for (const term of pad.searchTerms.slice(0, 2)) {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(term)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const pairs = (data?.pairs || [])
            .filter((p: any) => p.chainId === targetChainSlug)
            .slice(0, 15);

          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (!addr || seen.has(addr)) continue;
            seen.add(addr);

            const created = pair.pairCreatedAt ? new Date(pair.pairCreatedAt) : null;
            const ageMs = created ? Date.now() - created.getTime() : 0;
            const ageMins = Math.floor(ageMs / 60000);
            let age = "";
            if (ageMins < 60) age = `${ageMins}m`;
            else if (ageMins < 1440) age = `${Math.floor(ageMins / 60)}h`;
            else age = `${Math.floor(ageMins / 1440)}d`;

            allTokens.push({
              address: addr,
              symbol: pair.baseToken?.symbol || "???",
              name: pair.baseToken?.name || "Unknown",
              imageUrl: pair.info?.imageUrl,
              price: parseFloat(pair.priceUsd || "0"),
              priceChange24h: pair.priceChange?.h24 || 0,
              volume24h: pair.volume?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              marketCap: pair.marketCap || pair.fdv || 0,
              txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
              pairAddress: pair.pairAddress,
              age,
              chainId: pad.chainId,
              chainEmoji: pad.chainEmoji,
            });
          }
        } catch {}
      }

      // Also fetch boosted tokens for this chain that might match the launchpad
      try {
        const boostRes = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
        if (boostRes.ok) {
          const boostData = await boostRes.json();
          const chainBoosts = (Array.isArray(boostData) ? boostData : [])
            .filter((t: any) => t.chainId === targetChainSlug)
            .slice(0, 10);

          for (const t of chainBoosts) {
            if (seen.has(t.tokenAddress)) continue;
            try {
              const r = await fetch(`https://api.dexscreener.com/tokens/v1/${targetChainSlug}/${t.tokenAddress}`);
              if (!r.ok) continue;
              const d = await r.json();
              const pairs = Array.isArray(d) ? d : d?.pairs || [];
              const pair = pairs[0];
              if (!pair) continue;

              const text = `${pair.baseToken?.name} ${pair.baseToken?.symbol} ${pair.info?.description || ""}`.toLowerCase();
              const isMatch = pad.searchTerms.some(term => text.includes(term));
              if (!isMatch) continue;

              seen.add(t.tokenAddress);
              allTokens.push({
                address: t.tokenAddress,
                symbol: pair.baseToken?.symbol || "???",
                name: pair.baseToken?.name || "Unknown",
                imageUrl: t.icon || pair.info?.imageUrl,
                price: parseFloat(pair.priceUsd || "0"),
                priceChange24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                liquidity: pair.liquidity?.usd || 0,
                marketCap: pair.marketCap || pair.fdv || 0,
                txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
                pairAddress: pair.pairAddress,
                chainId: pad.chainId,
                chainEmoji: pad.chainEmoji,
              });
            } catch {}
          }
        }
      } catch {}

      // Sort
      switch (sortBy) {
        case "volume": allTokens.sort((a, b) => b.volume24h - a.volume24h); break;
        case "mcap": allTokens.sort((a, b) => b.marketCap - a.marketCap); break;
        case "change": allTokens.sort((a, b) => b.priceChange24h - a.priceChange24h); break;
        case "newest": allTokens.sort((a, b) => (a.age || "z").localeCompare(b.age || "z")); break;
      }

      setTokens(allTokens);
    } catch (e) {
      console.error("MultiChainLaunchpadExplorer error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedPadId, sortBy, pad]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // Token detail view
  if (selectedToken && pad) {
    const t = selectedToken;
    const chain = getChain(t.chainId);
    const chartUrl = t.pairAddress
      ? `https://dexscreener.com/${chain.dexScreenerSlug}/${t.pairAddress}?embed=1&theme=dark&info=0`
      : `https://dexscreener.com/${chain.dexScreenerSlug}/${t.address}?embed=1&theme=dark&info=0`;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedToken(null)} className="p-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-white">
            <ArrowUpRight className="h-4 w-4 rotate-[-135deg]" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            {t.imageUrl && <img src={t.imageUrl} className="w-8 h-8 rounded-full" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">{t.symbol}</span>
                <Badge className={cn("text-[7px]", pad.color)}>{pad.emoji} {pad.name}</Badge>
                <Badge className={cn("text-[7px]", chain.accent)}>{chain.emoji} {chain.shortName}</Badge>
              </div>
              <p className="text-[10px] text-white/20">{t.name}</p>
            </div>
          </div>
          {onSelectMint && (
            <button onClick={() => { onSelectMint(t.address); setSelectedToken(null); }}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">
              Scan
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Price", value: t.price < 0.01 ? `$${t.price.toFixed(8)}` : fmtUsd(t.price) },
            { label: "Market Cap", value: fmtUsd(t.marketCap) },
            { label: "24h Volume", value: fmtUsd(t.volume24h) },
            { label: "Liquidity", value: fmtUsd(t.liquidity) },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
              <p className="text-[8px] text-white/20 uppercase">{s.label}</p>
              <p className="text-xs font-black text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-black">
          <iframe src={chartUrl} className="w-full h-[400px] border-0" title={`${t.symbol} chart`} />
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <span className="text-[9px] text-white/20">CA:</span>
          <span className="text-[10px] text-white/40 font-mono flex-1 truncate">{t.address}</span>
          <button onClick={() => { navigator.clipboard.writeText(t.address); }} className="text-[9px] text-primary">Copy</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Chain selector */}
      <ChainSelector selectedChain={selectedChain} onSelectChain={setSelectedChain} compact />

      {/* Launchpad selector — horizontal cards */}
      {launchpads.length === 0 ? (
        <div className="py-8 text-center">
          <Rocket className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
          <p className="text-xs text-white/20">No launchpads configured for {selectedChain === "all" ? "any chain" : getChain(selectedChain).name}</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {launchpads.map(lp => (
              <button
                key={`${lp.chainId}:${lp.id}`}
                onClick={() => setSelectedPadId(lp.id)}
                className={cn(
                  "shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
                  selectedPadId === lp.id
                    ? `bg-gradient-to-br ${lp.color} border-opacity-100`
                    : "bg-white/[0.02] border-white/[0.06] opacity-50 hover:opacity-80"
                )}
              >
                <span className="text-xl">{lp.emoji}</span>
                <div className="text-left">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-bold text-white">{lp.name}</p>
                    <span className="text-[9px] opacity-60">{lp.chainEmoji}</span>
                  </div>
                  <p className="text-[9px] text-white/30">{lp.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Sort + controls */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(["volume", "mcap", "change", "newest"] as SortBy[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn("px-2 py-1 rounded text-[9px] font-medium",
                    sortBy === s ? "bg-primary/10 text-primary" : "text-white/15"
                  )}
                >
                  {s === "volume" ? "Volume" : s === "mcap" ? "MCap" : s === "change" ? "Gainers" : "Newest"}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={fetchTokens} className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40">
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
            </button>
            <span className="text-[9px] text-white/10">{tokens.length} tokens</span>
          </div>

          {/* Token list */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_70px] sm:grid-cols-[1fr_90px_90px_90px_70px] gap-1 px-3 py-2 border-b border-white/[0.06] text-[8px] text-white/20 uppercase tracking-wider">
              <span>Token</span>
              <span className="text-right">Price</span>
              <span className="text-right hidden sm:block">MCap</span>
              <span className="text-right">Volume</span>
              <span className="text-right">24h</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 text-white/10 animate-spin" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="py-12 text-center">
                <Rocket className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
                <p className="text-xs text-white/20">No tokens found for {pad?.name}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-[500px] overflow-y-auto">
                {tokens.map((t, i) => (
                  <button
                    key={t.address}
                    onClick={() => setSelectedToken(t)}
                    className="w-full grid grid-cols-[1fr_80px_80px_70px] sm:grid-cols-[1fr_90px_90px_90px_70px] gap-1 px-3 py-2.5 hover:bg-white/[0.02] transition-colors text-left items-center"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] text-white/10 w-4">{i + 1}</span>
                      {t.imageUrl ? (
                        <img src={t.imageUrl} className="w-7 h-7 rounded-full shrink-0" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/20 shrink-0">
                          {t.symbol?.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[11px] font-bold text-white truncate">{t.symbol}</p>
                          <span className="text-[8px] opacity-50">{t.chainEmoji}</span>
                        </div>
                        <p className="text-[9px] text-white/15 truncate">{t.name}</p>
                      </div>
                      {t.age && <span className="text-[8px] text-white/10 shrink-0">{t.age}</span>}
                    </div>
                    <span className="text-[10px] text-white/60 text-right font-mono">
                      {t.price < 0.01 ? `$${t.price.toFixed(8)}` : `$${t.price.toFixed(4)}`}
                    </span>
                    <span className="text-[10px] text-white/40 text-right hidden sm:block">{fmtUsd(t.marketCap)}</span>
                    <span className="text-[10px] text-white/40 text-right">{fmtUsd(t.volume24h)}</span>
                    <span className={cn("text-[10px] font-bold text-right flex items-center justify-end gap-0.5",
                      t.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {t.priceChange24h >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                      {Math.abs(t.priceChange24h).toFixed(1)}%
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Launchpad link */}
          {pad?.website && (
            <a href={pad.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-white/15 hover:text-primary transition-colors">
              Visit {pad.name} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
      )}
    </div>
  );
};

export default MultiChainLaunchpadExplorer;
