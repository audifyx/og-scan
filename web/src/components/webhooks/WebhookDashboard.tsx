import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { formatAddress, formatUsd } from "@/lib/solana-api";
import {
  Webhook, Send, Bell, Wallet, Coins, TrendingUp, TrendingDown,
  Activity, Zap, RefreshCw, Check, X, Clock, Users, AlertTriangle,
  BarChart3, Radio, Globe, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DashboardStats {
  totalAlerts: number;
  sentToday: number;
  successRate: number;
  trackedWallets: number;
  trackedTokens: number;
  activeAlerts: number;
}

interface TrackedWalletData {
  address: string;
  balance: number;
  usdValue: number;
  change24h: number;
  lastUpdate: Date;
}

interface RecentActivity {
  id: string;
  type: "wallet" | "token" | "whale" | "test" | "price";
  message: string;
  timestamp: Date;
  success: boolean;
}

export const WebhookDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAlerts: 0,
    sentToday: 0,
    successRate: 100,
    trackedWallets: 0,
    trackedTokens: 0,
    activeAlerts: 0,
  });
  const [wallets, setWallets] = useState<TrackedWalletData[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch tracked wallets from DB
      const { data: trackedWallets } = await supabase
        .from("tracked_wallets")
        .select("*")
        .limit(10);

      // Fetch tracked tokens count
      const { count: tokenCount } = await supabase
        .from("tracked_tokens")
        .select("*", { count: "exact", head: true });

      // Update stats
      setStats({
        totalAlerts: activities.length,
        sentToday: activities.filter(a => {
          const today = new Date();
          return a.timestamp.toDateString() === today.toDateString();
        }).length,
        successRate: activities.length > 0 
          ? (activities.filter(a => a.success).length / activities.length) * 100 
          : 100,
        trackedWallets: trackedWallets?.length || 0,
        trackedTokens: tokenCount || 0,
        activeAlerts: trackedWallets?.length || 0,
      });

      // Fetch live wallet data
      if (trackedWallets && trackedWallets.length > 0) {
        const walletData: TrackedWalletData[] = [];
        for (const wallet of trackedWallets.slice(0, 5)) {
          try {
            const { data } = await supabase.functions.invoke("solana-tracker", {
              body: { action: "getWalletOverview", walletAddress: wallet.wallet_address },
            });
            if (data) {
              walletData.push({
                address: wallet.wallet_address,
                balance: data.balance || 0,
                usdValue: data.totalUsdValue || 0,
                change24h: data.priceChange24h || 0,
                lastUpdate: new Date(),
              });
            }
          } catch (e) {
            console.error("Error fetching wallet:", e);
          }
        }
        setWallets(walletData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    toast({ title: "Dashboard refreshed" });
  };

  const sendQuickAlert = async (type: string, message: string) => {
    try {
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: { type: "custom", message },
      });
      if (error) throw error;
      
      const newActivity: RecentActivity = {
        id: Date.now().toString(),
        type: type as any,
        message: message.slice(0, 50) + "...",
        timestamp: new Date(),
        success: true,
      };
      setActivities(prev => [newActivity, ...prev].slice(0, 20));
      toast({ title: "Alert Sent!" });
    } catch (error) {
      const newActivity: RecentActivity = {
        id: Date.now().toString(),
        type: type as any,
        message: "Failed to send",
        timestamp: new Date(),
        success: false,
      };
      setActivities(prev => [newActivity, ...prev].slice(0, 20));
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const sendWalletUpdate = async (wallet: TrackedWalletData) => {
    await sendQuickAlert(
      "wallet",
      `📊 Wallet Update: ${formatAddress(wallet.address)} | ${wallet.balance.toFixed(4)} SOL ($${wallet.usdValue.toFixed(2)}) | ${wallet.change24h >= 0 ? "+" : ""}${wallet.change24h.toFixed(2)}% 24h`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Live Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">Real-time webhook activity & tracked wallets</p>
        </div>
        <Button onClick={refreshAll} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh All
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="og-glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-4 w-4 text-[#5865F2]" />
              <span className="text-xs text-muted-foreground">Sent Today</span>
            </div>
            <p className="text-2xl font-bold">{stats.sentToday}</p>
          </CardContent>
        </Card>
        <Card className="og-glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Success Rate</span>
            </div>
            <p className="text-2xl font-bold">{stats.successRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card className="og-glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Wallets</span>
            </div>
            <p className="text-2xl font-bold">{stats.trackedWallets}</p>
          </CardContent>
        </Card>
        <Card className="og-glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-secondary" />
              <span className="text-xs text-muted-foreground">Tokens</span>
            </div>
            <p className="text-2xl font-bold">{stats.trackedTokens}</p>
          </CardContent>
        </Card>
        <Card className="og-glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold">{stats.activeAlerts}</p>
          </CardContent>
        </Card>
        <Card className="og-glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Status</span>
            </div>
            <Badge className="bg-green-500/20 text-green-500">Online</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tracked Wallets */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Live Tracked Wallets
              </span>
              <Badge variant="secondary">{wallets.length} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 rounded-lg bg-white/[0.04] animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-6 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : wallets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tracked wallets</p>
                  <p className="text-xs">Add wallets to see live updates here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wallets.map((wallet, i) => (
                    <div 
                      key={i} 
                      className="p-4 rounded-lg bg-white/[0.04] border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm">{formatAddress(wallet.address, 6)}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-lg font-bold">{wallet.balance.toFixed(4)} SOL</span>
                            <span className="text-sm text-muted-foreground">
                              {formatUsd(wallet.usdValue)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                            wallet.change24h >= 0 
                              ? "bg-green-500/10 text-green-500" 
                              : "bg-red-500/10 text-red-500"
                          }`}>
                            {wallet.change24h >= 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {Math.abs(wallet.change24h).toFixed(2)}%
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => sendWalletUpdate(wallet)}
                            className="h-8"
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Updated {wallet.lastUpdate.toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions & Activity */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Quick Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => sendQuickAlert("whale", "🐋 WHALE ALERT: Large movement detected!")}
              >
                <Activity className="h-4 w-4 mr-2 text-blue-500" />
                Whale Alert
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => sendQuickAlert("price", "📈 Price surge detected! Check the charts.")}
              >
                <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                Price Surge
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => sendQuickAlert("token", "🚀 New token launch! Early entry opportunity.")}
              >
                <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                New Launch
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => sendQuickAlert("price", "⚠️ Price drop alert! Review your positions.")}
              >
                <TrendingDown className="h-4 w-4 mr-2 text-red-500" />
                Price Drop
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px]">
                {activities.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <div 
                        key={activity.id} 
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] text-sm"
                      >
                        {activity.success ? (
                          <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-3 w-3 text-red-500 flex-shrink-0" />
                        )}
                        <span className="truncate flex-1">{activity.message}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {activity.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Webhook Activity (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-1 h-20">
            {[...Array(24)].map((_, i) => {
              const height = Math.random() * 100;
              return (
                <div 
                  key={i} 
                  className="flex flex-col justify-end"
                >
                  <div 
                    className="bg-primary/60 rounded-t hover:bg-primary transition-colors"
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>24h ago</span>
            <span>12h ago</span>
            <span>Now</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
