import { useState, useEffect, useCallback } from "react";
import { Zap, TrendingUp, Clock, ExternalLink, RefreshCw, Filter, Sparkles, Rocket, Globe, Play, Pause, Copy, ArrowUpRight, ArrowDownRight, Repeat } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface TrackedWallet {
  id: string;
  wallet_address: string;
  label: string | null;
}

interface WalletActivity {
  signature: string;
  type: string;
  timestamp: string;
  description: string;
  tokenSymbol?: string;
  tokenName?: string;
  amount?: number;
  usdValue?: number;
  walletAddress: string;
  walletLabel?: string;
}

interface NewToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
  pairAddress: string;
  chainId: string;
  dexId: string;
  priceUsd: string;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  pairCreatedAt: number;
  url: string;
  imageUrl?: string;
  launchPlatform?: string;
}

const LAUNCH_PLATFORMS = [
  { id: "all", name: "All Platforms", icon: Globe },
  { id: "pump.fun", name: "Pump.fun", icon: Rocket },
  { id: "raydium", name: "Raydium", icon: Zap },
  { id: "jupiter", name: "Jupiter", icon: TrendingUp },
  { id: "orca", name: "Orca", icon: Sparkles },
];

const detectLaunchPlatform = (dexId: string, url: string): string => {
  if (url.includes("pump.fun") || dexId.includes("pump")) return "pump.fun";
  if (dexId.includes("raydium")) return "raydium";
  if (dexId.includes("orca")) return "orca";
  if (dexId.includes("meteora")) return "meteora";
  if (dexId.includes("phoenix")) return "phoenix";
  return dexId || "Unknown";
};

const getPlatformColor = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case "pump.fun": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
    case "raydium": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "jupiter": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "orca": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "meteora": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const getActivityIcon = (type: string) => {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('buy') || typeLower.includes('swap_in')) {
    return <ArrowUpRight className="h-4 w-4 text-green-500" />;
  }
  if (typeLower.includes('sell') || typeLower.includes('swap_out')) {
    return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  }
  if (typeLower.includes('transfer')) {
    return <Repeat className="h-4 w-4 text-[#eab308]" />;
  }
  return <Zap className="h-4 w-4 text-[#22d3ee]" />;
};

const getActivityColor = (type: string) => {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('buy') || typeLower.includes('swap_in')) return "bg-green-500/20";
  if (typeLower.includes('sell') || typeLower.includes('swap_out')) return "bg-red-500/20";
  if (typeLower.includes('transfer')) return "bg-secondary/20";
  return "bg-primary/20";
};

