import { useState, useEffect, useCallback } from "react";
import { Search, Trophy, TrendingUp, Users, Star, Crown, Zap, Filter, Flame, Eye, BarChart3, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, Sparkles, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { renderAvatar } from "@/components/avatars/AvatarSelector";

interface LeaderboardUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_pnl: number;
  win_rate: number;
  trades_count: number;
  followers_count: number;
  badge: string | null;
  bio: string | null;
}

interface TrendingToken {
  name: string;
  symbol: string;
  address: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  imageUrl?: string;
}

interface SocialActivity {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_at: string;
  username?: string | null;
  avatar_url?: string | null;
}

const Discover = ({ inline = false }: { inline?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [activities, setActivities] = useState<SocialActivity[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LeaderboardUser[]>([]);
  const [sortBy, setSortBy] = useState<string>("total_pnl");
  const [loading, setLoading] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  // followState: map of userId -> boolean (true = currently following)
  const [followState, setFollowState] = useState<Record<string, boolean>>({});
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLeaderboard();
    fetchSocialFeed();
    fetchTrendingTokens();
    subscribeToActivity();
  }, [sortBy]);

  // Load which users the current user already follows
  useEffect(() => {
    if (!user) return;
    supabase
      .from("followers")
      .select("followee_id")
      .eq("follower_id", user.id)
      .then(({ data }) => {
        const state: Record<string, boolean> = {};
        data?.forEach((r: any) => { state[r.followee_id] = true; });
        setFollowState(state);
      });
  }, [user]);

  const fetchTrendingTokens = async () => {
    setLoadingTrending(true);
    try {
      const response = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
      if (response.ok) {
        const data = await response.json();
        const solanaTokens = data.filter((t: any) => t.chainId === "solana").slice(0, 8);
        
        const tokens: TrendingToken[] = [];
        for (const t of solanaTokens) {
          try {
            const detailRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              const pair = detailData.pairs?.[0];
              if (pair) {
                tokens.push({
                  name: pair.baseToken?.name || "Unknown",
                  symbol: pair.baseToken?.symbol || "???",
                  address: t.tokenAddress,
                  price: parseFloat(pair.priceUsd || "0"),
                  priceChange24h: pair.priceChange?.h24 || 0,
                  volume24h: pair.volume?.h24 || 0,
                  liquidity: pair.liquidity?.usd || 0,
                  marketCap: pair.marketCap || 0,
                  imageUrl: t.icon || pair.info?.imageUrl,
                });
              }
            }
          } catch {}
        }
        setTrendingTokens(tokens);
      }
    } catch (error) {
      console.error("Error fetching trending:", error);
    } finally {
      setLoadingTrending(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, total_pnl, win_rate, trades_count, followers_count, badge, bio")
        .order(sortBy, { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialFeed = async () => {
    try {
      const { data: activityData, error } = await supabase
        .from("user_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const userIds = [...new Set(activityData?.map(a => a.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", userIds);
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      setActivities((activityData || []).map(a => ({
        ...a,
        username: profilesMap.get(a.user_id)?.username,
        avatar_url: profilesMap.get(a.user_id)?.avatar_url,
      })));
    } catch (error) {
      console.error("Error fetching social feed:", error);
    }
  };

  const subscribeToActivity = () => {
    const channel = supabase
      .channel("social-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_activity" },
        async (payload) => {
          const newActivity = payload.new as SocialActivity;
          const { data: profile } = await supabase.from("profiles").select("username, avatar_url").eq("user_id", newActivity.user_id).single();
          setActivities(prev => [{ ...newActivity, username: profile?.username, avatar_url: profile?.avatar_url }, ...prev.slice(0, 29)]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, total_pnl, win_rate, trades_count, followers_count, badge, bio")
        .ilike("username", `%${searchQuery}%`)
        .limit(20);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error("Error searching:", error);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) { navigate("/auth"); return; }
    if (userId === user.id) return;
    setFollowLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const already = followState[userId];
      if (already) {
        await supabase.from("followers").delete()
          .eq("follower_id", user.id).eq("followee_id", userId);
        setFollowState(prev => ({ ...prev, [userId]: false }));
        toast.success("Unfollowed");
      } else {
        await supabase.from("followers").insert({ follower_id: user.id, followee_id: userId });
        setFollowState(prev => ({ ...prev, [userId]: true }));
        toast.success("Following! 🎉");
      }
    } catch { toast.error("Failed to update follow status"); }
    finally { setFollowLoading(prev => ({ ...prev, [userId]: false })); }
  };

  const formatNum = (n: number) => {
    if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const displayList = searchQuery && searchResults.length > 0 ? searchResults : leaderboard;

  const content = (
    <>
      {!inline && (
        <PageHeader title="Discover" description="Trending tokens, top traders & live activity">
          <div className="flex items-center gap-2">
            <Badge className="bg-og-cyan/20 text-og-cyan border-og-cyan/30 gap-1">
              <Activity className="h-3 w-3" /> Live
            </Badge>
          </div>
        </PageHeader>
      )}

      <div className={inline ? "" : "h-[calc(100vh-120px)] overflow-y-auto"}>
        <div className="p-4 lg:p-6 space-y-6">
          {/* Trending Tokens Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-display flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" /> Trending Tokens
              </h2>
              <Button variant="ghost" size="sm" onClick={fetchTrendingTokens} className="gap-1.5 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTrending ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(loadingTrending ? Array(4).fill(null) : trendingTokens.slice(0, 8)).map((token, i) => (
                <Card key={i} className="og-glass-card hover:border-og-cyan/20 transition-all hover:scale-[1.02] cursor-pointer group"
                  onClick={() => { if (token) { try { localStorage.setItem("og_active_mint", token.address); } catch {} navigate(`/scanner`); } }}>
                  <CardContent className="p-4">
                    {!token ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 w-8 rounded-xl bg-muted" />
                        <div className="h-4 w-20 rounded bg-muted" />
                        <div className="h-3 w-16 rounded bg-muted" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          {token.imageUrl ? (
                            <img src={token.imageUrl} alt="" className="h-8 w-8 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-og-cyan to-accent flex items-center justify-center text-xs font-bold">
                              {token.symbol?.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs truncate">{token.symbol}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{token.name}</p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono">{token.price < 0.01 ? `$${token.price.toFixed(8)}` : formatNum(token.price)}</span>
                            <span className={`text-xs font-bold flex items-center gap-0.5 ${token.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {token.priceChange24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {Math.abs(token.priceChange24h).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Vol: {formatNum(token.volume24h)}</span>
                            <span>MC: {formatNum(token.marketCap)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search traders by @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 rounded-xl"
              />
            </div>
            <Button onClick={handleSearch} className="rounded-xl">Search</Button>
          </div>

          <Tabs defaultValue="leaderboard">
            <TabsList className="grid w-full max-w-lg grid-cols-3 bg-white/[0.04] p-1 rounded-xl">
              <TabsTrigger value="leaderboard" className="rounded-lg gap-1.5">
                <Trophy className="h-4 w-4" /> Leaderboard
              </TabsTrigger>
              <TabsTrigger value="whale" className="rounded-lg gap-1.5">
                <Eye className="h-4 w-4" /> Whale Watch
              </TabsTrigger>
              <TabsTrigger value="feed" className="rounded-lg gap-1.5">
                <Zap className="h-4 w-4" /> Live Feed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? `${searchResults.length} results` : "Top Traders"}
                </p>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] rounded-xl">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total_pnl">Portfolio Value</SelectItem>
                    <SelectItem value="win_rate">Win Rate</SelectItem>
                    <SelectItem value="followers_count">Followers</SelectItem>
                    <SelectItem value="trades_count">Trades</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="og-glass-card">
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-og-cyan" />
                      </div>
                    ) : displayList.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No traders found</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {displayList.map((trader, index) => (
                          <div key={trader.user_id} className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => navigate(`/profile/${trader.user_id}`)}>
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                index === 0 ? "bg-yellow-500 text-black" : index === 1 ? "bg-gray-400 text-black" : index === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                              }`}>
                                {index + 1}
                              </div>
                              <div className="shrink-0">{renderAvatar(trader.avatar_url, trader.username, "sm")}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm truncate">@{trader.username || "anon"}</p>
                                  {trader.badge && <Badge variant="outline" className="text-[9px]">{trader.badge}</Badge>}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className={trader.total_pnl >= 0 ? "text-green-500" : "text-red-500"}>
                                    ${(trader.total_pnl || 0).toFixed(2)}
                                  </span>
                                  <span>{(trader.win_rate || 0).toFixed(0)}% WR</span>
                                  <span>{trader.trades_count || 0} trades</span>
                                </div>
                              </div>
                              {trader.user_id !== user?.id && (
                                <Button
                                  variant={followState[trader.user_id] ? "outline" : "default"}
                                  size="sm"
                                  disabled={followLoading[trader.user_id]}
                                  className={`h-7 text-xs rounded-lg shrink-0 transition-all ${followState[trader.user_id] ? "border-white/20 text-white/60 hover:border-red-500/40 hover:text-red-400" : ""}`}
                                  onClick={(e) => { e.stopPropagation(); handleFollow(trader.user_id); }}
                                >
                                  {followLoading[trader.user_id] ? "..." : followState[trader.user_id] ? "Following" : "Follow"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whale" className="mt-4">
              <Card className="og-glass-card-premium">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-[#22d3ee]" /> Whale Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Card className="og-glass-card">
                      <CardContent className="p-5 text-center">
                        <div className="p-4 rounded-2xl bg-blue-500/10 inline-flex mb-3">
                          <span className="text-4xl">🐋</span>
                        </div>
                        <h3 className="font-bold mb-1">Whale Alerts</h3>
                        <p className="text-xs text-muted-foreground mb-3">Get notified when whales make large transactions on Solana</p>
                        <Badge className="bg-accent/20 text-accent border-accent/30">Active Monitoring</Badge>
                      </CardContent>
                    </Card>
                    <Card className="og-glass-card">
                      <CardContent className="p-5 text-center">
                        <div className="p-4 rounded-2xl bg-purple-500/10 inline-flex mb-3">
                          <Sparkles className="h-10 w-10 text-purple-400" />
                        </div>
                        <h3 className="font-bold mb-1">AI Insights</h3>
                        <p className="text-xs text-muted-foreground mb-3">AI-powered market analysis and token recommendations</p>
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Active — Premium</Badge>
                      </CardContent>
                    </Card>
                    <Card className="og-glass-card">
                      <CardContent className="p-5 text-center">
                        <div className="p-4 rounded-2xl bg-orange-500/10 inline-flex mb-3">
                          <AlertTriangle className="h-10 w-10 text-orange-400" />
                        </div>
                        <h3 className="font-bold mb-1">Risk Scanner</h3>
                        <p className="text-xs text-muted-foreground mb-3">Automatic rug pull and risk detection for new tokens</p>
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Active</Badge>
                      </CardContent>
                    </Card>
                    <Card className="og-glass-card">
                      <CardContent className="p-5 text-center">
                        <div className="p-4 rounded-2xl bg-green-500/10 inline-flex mb-3">
                          <BarChart3 className="h-10 w-10 text-green-400" />
                        </div>
                        <h3 className="font-bold mb-1">Market Trends</h3>
                        <p className="text-xs text-muted-foreground mb-3">Real-time market trends and movement alerts</p>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Live Data</Badge>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="feed" className="mt-4">
              <Card className="og-glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-og-cyan animate-pulse" /> Live Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {activities.length === 0 ? (
                      <div className="text-center py-12">
                        <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No activity yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Activity will appear here as users interact</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activities.map(activity => (
                          <div key={activity.id} className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => navigate(`/profile/${activity.user_id}`)}>
                            <div className="flex items-center gap-3">
                              <div className="shrink-0">{renderAvatar(activity.avatar_url, activity.username, "sm")}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">@{activity.username || "anon"}</p>
                                <p className="text-xs text-muted-foreground truncate">{activity.title}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                              </span>
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
      </div>
    </>
  );
  return inline ? content : <AppLayout>{content}</AppLayout>;
};

export default Discover;
