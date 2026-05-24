/**
 * TokenExplorer — Full DexScreener-style token discovery.
 * Categories: Trending, New, Verified, Viral, Top Gainers, Top Volume.
 * Each token card shows price, mcap, volume, liquidity, 24h change.
 * Click to see full token detail with chart embed.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Flame, Sparkles, TrendingUp, Clock, Shield, Zap, RefreshCw, ArrowUpRight, ArrowDownRight, ExternalLink, Star, ChevronDown, Filter, BarChart3, Droplets, Users, Volume2, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { jupSearchToken, fmtUsd, fmtNum, shortAddr, DEXSCREENER_WEB_BASE, SOLANA_CHAIN_ID, type JupTokenInfo } from "@/lib/og";

/* ── Types ───────────────────────────────────────────────────── */
interface DiscoverToken {
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
}

type Category = "trending" | "gainers" | "new" | "volume" | "viral";

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "trending", label: "🔥 Trending", icon: <Flame className="h-3.5 w-3.5" />, desc: "Most boosted tokens" },
  { id: "gainers", label: "🚀 Top Gainers", icon: <TrendingUp className="h-3.5 w-3.5" />, desc: "Biggest 24h price movers" },
  { id: "new", label: "🆕 New Pairs", icon: <Clock className="h-3.5 w-3.5" />, desc: "Just listed" },
  { id: "volume", label: "📊 Top Volume", icon: <BarChart3 className="h-3.5 w-3.5" />, desc: "Highest trading volume" },
  { id: "viral", label: "⚡ Viral", icon: <Zap className="h-3.5 w-3.5" />, desc: "Rapidly gaining attention" },
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