const LiveFeed = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("tracked");
  const [tokens, setTokens] = useState<NewToken[]>([]);
  const [activities, setActivities] = useState<WalletActivity[]>([]);
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [minLiquidity, setMinLiquidity] = useState<string>("0");

  // Fetch tracked wallets
  const fetchTrackedWallets = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tracked_wallets')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      setTrackedWallets(data || []);
    } catch (error) {
      console.error('Error fetching tracked wallets:', error);
    }
  }, [user]);

  // Fetch wallet activities for tracked wallets
  const fetchWalletActivities = useCallback(async () => {
    if (trackedWallets.length === 0) {
      setActivities([]);
      return;
    }
    
    setLoading(true);
    try {
      const allActivities: WalletActivity[] = [];
      
      for (const wallet of trackedWallets.slice(0, 5)) {
        try {
          const { data, error } = await supabase.functions.invoke('solana-tracker', {
            body: { action: 'getTransactions', walletAddress: wallet.wallet_address, limit: 10 }
          });
          
          if (!error && data?.transactions) {
            const walletActivities = data.transactions.map((tx: any) => ({
              signature: tx.signature,
              type: tx.type || 'UNKNOWN',
              timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : new Date().toISOString(),
              description: tx.description || tx.type || 'Transaction',
              tokenSymbol: tx.tokenTransfers?.[0]?.tokenStandard === 'Fungible' ? tx.tokenTransfers?.[0]?.mint?.substring(0, 4) : undefined,
              amount: tx.tokenTransfers?.[0]?.tokenAmount,
              usdValue: tx.nativeTransfers?.[0]?.amount ? (tx.nativeTransfers[0].amount / 1e9) * 200 : undefined,
              walletAddress: wallet.wallet_address,
              walletLabel: wallet.label,
            }));
            allActivities.push(...walletActivities);
          }
        } catch (e) {
          console.error('Error fetching wallet activity:', e);
        }
      }
      
      // Sort by timestamp
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(allActivities.slice(0, 50));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }, [trackedWallets]);

  // Fetch new token launches
  const fetchNewTokens = useCallback(async () => {
    try {
      const response = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
      if (!response.ok) throw new Error("Failed to fetch tokens");
      
      const profilesData = await response.json();
      const solanaTokens = profilesData
        .filter((profile: any) => profile.chainId === "solana")
        .slice(0, 30);

      const tokensWithPairs: NewToken[] = [];
      
      for (const profile of solanaTokens.slice(0, 20)) {
        try {
          const pairResponse = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${profile.tokenAddress}`
          );
          const pairData = await pairResponse.json();
          
          if (pairData.pairs && pairData.pairs.length > 0) {
            const pair = pairData.pairs[0];
            const launchPlatform = detectLaunchPlatform(pair.dexId, pair.url || "");
            
            tokensWithPairs.push({
              id: profile.tokenAddress,
              name: pair.baseToken?.name || profile.name || "Unknown",
              symbol: pair.baseToken?.symbol || profile.symbol || "???",
              address: profile.tokenAddress,
              pairAddress: pair.pairAddress,
              chainId: pair.chainId,
              dexId: pair.dexId,
              priceUsd: pair.priceUsd || "0",
              priceChange24h: pair.priceChange?.h24 || 0,
              volume24h: pair.volume?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              fdv: pair.fdv || 0,
              pairCreatedAt: pair.pairCreatedAt || Date.now(),
              url: pair.url || `https://dexscreener.com/solana/${profile.tokenAddress}`,
              imageUrl: profile.icon,
              launchPlatform,
            });
          }
        } catch (e) {
          // Skip tokens that fail
        }
      }

      setTokens(tokensWithPairs);
    } catch (error) {
      console.error("Error fetching new tokens:", error);
      toast.error("Failed to fetch new tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user) fetchTrackedWallets();
    fetchNewTokens();
  }, [user, fetchTrackedWallets, fetchNewTokens]);

  // Fetch activities when tracked wallets change
  useEffect(() => {
    if (trackedWallets.length > 0) {
      fetchWalletActivities();
    }
  }, [trackedWallets, fetchWalletActivities]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (activeTab === "tracked") {
        fetchWalletActivities();
      } else {
        fetchNewTokens();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, fetchWalletActivities, fetchNewTokens]);

  const filteredTokens = tokens.filter((token) => {
    const minLiq = parseInt(minLiquidity) || 0;
    if (token.liquidity < minLiq) return false;
    if (filter === "gainers" && token.priceChange24h <= 0) return false;
    if (filter === "losers" && token.priceChange24h >= 0) return false;
    if (filter === "highVolume" && token.volume24h <= 10000) return false;
    if (platformFilter !== "all" && token.launchPlatform?.toLowerCase() !== platformFilter.toLowerCase()) return false;
    return true;
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <AppLayout>
      <PageHeader
        title="Live Feed"
        description="Real-time wallet activity & new token launches"
      >
        <div className="flex items-center gap-3">
          <Badge className={`gap-1.5 ${autoRefresh ? "bg-accent/20 text-accent border-accent/30" : "bg-muted"}`}>
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
            {autoRefresh ? "Live" : "Paused"}
          </Badge>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-5">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="tracked" className="gap-2">
              <Zap className="h-4 w-4" />
              Tracked Wallets
            </TabsTrigger>
            <TabsTrigger value="launches" className="gap-2">
              <Rocket className="h-4 w-4" />
              New Launches
            </TabsTrigger>
          </TabsList>

          {/* Tracked Wallet Activity */}
          <TabsContent value="tracked" className="space-y-5 mt-5">
            <Card className="og-glass-card-premium overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                      <Zap className="h-5 w-5 text-[#22d3ee]" />
                    </div>
                    <div>
                      <h3 className="font-bold">Tracked Wallet Activity</h3>
                      <p className="text-sm text-muted-foreground">Live transactions from {trackedWallets.length} wallets</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={autoRefresh ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className="rounded-xl gap-2"
                    >
                      {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {autoRefresh ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchWalletActivities}
                      disabled={loading}
                      className="rounded-xl gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Zap, value: trackedWallets.length, label: "Tracked Wallets", color: "text-[#22d3ee]" },
                { icon: TrendingUp, value: activities.filter(a => a.type.toLowerCase().includes('buy')).length, label: "Buys", color: "text-green-500" },
                { icon: ArrowDownRight, value: activities.filter(a => a.type.toLowerCase().includes('sell')).length, label: "Sells", color: "text-red-500" },
                { icon: Clock, value: "10s", label: "Refresh Rate", color: "text-[#eab308]" },
              ].map((stat, i) => (
                <Card key={i} className="og-glass-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/[0.04]">
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Activity Feed */}
            <Card className="og-glass-card overflow-hidden">
              <CardHeader className="border-b border-white/[0.07]">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                    <Zap className="h-5 w-5 text-[#22d3ee]" />
                  </div>
                  Live Activity
                  <Badge variant="outline" className="ml-2">{activities.length} transactions</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-16">
                      <Zap className="h-14 w-14 text-muted-foreground mx-auto mb-4" />
                      <p className="font-medium text-muted-foreground">No activity yet</p>
                      <p className="text-sm text-muted-foreground mt-2">Track wallets to see their activity here</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {activities.map((activity, index) => (
                        <div
                          key={`${activity.signature}-${index}`}
                          className="p-4 hover:bg-white/[0.03] transition-all group animate-fade-in"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`p-2.5 rounded-xl ${getActivityColor(activity.type)}`}>
                                {getActivityIcon(activity.type)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-sm">{activity.type}</p>
                                  {activity.walletLabel && (
                                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                      {activity.walletLabel}
                                    </Badge>
                                  )}
                                  {activity.tokenSymbol && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.tokenSymbol}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-muted-foreground font-mono truncate">
                                    {activity.walletAddress.slice(0, 6)}...{activity.walletAddress.slice(-4)}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                    onClick={() => copyToClipboard(activity.walletAddress)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {activity.usdValue && (
                                <div className="text-right">
                                  <p className="font-semibold">${activity.usdValue.toFixed(2)}</p>
                                </div>
                              )}
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                                asChild
                              >
                                <a href={`https://solscan.io/tx/${activity.signature}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
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

          {/* New Token Launches */}
          <TabsContent value="launches" className="space-y-5 mt-5">
            {/* Controls */}
            <Card className="og-glass-card-premium overflow-hidden">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger className="w-[160px] h-10 rounded-xl bg-white/[0.04]">
                        <Rocket className="h-4 w-4 mr-2 text-[#22d3ee]" />
                        <SelectValue placeholder="Platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {LAUNCH_PLATFORMS.map((platform) => (
                          <SelectItem key={platform.id} value={platform.id}>
                            {platform.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger className="w-[140px] h-10 rounded-xl bg-white/[0.04]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tokens</SelectItem>
                        <SelectItem value="gainers">Gainers</SelectItem>
                        <SelectItem value="losers">Losers</SelectItem>
                        <SelectItem value="highVolume">High Volume</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={minLiquidity} onValueChange={setMinLiquidity}>
                      <SelectTrigger className="w-[160px] h-10 rounded-xl bg-white/[0.04]">
                        <SelectValue placeholder="Min Liquidity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Any Liquidity</SelectItem>
                        <SelectItem value="1000">$1K+ Liquidity</SelectItem>
                        <SelectItem value="10000">$10K+ Liquidity</SelectItem>
                        <SelectItem value="50000">$50K+ Liquidity</SelectItem>
                        <SelectItem value="100000">$100K+ Liquidity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={autoRefresh ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className="rounded-xl gap-2"
                    >
                      {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {autoRefresh ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchNewTokens}
                      disabled={loading}
                      className="rounded-xl gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Sparkles, value: tokens.length, label: "New Tokens", color: "text-[#22d3ee]" },
                { icon: TrendingUp, value: tokens.filter((t) => t.priceChange24h > 0).length, label: "Gainers", color: "text-green-500" },
                { icon: Clock, value: "10s", label: "Refresh Rate", color: "text-[#eab308]" },
                { icon: Zap, value: filteredTokens.length, label: "Filtered", color: "text-accent" },
              ].map((stat, i) => (
                <Card key={i} className="og-glass-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/[0.04]">
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Token Feed */}
            <Card className="og-glass-card overflow-hidden">
              <CardHeader className="border-b border-white/[0.07]">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                    <Rocket className="h-5 w-5 text-[#22d3ee]" />
                  </div>
                  New Token Launches
                  <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30">
                    Solana
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div className="text-center py-16">
                      <Zap className="h-14 w-14 text-muted-foreground mx-auto mb-4" />
                      <p className="font-medium text-muted-foreground">No tokens match your filters</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredTokens.map((token, index) => (
                        <div
                          key={token.id}
                          className="p-4 hover:bg-white/[0.03] transition-all group animate-fade-in"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {token.imageUrl ? (
                                <img
                                  src={token.imageUrl}
                                  alt={token.symbol}
                                  className="h-11 w-11 rounded-xl bg-muted object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-primary-foreground">
                                  {token.symbol.slice(0, 2)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold truncate">{token.name}</p>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {token.symbol}
                                  </Badge>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] shrink-0 ${getPlatformColor(token.launchPlatform || "")}`}
                                  >
                                    {token.launchPlatform}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                                  {token.address.slice(0, 8)}...{token.address.slice(-6)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="font-mono font-semibold">
                                  ${parseFloat(token.priceUsd).toFixed(8)}
                                </p>
                                <p className={`text-xs font-medium ${token.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                                  {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}%
                                </p>
                              </div>

                              <div className="hidden md:block text-right min-w-[80px]">
                                <p className="text-sm font-medium">{formatNumber(token.volume24h)}</p>
                                <p className="text-xs text-muted-foreground">Volume</p>
                              </div>

                              <div className="hidden md:block text-right min-w-[80px]">
                                <p className="text-sm font-medium">{formatNumber(token.liquidity)}</p>
                                <p className="text-xs text-muted-foreground">Liquidity</p>
                              </div>

                              <div className="hidden lg:block text-right min-w-[80px]">
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(token.pairCreatedAt), { addSuffix: true })}
                                </p>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                                asChild
                              >
                                <a href={token.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
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
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default LiveFeed;