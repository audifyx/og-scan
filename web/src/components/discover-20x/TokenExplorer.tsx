/**
 * TokenExplorer — DexScreener-powered token discovery with rich card UI.
 * Categories: Trending, New, Top Gainers, Top Volume, Viral.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Flame, Sparkles, TrendingUp, Clock, Shield, Zap, RefreshCw, ArrowUpRight, ArrowDownRight, ExternalLink, Star, ChevronDown, Filter, BarChart3, Droplets, Users, Volume2, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { jupSearchToken, fmtUsd, fmtNum, shortAddr, DEXSCREENER_WEB_BASE, SOLANA_CHAIN_ID, type JupTokenInfo } from "@/lib/og";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";

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
  { id: "gainers", label: "🚀 Gainers", icon: <TrendingUp className="h-3.5 w-3.5" />, desc: "Biggest 24h movers" },
  { id: "new", label: "🆕 New", icon: <Clock className="h-3.5 w-3.5" />, desc: "Just listed" },
  { id: "volume", label: "📊 Volume", icon: <BarChart3 className="h-3.5 w-3.5" />, desc: "Highest volume" },
  { id: "viral", label: "⚡ Viral", icon: <Zap className="h-3.5 w-3.5" />, desc: "Going viral" },
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

      const resp = await fetch(url);
      const rawBoosts = await resp.json();
      const solanaMints = (rawBoosts as any[])
        .filter((b: any) => b.chainId === "solana" && b.tokenAddress)
        .map((b: any) => b.tokenAddress as string);
      const uniqueMints = [...new Set(solanaMints)].slice(0, 50);

      // Fetch pair data
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueMints.length; i += 30) chunks.push(uniqueMints.slice(i, i + 30));
      const pairResponses = await Promise.allSettled(
        chunks.map((c) => fetch(`https://api.dexscreener.com/tokens/v1/solana/${c.join(",")}`).then((r) => r.json()))
      );
      const allPairs: any[] = pairResponses.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

      // Dedupe by base token address
      const best = new Map<string, any>();
      for (const pair of allPairs) {
        const addr = pair.baseToken?.address;
        if (!addr) continue;
        const prev = best.get(addr);
        if (!prev || (pair.volume?.h24 ?? 0) > (prev.volume?.h24 ?? 0)) best.set(addr, pair);
      }

      let results: DiscoverToken[] = Array.from(best.values()).map((pair: any) => ({
        address: pair.baseToken.address,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
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
      }));

      // Sort by category
      switch (category) {
        case "gainers": results.sort((a, b) => b.priceChange24h - a.priceChange24h); break;
        case "volume": results.sort((a, b) => b.volume24h - a.volume24h); break;
        case "new": results.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")); break;
        case "viral": results.sort((a, b) => b.priceChange1h - a.priceChange1h); break;
        default: break;
      }

      setTokens(results);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  /* ── Search ── */
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await jupSearchToken(q);
        setSearchResults(results.slice(0, 8));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
  }, []);

  /* ── Filter ── */
  const filter = MCAP_FILTERS[mcapFilter];
  const filtered = tokens.filter((t) => t.marketCap >= filter.min && t.marketCap < filter.max);

  return (
    <div className="space-y-4">
      {/* Search + filter row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search tokens..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:border-primary/30 focus:outline-none"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 animate-spin" />}
          {searchResults.length > 0 && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-white/[0.1] bg-[#0d1627] shadow-2xl max-h-60 overflow-y-auto">
              {searchResults.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedToken({ address: t.id, symbol: t.symbol || "", name: t.name || "", imageUrl: t.icon || undefined, price: t.usdPrice || 0, priceChange24h: t.stats24h?.priceChange || 0, priceChange1h: 0, volume24h: 0, liquidity: 0, marketCap: t.mcap || 0, fdv: t.fdv || 0, txns24h: 0 }); setSearchQuery(""); setSearchResults([]); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                >
                  {t.icon ? <img src={t.icon} className="w-7 h-7 rounded-full" alt="" /> : <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/20">{t.symbol?.charAt(0)}</div>}
                  <div>
                    <span className="text-xs font-bold text-white">{t.symbol}</span>
                    <span className="text-[10px] text-white/30 ml-2">{t.name}</span>
                  </div>
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
          <p className="text-xs text-white/20">No tokens found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map((t, i) => (
            <button
              key={t.address}
              onClick={() => setSelectedToken(t)}
              className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition hover:border-primary/20 hover:bg-white/[0.04] active:scale-[0.99]"
            >
              {/* Rank badge */}
              <div className="absolute top-2.5 right-2.5 text-[9px] font-bold text-white/10">#{i + 1}</div>

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
          ))}
        </div>
      )}

      {/* Token detail dialog */}
      {selectedToken && (
        <CoinDetailDialog
          key={selectedToken.address}
          token={{
            id: selectedToken.address,
            name: selectedToken.name,
            symbol: selectedToken.symbol,
            icon: selectedToken.imageUrl,
            decimals: 9,
            usdPrice: selectedToken.price,
            mcap: selectedToken.marketCap,
            fdv: selectedToken.fdv,
            liquidity: selectedToken.liquidity,
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