export const TokenExplorer: React.FC<Props> = ({ onSelectMint }) => {
  const [category, setCategory] = useState<Category>("trending");
  const [tokens, setTokens] = useState<DiscoverToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [mcapFilter, setMcapFilter] = useState(0);
  const [selectedToken, setSelectedToken] = useState<DiscoverToken | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  /* ── Fetch tokens from DexScreener ── */
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      let url = "";
      switch (category) {
        case "trending":
          url = "https://api.dexscreener.com/token-boosts/top/v1";
          break;
        case "gainers":
        case "volume":
        case "new":
        case "viral":
          url = "https://api.dexscreener.com/token-boosts/top/v1";
          break;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();

      const solanaTokens = (Array.isArray(data) ? data : [])
        .filter((t: any) => t.chainId === "solana")
        .slice(0, 30);

      const detailed: DiscoverToken[] = [];
      // Batch fetch — max 10 concurrent
      const chunks: any[][] = [];
      for (let i = 0; i < solanaTokens.length; i += 5) {
        chunks.push(solanaTokens.slice(i, i + 5));
      }

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (t: any) => {
            const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${t.tokenAddress}`);
            if (!r.ok) return null;
            const d = await r.json();
            const pairs = Array.isArray(d) ? d : d?.pairs || [];
            const pair = pairs[0];
            if (!pair) return null;
            return {
              address: t.tokenAddress,
              symbol: pair.baseToken?.symbol || "???",
              name: pair.baseToken?.name || "Unknown",
              imageUrl: t.icon || pair.info?.imageUrl,
              price: parseFloat(pair.priceUsd || "0"),
              priceChange24h: pair.priceChange?.h24 || 0,
              priceChange1h: pair.priceChange?.h1 || 0,
              volume24h: pair.volume?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              marketCap: pair.marketCap || pair.fdv || 0,
              pairAddress: pair.pairAddress,
              fdv: pair.fdv || 0,
              txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
              createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
            } as DiscoverToken;
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) detailed.push(r.value);
        }
      }

      // Sort by category
      switch (category) {
        case "gainers": detailed.sort((a, b) => b.priceChange24h - a.priceChange24h); break;
        case "volume": detailed.sort((a, b) => b.volume24h - a.volume24h); break;
        case "new": detailed.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")); break;
        case "viral": detailed.sort((a, b) => b.txns24h - a.txns24h); break;
      }

      setTokens(detailed);
    } catch (e) {
      console.error("TokenExplorer fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  /* ── Search ── */
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try { setSearchResults((await jupSearchToken(q)).slice(0, 8)); }
      catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  };

  /* ── Filter ── */
  const filtered = tokens.filter(t => {
    const f = MCAP_FILTERS[mcapFilter];
    return t.marketCap >= f.min && t.marketCap < f.max;
  });

  /* ── Token detail view ── */
  if (selectedToken) {
    const t = selectedToken;
    const chartUrl = t.pairAddress
      ? `https://dexscreener.com/solana/${t.pairAddress}?embed=1&theme=dark&info=0`
      : `https://dexscreener.com/solana/${t.address}?embed=1&theme=dark&info=0`;
    return (
      <div className="space-y-3">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedToken(null)} className="p-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-white">
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            {t.imageUrl && <img src={t.imageUrl} className="w-8 h-8 rounded-full" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">{t.symbol}</span>
                <span className={cn("text-xs font-bold", t.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] text-white/20">{t.name}</p>
            </div>
          </div>
          <a href={`${DEXSCREENER_WEB_BASE}/solana/${t.address}`} target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-lg border border-white/[0.08] text-white/20 hover:text-primary">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {onSelectMint && (
            <button onClick={() => { onSelectMint(t.address); setSelectedToken(null); }}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">
              Scan
            </button>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Price", value: t.price < 0.01 ? `$${t.price.toFixed(8)}` : fmtUsd(t.price) },
            { label: "Market Cap", value: fmtUsd(t.marketCap) },
            { label: "24h Volume", value: fmtUsd(t.volume24h) },
            { label: "Liquidity", value: fmtUsd(t.liquidity) },
            { label: "FDV", value: fmtUsd(t.fdv) },
            { label: "24h Txns", value: fmtNum(t.txns24h) },
            { label: "1h Change", value: `${t.priceChange1h >= 0 ? "+" : ""}${t.priceChange1h.toFixed(1)}%`, color: t.priceChange1h >= 0 },
            { label: "24h Change", value: `${t.priceChange24h >= 0 ? "+" : ""}${t.priceChange24h.toFixed(1)}%`, color: t.priceChange24h >= 0 },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
              <p className="text-[8px] text-white/20 uppercase">{s.label}</p>
              <p className={cn("text-xs font-black mt-0.5",
                s.color !== undefined ? (s.color ? "text-emerald-400" : "text-red-400") : "text-white"
              )}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Chart embed */}
        <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-black">
          <iframe src={chartUrl} className="w-full h-[400px] border-0" title={`${t.symbol} chart`} />
        </div>

        {/* Contract address */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <span className="text-[9px] text-white/20">CA:</span>
          <span className="text-[10px] text-white/40 font-mono flex-1 truncate">{t.address}</span>
          <button onClick={() => { navigator.clipboard.writeText(t.address); }} className="text-[9px] text-primary hover:underline">Copy</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
        <Input
          placeholder="Search any token by name, symbol, or address..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="pl-10 h-10 text-sm bg-white/[0.03] border-white/[0.08] rounded-xl"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 animate-spin" />}
        {searchQuery && !searching && (
          <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0f] overflow-hidden divide-y divide-white/[0.04]">
          {searchResults.map(r => (
            <button
              key={r.address}
              onClick={() => {
                setSelectedToken({
                  address: r.address,
                  symbol: r.symbol,
                  name: r.name || "",
                  imageUrl: r.logoURI,
                  price: 0,
                  priceChange24h: 0,
                  priceChange1h: 0,
                  volume24h: 0,
                  liquidity: r.liquidity || 0,
                  marketCap: r.mcap || 0,
                  fdv: 0,
                  txns24h: 0,
                });
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors text-left"
            >
              {r.logoURI ? (
                <img src={r.logoURI} className="w-8 h-8 rounded-full" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/20">
                  {r.symbol?.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{r.symbol}</p>
                <p className="text-[10px] text-white/20 truncate">{r.name}</p>
              </div>
              {r.mcap ? <span className="text-[10px] text-white/30">{fmtUsd(r.mcap)}</span> : null}
            </button>
          ))}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn("shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap",
              category === c.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-white/25 hover:text-white/40 border border-transparent"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40">
          <Filter className="h-3 w-3" /> Filters
        </button>
        {showFilters && (
          <div className="flex gap-1">
            {MCAP_FILTERS.map((f, i) => (
              <button
                key={i}
                onClick={() => setMcapFilter(i)}
                className={cn("px-2 py-0.5 rounded text-[9px]",
                  mcapFilter === i ? "bg-primary/10 text-primary" : "text-white/15"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <button onClick={fetchTokens} className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
        </button>
        <span className="text-[9px] text-white/10">{filtered.length} tokens</span>
      </div>

      {/* Token table */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_90px_90px_90px_80px_60px] gap-1 px-3 py-2 border-b border-white/[0.06] text-[8px] text-white/20 uppercase tracking-wider">
          <span>Token</span>
          <span className="text-right">Price</span>
          <span className="text-right hidden sm:block">MCap</span>
          <span className="text-right">24h Vol</span>
          <span className="text-right">24h</span>
          <span className="text-right hidden sm:block">Liq</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-white/10 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Search className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No tokens found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto">
            {filtered.map((t, i) => (
              <button
                key={t.address}
                onClick={() => setSelectedToken(t)}
                className="w-full grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_90px_90px_90px_80px_60px] gap-1 px-3 py-2.5 hover:bg-white/[0.02] transition-colors text-left items-center"
              >
                {/* Token info */}
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
                    <p className="text-[11px] font-bold text-white truncate">{t.symbol}</p>
                    <p className="text-[9px] text-white/15 truncate">{t.name}</p>
                  </div>
                </div>
                {/* Price */}
                <span className="text-[10px] text-white/60 text-right font-mono">
                  {t.price < 0.01 ? `$${t.price.toFixed(8)}` : `$${t.price.toFixed(4)}`}
                </span>
                {/* MCap */}
                <span className="text-[10px] text-white/40 text-right hidden sm:block">{fmtUsd(t.marketCap)}</span>
                {/* Volume */}
                <span className="text-[10px] text-white/40 text-right">{fmtUsd(t.volume24h)}</span>
                {/* 24h change */}
                <span className={cn("text-[10px] font-bold text-right flex items-center justify-end gap-0.5",
                  t.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {t.priceChange24h >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                  {Math.abs(t.priceChange24h).toFixed(1)}%
                </span>
                {/* Liquidity */}
                <span className="text-[10px] text-white/30 text-right hidden sm:block">{fmtUsd(t.liquidity)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenExplorer;
