import { useState, useEffect } from "react";
import { Search, Maximize2, X, BarChart3, ExternalLink, Star, Activity, Zap, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PairData {
  address: string;
  pairAddress?: string;
  name: string;
  symbol: string;
  category: string;
  image?: string;
  price?: string;
  priceChange24h?: number;
}

const DEFAULT_PAIRS: PairData[] = [
  { address: "So11111111111111111111111111111111111111112", name: "SOL/USDC", symbol: "SOL", category: "major" },
  { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", name: "BONK/SOL", symbol: "BONK", category: "meme" },
  { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", name: "JUP/SOL", symbol: "JUP", category: "defi" },
  { address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", name: "POPCAT/SOL", symbol: "POPCAT", category: "meme" },
  { address: "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk", name: "WEN/SOL", symbol: "WEN", category: "meme" },
  { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "USDC/SOL", symbol: "USDC", category: "stable" },
  { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", name: "USDT/SOL", symbol: "USDT", category: "stable" },
  { address: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9", name: "SOLTOOLS/SOL", symbol: "SOLTOOLS", category: "official" },
];

const Charts = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [pairs, setPairs] = useState<PairData[]>(DEFAULT_PAIRS);
  const [selectedToken, setSelectedToken] = useState(DEFAULT_PAIRS[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [customPairs, setCustomPairs] = useState<PairData[]>([]);

  const isFavorite = (addr: string) => favorites.includes(addr);

  useEffect(() => {
    const fetchPairData = async () => {
      const updated = [...DEFAULT_PAIRS];
      for (let i = 0; i < updated.length; i++) {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${updated[i].address}`);
          const data = await res.json();
          const pair = data.pairs?.[0];
          if (pair) {
            updated[i] = {
              ...updated[i],
              pairAddress: pair.pairAddress,
              image: pair.info?.imageUrl,
              price: pair.priceUsd,
              priceChange24h: pair.priceChange?.h24 || 0,
            };
          }
        } catch { /* skip */ }
      }
      setPairs([...updated, ...customPairs]);
    };
    fetchPairData();
  }, []);

  const getDexScreenerUrl = (token: PairData) => {
    const addr = token.pairAddress || token.address;
    return `https://dexscreener.com/solana/${addr}?embed=1&theme=dark&trades=0&info=0`;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      let apiUrl: string;
      if (searchQuery.length >= 32 && !searchQuery.includes(" ")) {
        apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${searchQuery}`;
      } else {
        apiUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(apiUrl);
      const data = await res.json();
      const pair = data.pairs?.[0];
      if (!pair) {
        toast({ title: "No token found", variant: "destructive" });
        return;
      }
      const newPair: PairData = {
        address: pair.baseToken?.address || searchQuery,
        pairAddress: pair.pairAddress,
        name: `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`,
        symbol: pair.baseToken?.symbol || searchQuery.slice(0, 4).toUpperCase(),
        category: "custom",
        image: pair.info?.imageUrl,
        price: pair.priceUsd,
        priceChange24h: pair.priceChange?.h24 || 0,
      };
      setSelectedToken(newPair);
      if (!pairs.find(p => p.address === newPair.address)) {
        setCustomPairs(prev => [...prev, newPair]);
        setPairs(prev => [...prev, newPair]);
      }
      setSearchQuery("");
      toast({ title: `Loaded ${newPair.symbol} chart` });
    } catch {
      toast({ title: "Failed to load token", variant: "destructive" });
    }
  };

  const toggleFavorite = (address: string) => {
    setFavorites(prev => prev.includes(address) ? prev.filter(a => a !== address) : [...prev, address]);
  };

  const removeCustomPair = (address: string) => {
    setCustomPairs(prev => prev.filter(p => p.address !== address));
    setPairs(prev => prev.filter(p => p.address !== address || DEFAULT_PAIRS.find(d => d.address === address)));
    toast({ title: "Pair removed" });
  };

  const filteredPairs = pairs.filter(pair => {
    if (category === "favorites") return favorites.includes(pair.address);
    if (category === "custom") return pair.category === "custom";
    if (category === "all") return true;
    return pair.category === category;
  });

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-background">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Badge className="bg-og-cyan/10 text-og-cyan border-og-cyan/25">{selectedToken.symbol}</Badge>
          <Button variant="outline" size="icon" className="rounded-xl bg-background/80 backdrop-blur-sm border-white/10" onClick={() => setIsFullscreen(false)}><X className="h-4 w-4" /></Button>
        </div>
        <iframe src={getDexScreenerUrl(selectedToken)} className="w-full h-full border-0" title={`${selectedToken.name} Chart`} allow="clipboard-write" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Section */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 lg:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-og-cyan/20 bg-og-cyan/5 text-og-cyan">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Forensic Charts</h3>
              <p className="text-[10px] uppercase tracking-widest text-white/30">Select any token for live charting</p>
            </div>
          </div>
          <div className="flex flex-[1.5] gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
              <input
                type="text"
                placeholder="Search name or paste contract address..."
                value={searchQuery}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-4 text-xs text-white placeholder:text-white/20 focus:border-og-cyan/40 focus:outline-none focus:bg-white/[0.06] transition-all"
              />
            </div>
            <button
              onClick={handleSearch}
              className="h-10 rounded-xl bg-og-cyan px-5 text-[11px] font-black uppercase tracking-widest text-background hover:bg-white transition-colors"
            >
              Load
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Sidebar: Pairs List */}
        <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden sticky top-20 h-fit max-h-[calc(100vh-140px)]">
          <div className="border-b border-white/[0.07] px-4 py-3 bg-white/[0.01]">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-3.5 w-3.5 text-og-gold" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Market Pairs</span>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {["all", "meme", "defi", "favorites"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all",
                    category === cat
                      ? "bg-og-cyan/10 text-og-cyan border border-og-cyan/30"
                      : "text-white/30 hover:bg-white/5 hover:text-white/60"
                  )}
                >
                  {cat === "all" ? "All" : cat === "favorites" ? "Starred" : cat}
                </button>
              ))}
            </div>
          </div>
          
          <ScrollArea className="flex-1 px-2 py-2">
            {filteredPairs.map((pair) => {
              const isActive = selectedToken.address === pair.address;
              return (
                <div
                  key={pair.address}
                  onClick={() => setSelectedToken(pair)}
                  className={cn(
                    "flex items-center justify-between rounded-xl p-2.5 mb-1 cursor-pointer transition-all border group",
                    isActive 
                      ? "bg-og-cyan/5 border-og-cyan/30 text-white" 
                      : "border-transparent text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {pair.image ? (
                        <img src={pair.image} alt={pair.symbol} className="h-8 w-8 rounded-lg object-cover border border-white/10" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold uppercase">
                          {pair.symbol.slice(0, 2)}
                        </div>
                      )}
                      {isFavorite(pair.address) && (
                        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-og-gold flex items-center justify-center border border-background">
                          <Star className="h-1.5 w-1.5 fill-background" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate tracking-tight">{pair.symbol}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-white/30">${parseFloat(pair.price || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                        {pair.priceChange24h !== undefined && (
                          <span className={cn("text-[9px] font-bold", pair.priceChange24h >= 0 ? "text-og-lime" : "text-red-400")}>
                            {pair.priceChange24h >= 0 ? "+" : ""}{pair.priceChange24h.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(pair.address); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:text-og-gold text-white/20"
                    >
                      <Star className={cn("h-3 w-3", isFavorite(pair.address) ? "fill-og-gold text-og-gold" : "")} />
                    </button>
                    {pair.category === 'custom' && (
                       <button
                       onClick={(e) => { e.stopPropagation(); removeCustomPair(pair.address); }}
                       className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:text-red-400 text-white/20"
                     >
                       <Trash2 className="h-3 w-3" />
                     </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredPairs.length === 0 && <div className="text-center py-10 text-[10px] uppercase tracking-widest text-white/20">No pairs found</div>}
          </ScrollArea>
        </div>

        {/* Chart Viewport */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden flex flex-col min-h-[600px] lg:min-h-[700px]">
          <div className="flex items-center justify-between border-b border-white/[0.07] p-4 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              {selectedToken.image ? (
                <img src={selectedToken.image} alt={selectedToken.symbol} className="h-10 w-10 rounded-xl object-cover border border-white/10" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-og-cyan/10 border border-og-cyan/20 flex items-center justify-center text-xs font-black text-og-cyan uppercase">
                  {selectedToken.symbol.slice(0, 2)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">{selectedToken.name}</h2>
                  <Badge className="bg-og-cyan/10 text-og-cyan border border-og-cyan/30 text-[9px] px-1.5 py-0 font-black">PRO DATA</Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-white/40 tracking-tighter">{selectedToken.address}</span>
                  <button onClick={() => { navigator.clipboard.writeText(selectedToken.address); toast({ title: "Address Copied" }); }} className="text-white/20 hover:text-white transition-colors">
                    <Zap className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(`https://dexscreener.com/solana/${selectedToken.address}`, "_blank")}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] h-9 px-4 text-[10px] font-black uppercase tracking-widest text-white/60 hover:border-white/20 hover:text-white transition-all"
              >
                <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">DexScreener</span>
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white transition-all"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 relative bg-background">
            <iframe
              src={getDexScreenerUrl(selectedToken)}
              className="absolute inset-0 w-full h-full border-0"
              title={`${selectedToken.name} Chart`}
              allow="clipboard-write"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Charts;
