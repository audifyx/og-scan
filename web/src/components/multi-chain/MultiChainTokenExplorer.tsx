/**
 * MultiChainTokenExplorer — DexScreener-powered token discovery across ALL chains.
 * Enhanced version of TokenExplorer that supports chain filtering.
 * When "All Chains" is selected, shows top tokens from every chain mixed together.
 *
 * DOES NOT replace TokenExplorer — this is an additive component.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Flame, TrendingUp, Clock, Zap, RefreshCw, ArrowUpRight, ArrowDownRight, Filter, BarChart3, Loader2, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtNum, DEXSCREENER_WEB_BASE } from "@/lib/og";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { SUPPORTED_CHAINS, getChain, type ChainConfig } from "@/lib/chains";
import { ChainSelector } from "./ChainSelector";

/* ── Types ───────────────────────────────────────────────────── */
interface MultiChainToken {
  address: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  price: number;
  priceChange24h: number;
  priceChange1h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  pairAddress?: string;
  fdv: number;
  txns24h: number;
  createdAt?: string;
  chainId: string;
  chainEmoji: string;
  chainName: string;
}

type Category = "trending" | "gainers" | "new" | "volume" | "viral";

const CATEGORIES: { id: Category; label: string; desc: string }[] = [
  { id: "trending", label: "🔥 Trending", desc: "Most boosted tokens" },
  { id: "gainers", label: "🚀 Gainers", desc: "Biggest 24h movers" },
  { id: "new", label: "🆕 New", desc: "Just listed" },
  { id: "volume", label: "📊 Volume", desc: "Highest volume" },
  { id: "viral", label: "⚡ Viral", desc: "Going viral" },
];

const MCAP_FILTERS = [
  { label: "All", min: 0, max: Infinity },
  { label: "< $100K", min: 0, max: 100_000 },
  { label: "$100K–$1M", min: 100_000, max: 1_000_000 },
  { label: "$1M–$10M", min: 1_000_000, max: 10_000_000 },
  { label: "$10M+", min: 10_000_000, max: Infinity },
];

interface Props {
  onSelectMint?: (mint: string) => void;
}

