import { useState, useEffect } from "react";
import { Search, Maximize2, X, TrendingUp, BarChart3, ExternalLink, Star, Sparkles, Activity, Zap, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

interface PairData {
  address: string;
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
  { address: "HEivoBHhWT939vcaevGgZBtoArS4CAywCMjdVBTSpump", name: "SOLTOOLS/SOL", symbol: "SOLTOOLS", category: "official" },
];

const Charts = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [pairs, setPairs] = useState<PairData[]>(DEFAULT_PAIRS);
  const [selectedToken, setSelectedToken] = useState(DEFAULT_PAIRS[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [customPairs, setCustomPairs] = useState<PairData[]>([]);

  // Fetch logos and prices for all pairs on mount
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

  const getDexScreenerUrl = (address: string) => `https://dexscreener.com/solana/${address}?embed=1&theme=dark&trades=0&info=0`;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      let apiUrl: string;
      // If it looks like a contract address (>= 32 chars, no spaces), search by token address
      if (searchQuery.length >= 32 && !searchQuery.includes(" ")) {
        apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${searchQuery}`;
      } else {
        // Search by token name
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
          <Badge className="bg-accent/20 text-accent border-accent/30">{selectedToken.symbol}</Badge>
          <Button variant="outline" size="icon" className="rounded-xl bg-background/80 backdrop-blur-sm" onClick={() => setIsFullscreen(false)}><X className="h-4 w-4" /></Button>
        </div>
        <iframe src={getDexScreenerUrl(selectedToken.address)} className="w-full h-full" title={`${selectedToken.name} Chart`} allow="clipboard-write" />
      </div>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Live Charts" description="Real-time DEX charts powered by DexScreener">
        <Badge className="bg-accent/20 text-accent border-accent/30 gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />Live</Badge>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-5">
        {/* Search */}
        <Card className="glass-card-premium overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/10"><BarChart3 className="h-5 w-5 text-primary" /></div>
              <div><h3 className="font-bold text-lg">Token Charts</h3><p className="text-sm text-muted-foreground">Enter any Solana token address for live chart</p></div>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or paste contract address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-11 h-12 bg-muted/40 border-border/50 rounded-xl text-base" />
              </div>
              <Button onClick={handleSearch} className="h-12 px-6 rounded-xl font-medium btn-premium">Load Chart</Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Activity, value: "Real-time", label: "Data", color: "text-accent" },
            { icon: Sparkles, value: pairs.length, label: "Pairs", color: "text-primary" },
            { icon: Star, value: favorites.length, label: "Favorites", color: "text-yellow-500" },
            { icon: Zap, value: customPairs.length, label: "Custom", color: "text-secondary" },
          ].map((stat, i) => (
            <Card key={i} className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="p-2.5 rounded-xl bg-muted/50"><stat.icon className={`h-5 w-5 ${stat.color}`} /></div><div><p className="text-xl font-bold">{stat.value}</p><p className="text-xs text-muted-foreground">{stat.label}</p></div></CardContent></Card>
          ))}
        </div>

        {/* Main Layout - Stack on mobile */}
        <div className="flex flex-col lg:grid lg:grid-cols-[280px_1fr] gap-5">
          {/* Pairs Sidebar */}
          <Card className="glass-card">
            <CardHeader className="pb-3"><CardTitle className="text-base">Trading Pairs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Tabs value={category} onValueChange={setCategory}>
                <div className="px-4 pb-3">
                  <TabsList className="grid grid-cols-5 h-9">
                    <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                    <TabsTrigger value="meme" className="text-xs">Meme</TabsTrigger>
                    <TabsTrigger value="defi" className="text-xs">DeFi</TabsTrigger>
                    <TabsTrigger value="custom" className="text-xs">My</TabsTrigger>
                    <TabsTrigger value="favorites" className="text-xs">★</TabsTrigger>
                  </TabsList>
                </div>
                <ScrollArea className="h-[300px] lg:h-[400px]">
                  <div className="px-2 pb-2">
                    {filteredPairs.map((pair) => (
                      <div
                        key={pair.address}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${selectedToken.address === pair.address ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedToken(pair)}
                      >
                        <div className="flex items-center gap-3">
                          {pair.image ? (
                            <img src={pair.image} alt={pair.symbol} className="w-9 h-9 rounded-xl object-cover bg-muted" />
                          ) : (
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${pair.category === "official" ? "bg-gradient-to-br from-primary to-secondary text-primary-foreground" : "bg-muted"}`}>{pair.symbol.slice(0, 2)}</div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{pair.symbol}</p>
                            <div className="flex items-center gap-1">
                              {pair.price && <p className="text-[10px] text-muted-foreground">${parseFloat(pair.price) < 0.01 ? parseFloat(pair.price).toExponential(1) : parseFloat(pair.price).toFixed(2)}</p>}
                              {pair.priceChange24h !== undefined && pair.priceChange24h !== 0 && (
                                <span className={`text-[10px] ${pair.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {pair.priceChange24h >= 0 ? '+' : ''}{pair.priceChange24h.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toggleFavorite(pair.address); }}>
                            <Star className={`h-3.5 w-3.5 ${favorites.includes(pair.address) ? "fill-yellow-500 text-yellow-500" : ""}`} />
                          </Button>
                          {pair.category === 'custom' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); removeCustomPair(pair.address); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredPairs.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No pairs found</div>}
                  </div>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-border/50 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedToken.image ? (
                    <img src={selectedToken.image} alt={selectedToken.symbol} className="w-10 h-10 rounded-xl object-cover bg-muted" />
                  ) : (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${selectedToken.category === "official" ? "bg-gradient-to-br from-primary to-secondary text-primary-foreground" : "bg-muted"}`}>{selectedToken.symbol.slice(0, 2)}</div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{selectedToken.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{selectedToken.address.slice(0, 8)}...{selectedToken.address.slice(-6)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => window.open(`https://dexscreener.com/solana/${selectedToken.address}`, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">DexScreener</span>
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-xl h-9 w-9" onClick={() => setIsFullscreen(true)}><Maximize2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="aspect-[4/3] sm:aspect-[16/10]">
                <iframe src={getDexScreenerUrl(selectedToken.address)} className="w-full h-full" title={`${selectedToken.name} Chart`} allow="clipboard-write" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Charts;
