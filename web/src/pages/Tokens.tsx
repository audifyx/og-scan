import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, TrendingUp, TrendingDown, Star, StarOff, ExternalLink, RefreshCw, 
  AlertTriangle, Shield, Plus, Trash2, Send, Activity, Zap, BarChart3, Eye, 
  Filter, Play, Pause, Coins, DollarSign, Users, Droplets, Copy, Check
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { TokenCalloutButton } from "@/components/webhooks/TokenCalloutButton";
import { TokenDetailPopup } from "@/components/tokens/TokenDetailPopup";
import { CreditBalance } from "@/components/credits/CreditBalance";

interface TrackedToken {
  id?: string;
  address: string;
  name: string;
  symbol: string;
  isFavorite: boolean;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  holders?: number;
  image?: string;
}

interface TrendingToken {
  address: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  image?: string;
}

const Tokens = ({ inline = false }: { inline?: boolean }) => {
  const Wrap = inline ? ({ children }: { children: React.ReactNode }) => <>{children}</> : AppLayout;
  const { user } = useAuth();
  const { spendCredits, canAfford } = useCredits();
  const [searchQuery, setSearchQuery] = useState("");
  const [trackedTokens, setTrackedTokens] = useState<TrackedToken[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [showTokenPopup, setShowTokenPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("marketCap");
  const [copied, setCopied] = useState<string | null>(null);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedTokensRef = useRef<TrackedToken[]>([]);

  // Keep ref in sync
  useEffect(() => { trackedTokensRef.current = trackedTokens; }, [trackedTokens]);

  useEffect(() => {
    if (user) loadTrackedTokens();
    else setLoading(false);
    fetchTrendingTokens();
  }, [user]);

  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(() => {
        fetchTrendingTokens(true);
        if (trackedTokensRef.current.length > 0) refreshTrackedTokenPrices();
      }, 15000);
    }
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, [autoRefresh]);

  const loadTrackedTokens = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("tracked_tokens")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const tokens = (data || []).map((t) => ({
        id: t.id, address: t.token_address, name: t.name || "Unknown", symbol: t.symbol || "???", isFavorite: t.is_favorite || false,
      }));
      setTrackedTokens(tokens);
      // Fetch prices after setting
      setTimeout(() => refreshTrackedTokenPrices(), 100);
    } catch (error) { console.error("Error loading tokens:", error); }
    finally { setLoading(false); }
  };

  const refreshTrackedTokenPrices = async () => {
    const current = trackedTokensRef.current;
    if (current.length === 0) return;
    
    const updates: Record<string, Partial<TrackedToken>> = {};
    await Promise.all(current.map(async (token) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
        const data = await res.json();
        const pair = data.pairs?.[0];
        if (pair) {
          updates[token.address] = {
            price: parseFloat(pair.priceUsd) || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            marketCap: pair.fdv || 0,
            liquidity: pair.liquidity?.usd || 0,
            volume24h: pair.volume?.h24 || 0,
            image: pair.info?.imageUrl,
          };
        }
      } catch { /* skip */ }
    }));
    
    setTrackedTokens(prev => prev.map(t => updates[t.address] ? { ...t, ...updates[t.address] } : t));
  };

  const fetchTrendingTokens = async (silent = false) => {
    if (!silent) setLoadingTrending(true);
    try {
      const response = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
      if (!response.ok) throw new Error("Failed to fetch");
      const profiles = await response.json();
      const solanaProfiles = profiles.filter((p: any) => p.chainId === "solana").slice(0, 15);
      
      const trendingData: TrendingToken[] = [];
      for (const profile of solanaProfiles) {
        try {
          const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${profile.tokenAddress}`);
          const pairData = await pairRes.json();
          const pair = pairData.pairs?.[0];
          if (pair) {
            trendingData.push({
              address: profile.tokenAddress,
              name: pair.baseToken?.name || "Unknown",
              symbol: pair.baseToken?.symbol || "???",
              price: parseFloat(pair.priceUsd) || 0,
              priceChange24h: pair.priceChange?.h24 || 0,
              marketCap: pair.fdv || 0,
              liquidity: pair.liquidity?.usd || 0,
              volume24h: pair.volume?.h24 || 0,
              holders: 0,
              image: profile.icon,
            });
          }
        } catch { /* skip */ }
      }
      setTrendingTokens(trendingData);
    } catch (error) { console.error("Error fetching trending:", error); }
    finally { setLoadingTrending(false); }
  };

  const addToken = async (token: { address: string; name: string; symbol: string }) => {
    if (trackedTokens.find((t) => t.address === token.address)) {
      toast({ title: "Token already tracked" }); return;
    }
    if (user) {
      const { data, error } = await supabase.from("tracked_tokens").insert({
        user_id: user.id, token_address: token.address, name: token.name, symbol: token.symbol, is_favorite: false,
      }).select().single();
      if (error) { toast({ title: "Error", description: "Failed to save token", variant: "destructive" }); return; }
      setTrackedTokens((prev) => [{ id: data.id, ...token, isFavorite: false }, ...prev]);
    } else {
      setTrackedTokens((prev) => [...prev, { ...token, isFavorite: false }]);
    }
    toast({ title: `Now tracking ${token.symbol}` });
  };

  const removeToken = async (address: string) => {
    const token = trackedTokens.find((t) => t.address === address);
    if (!token) return;
    if (user && token.id) await supabase.from("tracked_tokens").delete().eq("id", token.id);
    setTrackedTokens((prev) => prev.filter((t) => t.address !== address));
    toast({ title: "Token removed" });
  };

  const toggleFavorite = async (address: string) => {
    const token = trackedTokens.find((t) => t.address === address);
    if (!token) return;
    const newFav = !token.isFavorite;
    if (user && token.id) await supabase.from("tracked_tokens").update({ is_favorite: newFav }).eq("id", token.id);
    setTrackedTokens((prev) => prev.map((t) => (t.address === address ? { ...t, isFavorite: newFav } : t)));
  };

  const handleTokenClick = (address: string) => { setSelectedToken(address); setShowTokenPopup(true); };
  const copyAddress = (address: string) => { navigator.clipboard.writeText(address); setCopied(address); setTimeout(() => setCopied(null), 2000); toast({ title: "Address copied" }); };

  const formatNumber = (num?: number) => { if (num === undefined || num === null) return "Loading..."; if (num === 0) return "$0"; if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`; if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`; return `$${num.toFixed(2)}`; };
  const formatPrice = (num?: number) => { if (!num) return "$0"; if (num < 0.00001) return `$${num.toExponential(2)}`; if (num < 0.01) return `$${num.toFixed(8)}`; return `$${num.toFixed(4)}`; };

  // Search by address
  const handleSearchSubmit = async () => {
    const q = searchQuery.trim();
    if (q.length >= 32) {
      // Try to fetch token data and add it
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${q}`);
        const data = await res.json();
        const pair = data.pairs?.[0];
        if (pair) {
          addToken({ address: q, name: pair.baseToken?.name || 'Unknown', symbol: pair.baseToken?.symbol || '???' });
          setSearchQuery("");
        } else {
          toast({ title: "Token not found", variant: "destructive" });
        }
      } catch { toast({ title: "Error looking up token", variant: "destructive" }); }
    }
  };

  const filteredTrending = trendingTokens
    .filter((t) => {
      if (filter === "gainers") return t.priceChange24h > 0;
      if (filter === "losers") return t.priceChange24h < 0;
      if (filter === "highLiq") return t.liquidity > 50000;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "marketCap") return b.marketCap - a.marketCap;
      if (sortBy === "volume") return b.volume24h - a.volume24h;
      if (sortBy === "change") return b.priceChange24h - a.priceChange24h;
      if (sortBy === "liquidity") return b.liquidity - a.liquidity;
      return 0;
    });

  return (
    <Wrap>
      <PageHeader title="Token Monitor" description="Real-time Solana token tracking & analysis">
        <div className="flex items-center gap-2">
          <CreditBalance compact />
          <Badge className={`gap-1.5 ${autoRefresh ? "bg-accent/20 text-accent border-accent/30" : "bg-muted"}`}>
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
            {autoRefresh ? "Live" : "Paused"}
          </Badge>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Eye, value: trackedTokens.length, label: "Watching", color: "text-[#22d3ee]", bg: "from-primary/20 to-primary/5" },
            { icon: Star, value: trackedTokens.filter(t => t.isFavorite).length, label: "Favorites", color: "text-yellow-500", bg: "from-yellow-500/20 to-yellow-500/5" },
            { icon: TrendingUp, value: trendingTokens.filter(t => t.priceChange24h > 0).length, label: "Gainers", color: "text-green-500", bg: "from-green-500/20 to-green-500/5" },
            { icon: BarChart3, value: trendingTokens.length, label: "Trending", color: "text-[#eab308]", bg: "from-secondary/20 to-secondary/5" },
          ].map((s, i) => (
            <Card key={i} className="og-glass-card-premium overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl bg-gradient-to-br ${s.bg}`}><s.icon className={`h-6 w-6 ${s.color}`} /></div>
                  <div><p className="text-3xl font-bold">{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Controls */}
        <Card className="og-glass-card-premium overflow-hidden border-primary/10">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20"><Search className="h-5 w-5 text-[#22d3ee]" /></div>
                <Input
                  placeholder="Search or paste token address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  className="flex-1 bg-muted/30 border-white/[0.07] rounded-xl"
                />
                {searchQuery.length >= 32 && (
                  <Button size="sm" onClick={handleSearchSubmit} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />Add</Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[130px] rounded-xl bg-white/[0.04]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tokens</SelectItem>
                    <SelectItem value="gainers">Gainers</SelectItem>
                    <SelectItem value="losers">Losers</SelectItem>
                    <SelectItem value="highLiq">High Liquidity</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px] rounded-xl bg-white/[0.04]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketCap">Market Cap</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                    <SelectItem value="change">24h Change</SelectItem>
                    <SelectItem value="liquidity">Liquidity</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh(!autoRefresh)} className="rounded-xl gap-2">
                  {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {autoRefresh ? "Pause" : "Resume"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => fetchTrendingTokens()} className="rounded-xl gap-2">
                  <RefreshCw className={`h-4 w-4 ${loadingTrending ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="trending" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/[0.04]">
            <TabsTrigger value="trending" className="gap-2"><TrendingUp className="h-4 w-4" />Trending</TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-2"><Star className="h-4 w-4" />Watchlist ({trackedTokens.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="mt-4">
            <Card className="og-glass-card overflow-hidden">
              <CardHeader className="border-b border-white/[0.07] pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20"><Coins className="h-5 w-5 text-[#22d3ee]" /></div>
                  Live Token Feed
                  <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30">{filteredTrending.length} tokens</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  {loadingTrending ? (
                    <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" /></div>
                  ) : filteredTrending.length === 0 ? (
                    <div className="text-center py-16"><Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-white/40">No tokens match your filters</p></div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredTrending.map((token) => (
                        <div key={token.address} className="p-4 hover:bg-white/[0.04] transition-all cursor-pointer group" onClick={() => handleTokenClick(token.address)}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {token.image ? (
                                <img src={token.image} alt={token.symbol} className="h-11 w-11 rounded-xl bg-muted object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                              ) : (
                                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-primary-foreground">{token.symbol.slice(0, 2)}</div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold truncate">{token.name}</p>
                                  <Badge variant="outline" className="text-xs shrink-0">{token.symbol}</Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-muted-foreground font-mono">{token.address.slice(0, 6)}...{token.address.slice(-4)}</p>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); copyAddress(token.address); }}>
                                    {copied === token.address ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-mono font-semibold">{formatPrice(token.price)}</p>
                                <p className={`text-xs font-medium ${token.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                                  {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}%
                                </p>
                              </div>
                              <div className="hidden md:block text-right min-w-[80px]">
                                <p className="text-sm font-medium">{formatNumber(token.marketCap)}</p>
                                <p className="text-xs text-white/40">MCap</p>
                              </div>
                              <div className="hidden md:block text-right min-w-[80px]">
                                <p className="text-sm font-medium">{formatNumber(token.liquidity)}</p>
                                <p className="text-xs text-white/40">Liq</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); addToken({ address: token.address, name: token.name, symbol: token.symbol }); }}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.open(`https://dexscreener.com/solana/${token.address}`, "_blank"); }}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="watchlist" className="mt-4">
            {trackedTokens.length === 0 ? (
              <Card className="og-glass-card">
                <CardContent className="py-16 text-center">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No tokens in watchlist</h3>
                  <p className="text-sm text-white/40">Add tokens from the trending tab or paste a token address above</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {trackedTokens
                  .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
                  .map((token) => (
                    <Card key={token.address} className="og-glass-card group hover:border-primary/30 transition-all cursor-pointer" onClick={() => handleTokenClick(token.address)}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              {token.image ? (
                                <img src={token.image} alt={token.symbol} className="w-11 h-11 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center font-bold text-sm">{token.symbol.slice(0, 2)}</div>
                              )}
                              {token.isFavorite && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center"><Star className="h-3 w-3 fill-white text-white" /></div>}
                            </div>
                            <div><p className="font-bold">{token.symbol}</p><p className="text-xs text-muted-foreground truncate max-w-[100px]">{token.name}</p></div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toggleFavorite(token.address); }}>
                              {token.isFavorite ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); removeToken(token.address); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between"><span className="text-xs text-white/40">Price</span><span className="font-semibold">{token.price !== undefined ? formatPrice(token.price) : <span className="text-muted-foreground text-xs">Loading...</span>}</span></div>
                          <div className="flex items-center justify-between"><span className="text-xs text-white/40">24h</span>
                            {token.priceChange24h !== undefined ? (
                              <Badge className={(token.priceChange24h || 0) >= 0 ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                                {(token.priceChange24h || 0) >= 0 ? "+" : ""}{(token.priceChange24h || 0).toFixed(2)}%
                              </Badge>
                            ) : <span className="text-xs text-white/40">Loading...</span>}
                          </div>
                          <div className="flex items-center justify-between"><span className="text-xs text-white/40">MCap</span><span className="text-sm">{token.marketCap !== undefined ? formatNumber(token.marketCap) : <span className="text-muted-foreground text-xs">Loading...</span>}</span></div>
                          <div className="flex items-center justify-between"><span className="text-xs text-white/40">Liq</span><span className="text-sm">{token.liquidity !== undefined ? formatNumber(token.liquidity) : <span className="text-muted-foreground text-xs">Loading...</span>}</span></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button variant="default" size="sm" className="flex-1 rounded-xl h-9"><Shield className="h-4 w-4 mr-2" />Analyze</Button>
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={(e) => { e.stopPropagation(); window.open(`https://dexscreener.com/solana/${token.address}`, "_blank"); }}><ExternalLink className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TokenDetailPopup tokenAddress={selectedToken || ""} open={showTokenPopup} onOpenChange={setShowTokenPopup} />
    </Wrap>
  );
};

export default Tokens;