export const MultiChainTokenExplorer: React.FC<Props> = ({ onSelectMint }) => {
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [category, setCategory] = useState<Category>("trending");
  const [tokens, setTokens] = useState<MultiChainToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MultiChainToken[]>([]);
  const [searching, setSearching] = useState(false);
  const [mcapFilter, setMcapFilter] = useState(0);
  const [selectedToken, setSelectedToken] = useState<MultiChainToken | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  /* ── Fetch tokens from DexScreener ── */
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch boosts (DexScreener top boosted — multi-chain by default)
      const resp = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
      const rawBoosts: any[] = await resp.json();

      // Filter by chain if needed
      const chainIds = selectedChain === "all"
        ? new Set(SUPPORTED_CHAINS.map(c => c.dexScreenerSlug))
        : new Set([getChain(selectedChain).dexScreenerSlug]);

      const filteredBoosts = rawBoosts
        .filter((b: any) => b.chainId && chainIds.has(b.chainId) && b.tokenAddress)
        .slice(0, 60);

      // Group by chain for batch fetching
      const byChain = new Map<string, string[]>();
      for (const b of filteredBoosts) {
        const existing = byChain.get(b.chainId) || [];
        if (!existing.includes(b.tokenAddress)) {
          existing.push(b.tokenAddress);
          byChain.set(b.chainId, existing);
        }
      }

      const allTokens: MultiChainToken[] = [];
      const seen = new Set<string>();

      // Fetch pair data for each chain
      const fetchPromises = Array.from(byChain.entries()).map(async ([dexChainId, mints]) => {
        const chunks: string[][] = [];
        for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));

        for (const chunk of chunks) {
          try {
            const r = await fetch(`https://api.dexscreener.com/tokens/v1/${dexChainId}/${chunk.join(",")}`);
            if (!r.ok) continue;
            const pairs: any[] = await r.json();
            if (!Array.isArray(pairs)) continue;

            // Dedupe by base token address
            for (const pair of pairs) {
              const addr = pair.baseToken?.address;
              if (!addr) continue;
              const key = `${pair.chainId}:${addr}`;
              if (seen.has(key)) continue;
              seen.add(key);

              const chain = SUPPORTED_CHAINS.find(c => c.dexScreenerSlug === pair.chainId);
              if (!chain) continue;

              allTokens.push({
                address: addr,
                symbol: pair.baseToken?.symbol || "???",
                name: pair.baseToken?.name || "Unknown",
                imageUrl: pair.info?.imageUrl,
                price: parseFloat(pair.priceUsd || "0"),
                priceChange24h: pair.priceChange?.h24 ?? 0,
                priceChange1h: pair.priceChange?.h1 ?? 0,
                volume24h: pair.volume?.h24 ?? 0,
                liquidity: pair.liquidity?.usd ?? 0,
                marketCap: pair.marketCap ?? pair.fdv ?? 0,
                pairAddress: pair.pairAddress,
                fdv: pair.fdv ?? 0,
                txns24h: (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0),
                createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
                chainId: chain.id,
                chainEmoji: chain.emoji,
                chainName: chain.name,
              });
            }
          } catch {}
        }
      });

      await Promise.all(fetchPromises);

      // Sort by category
      switch (category) {
        case "gainers": allTokens.sort((a, b) => b.priceChange24h - a.priceChange24h); break;
        case "volume": allTokens.sort((a, b) => b.volume24h - a.volume24h); break;
        case "new": allTokens.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")); break;
        case "viral": allTokens.sort((a, b) => b.priceChange1h - a.priceChange1h); break;
        default: break; // trending keeps boost order
      }

      setTokens(allTokens);
    } catch (err) {
      console.error("MultiChainTokenExplorer fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedChain, category]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  /* ── DexScreener multi-chain search ── */
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const resp = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
        if (!resp.ok) throw new Error("Search failed");
        const data = await resp.json();
        const pairs = data?.pairs || [];

        const chainIds = selectedChain === "all"
          ? new Set(SUPPORTED_CHAINS.map(c => c.dexScreenerSlug))
          : new Set([getChain(selectedChain).dexScreenerSlug]);

        const seen = new Set<string>();
        const results: MultiChainToken[] = [];

        for (const pair of pairs) {
          if (!pair.baseToken?.address || !chainIds.has(pair.chainId)) continue;
          const key = `${pair.chainId}:${pair.baseToken.address}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const chain = SUPPORTED_CHAINS.find(c => c.dexScreenerSlug === pair.chainId);
          if (!chain) continue;

          results.push({
            address: pair.baseToken.address,
            symbol: pair.baseToken.symbol || "???",
            name: pair.baseToken.name || "Unknown",
            imageUrl: pair.info?.imageUrl,
            price: parseFloat(pair.priceUsd || "0"),
            priceChange24h: pair.priceChange?.h24 ?? 0,
            priceChange1h: pair.priceChange?.h1 ?? 0,
            volume24h: pair.volume?.h24 ?? 0,
            liquidity: pair.liquidity?.usd ?? 0,
            marketCap: pair.marketCap ?? pair.fdv ?? 0,
            pairAddress: pair.pairAddress,
            fdv: pair.fdv ?? 0,
            txns24h: (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0),
            chainId: chain.id,
            chainEmoji: chain.emoji,
            chainName: chain.name,
          });

          if (results.length >= 12) break;
        }
        setSearchResults(results);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
  }, [selectedChain]);

  /* ── Filter ── */
  const filter = MCAP_FILTERS[mcapFilter];
  const filtered = tokens.filter((t) => t.marketCap >= filter.min && t.marketCap < filter.max);

  return (
    <div className="space-y-4">
      {/* Chain selector */}
      <ChainSelector selectedChain={selectedChain} onSelectChain={setSelectedChain} compact />

      {/* Search + filter row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={selectedChain === "all" ? "Search tokens across all chains..." : `Search on ${getChain(selectedChain).name}...`}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:border-primary/30 focus:outline-none"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 animate-spin" />}
          {searchResults.length > 0 && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-white/[0.1] bg-[#0d1627] shadow-2xl max-h-60 overflow-y-auto">
              {searchResults.map((t) => (
                <button
                  key={`${t.chainId}:${t.address}`}
                  onClick={() => { setSelectedToken(t); setSearchQuery(""); setSearchResults([]); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                >
                  {t.imageUrl ? <img src={t.imageUrl} className="w-7 h-7 rounded-full" alt="" /> : <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/20">{t.symbol?.charAt(0)}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{t.symbol}</span>
                      <span className="text-[10px] text-white/30">{t.name}</span>
                    </div>
                  </div>
                  <Badge className={cn("text-[7px] py-0 shrink-0", getChain(t.chainId).accent)}>
                    {t.chainEmoji} {getChain(t.chainId).shortName}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[10px] font-semibold transition", showFilters ? "border-primary/30 bg-primary/10 text-primary" : "border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/50")}>
          <Filter className="h-3 w-3" /> Filter
        </button>
        <button onClick={fetchTokens} className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[10px] font-semibold text-white/30 hover:text-white/50 transition">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>

      {/* Mcap filter pills */}
      {showFilters && (
        <div className="flex gap-1.5 flex-wrap">
          {MCAP_FILTERS.map((f, i) => (
            <button key={f.label} onClick={() => setMcapFilter(i)}
              className={cn("px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition",
                mcapFilter === i ? "bg-primary/15 text-primary border border-primary/25" : "bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/40"
              )}>{f.label}</button>
          ))}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={cn("shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition whitespace-nowrap",
              category === c.id ? "bg-primary/10 text-primary border border-primary/20" : "text-white/25 hover:text-white/40 border border-transparent"
            )}>{c.label}</button>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[9px] text-white/20">
        <span>{filtered.length} tokens</span>
        <span>·</span>
        <span>{selectedChain === "all" ? `Across ${SUPPORTED_CHAINS.length} chains` : getChain(selectedChain).name}</span>
        <span>·</span>
        <span>{CATEGORIES.find(c => c.id === category)?.desc}</span>
      </div>

      {/* Token grid — card layout */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-primary/30 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Search className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
          <p className="text-xs text-white/20">No tokens found{selectedChain !== "all" ? ` on ${getChain(selectedChain).name}` : ""}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map((t, i) => {
            const chain = getChain(t.chainId);
            return (
              <button
                key={`${t.chainId}:${t.address}`}
                onClick={() => setSelectedToken(t)}
                className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition hover:border-primary/20 hover:bg-white/[0.04] active:scale-[0.99]"
              >
                {/* Rank badge */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <Badge className={cn("text-[7px] py-0", chain.accent)}>
                    {chain.emoji} {chain.shortName}
                  </Badge>
                  <span className="text-[9px] font-bold text-white/10">#{i + 1}</span>
                </div>

                {/* Top: icon + name + price change */}
                <div className="flex items-center gap-3">
                  {t.imageUrl ? (
                    <img src={t.imageUrl} className="w-10 h-10 rounded-full border border-white/[0.08] shrink-0" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-white/[0.04] border border-white/[0.08] flex items-center justify-center text-sm font-black text-white/30 shrink-0">{t.symbol?.charAt(0)}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">{t.symbol}</span>
                      <span className={cn("text-[10px] font-bold flex items-center gap-0.5 shrink-0",
                        t.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {t.priceChange24h >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                        {Math.abs(t.priceChange24h).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-white/25 truncate">{t.name}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mt-3 text-base font-bold font-mono text-white/80">
                  {t.price < 0.0001 ? `$${t.price.toExponential(2)}` : t.price < 0.01 ? `$${t.price.toFixed(6)}` : `$${t.price.toFixed(4)}`}
                </div>

                {/* Stats grid */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-white/15">MCap</p>
                    <p className="text-[10px] font-semibold text-white/50">{fmtUsd(t.marketCap)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-white/15">Volume</p>
                    <p className="text-[10px] font-semibold text-white/50">{fmtUsd(t.volume24h)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-white/15">Liquidity</p>
                    <p className="text-[10px] font-semibold text-white/50">{fmtUsd(t.liquidity)}</p>
                  </div>
                </div>

                {/* Subtle accent line */}
                <div className={cn("absolute bottom-0 left-0 right-0 h-[2px] opacity-0 transition group-hover:opacity-100",
                  t.priceChange24h >= 0 ? "bg-gradient-to-r from-emerald-500/40 via-emerald-400/20 to-transparent" : "bg-gradient-to-r from-red-500/40 via-red-400/20 to-transparent"
                )} />
              </button>
            );
          })}
        </div>
      )}

      {/* Token detail dialog */}
      {selectedToken && (
        <CoinDetailDialog
          key={`${selectedToken.chainId}:${selectedToken.address}`}
          token={{
            id: selectedToken.address,
            name: selectedToken.name,
            symbol: selectedToken.symbol,
            icon: selectedToken.imageUrl,
            decimals: selectedToken.chainId === "solana" ? 9 : 18,
            usdPrice: selectedToken.price,
            mcap: selectedToken.marketCap,
            fdv: selectedToken.fdv,
            liquidity: selectedToken.liquidity,
            chainId: selectedToken.chainId,
            stats24h: {
              priceChange: selectedToken.priceChange24h,
              buyVolume: selectedToken.volume24h / 2,
              sellVolume: selectedToken.volume24h / 2,
            },
          }}
          trigger={<span />}
          defaultOpen={true}
          onOpenChange={(open) => { if (!open) setSelectedToken(null); }}
          onOpenScanner={onSelectMint ? (mint) => onSelectMint(mint) : undefined}
        />
      )}
    </div>
  );
};

export default MultiChainTokenExplorer;
