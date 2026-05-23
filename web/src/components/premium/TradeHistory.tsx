import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, 
  ArrowUpRight, ArrowDownRight, BarChart3, RefreshCw, Percent
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface Trade {
  id: string;
  token_symbol: string;
  token_name: string;
  trade_type: "buy" | "sell";
  amount: number;
  price_usd: number;
  total_usd: number;
  timestamp: string;
  realized_pnl: number | null;
  roi_percent: number | null;
  is_winner: boolean | null;
}

interface TradeStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnL: number;
  bestTrade: number;
  worstTrade: number;
  avgRoi: number;
}

export const TradeHistory = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("30d");
  const [chartData, setChartData] = useState<{ date: string; pnl: number; cumulative: number }[]>([]);

  useEffect(() => {
    if (user) fetchTrades();
  }, [user, timeFilter]);

  const fetchTrades = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Calculate date filter
      const now = new Date();
      let startDate = new Date();
      switch (timeFilter) {
        case "24h": startDate.setHours(now.getHours() - 24); break;
        case "7d": startDate.setDate(now.getDate() - 7); break;
        case "30d": startDate.setDate(now.getDate() - 30); break;
        case "all": startDate = new Date(0); break;
      }

      const { data, error } = await supabase
        .from("trade_history")
        .select("*")
        .eq("user_id", user.id)
        .gte("timestamp", startDate.toISOString())
        .order("timestamp", { ascending: false });

      if (error) throw error;

      const tradesData = (data || []) as Trade[];
      setTrades(tradesData);

      // Calculate stats
      const completedTrades = tradesData.filter(t => t.realized_pnl !== null);
      const winners = completedTrades.filter(t => (t.realized_pnl || 0) > 0);
      const losers = completedTrades.filter(t => (t.realized_pnl || 0) < 0);
      
      const totalPnL = completedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
      const pnlValues = completedTrades.map(t => t.realized_pnl || 0);
      const roiValues = completedTrades.filter(t => t.roi_percent).map(t => t.roi_percent || 0);

      setStats({
        totalTrades: tradesData.length,
        winCount: winners.length,
        lossCount: losers.length,
        winRate: completedTrades.length > 0 ? (winners.length / completedTrades.length) * 100 : 0,
        totalPnL,
        bestTrade: pnlValues.length > 0 ? Math.max(...pnlValues) : 0,
        worstTrade: pnlValues.length > 0 ? Math.min(...pnlValues) : 0,
        avgRoi: roiValues.length > 0 ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : 0,
      });

      // Build chart data
      const chartMap = new Map<string, number>();
      completedTrades.reverse().forEach(t => {
        const date = new Date(t.timestamp).toLocaleDateString();
        chartMap.set(date, (chartMap.get(date) || 0) + (t.realized_pnl || 0));
      });

      let cumulative = 0;
      const chartArr = Array.from(chartMap.entries()).map(([date, pnl]) => {
        cumulative += pnl;
        return { date, pnl, cumulative };
      });
      setChartData(chartArr);
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    const formatted = Math.abs(value).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });
    return value >= 0 ? formatted : `-${formatted}`;
  };

  if (!user) {
    return (
      <Card className="og-glass-card">
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Sign in to view your trade history</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="og-glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/20">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total P&L</p>
                <p className={`text-xl font-bold ${(stats?.totalPnL || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatCurrency(stats?.totalPnL || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="og-glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/20">
                <Percent className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-xl font-bold">{stats?.winRate.toFixed(1) || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="og-glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Best Trade</p>
                <p className="text-xl font-bold text-green-500">{formatCurrency(stats?.bestTrade || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="og-glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/20">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Worst Trade</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(stats?.worstTrade || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Chart */}
      <Card className="og-glass-card-premium">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            P&L Curve
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={fetchTrades} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(43 74% 49%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(43 74% 49%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="hsl(0 0% 55%)" fontSize={10} />
                <YAxis stroke="hsl(0 0% 55%)" fontSize={10} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "12px" }}
                  labelStyle={{ color: "hsl(45 10% 95%)" }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="hsl(43 74% 49%)"
                  fill="url(#pnlGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No trade data to display
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade List */}
      <Card className="og-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Trades
            </span>
            <Badge variant="outline">{trades.length} trades</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No trades recorded yet</p>
                <p className="text-sm text-muted-foreground mt-2">Start trading to see your history here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${trade.trade_type === "buy" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                        {trade.trade_type === "buy" ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{trade.token_symbol || "Unknown"}</span>
                          <Badge variant="outline" className="text-xs">
                            {trade.trade_type.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(trade.total_usd)}</p>
                      {trade.realized_pnl !== null && (
                        <p className={`text-xs ${trade.realized_pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {trade.realized_pnl >= 0 ? "+" : ""}{formatCurrency(trade.realized_pnl)}
                          {trade.roi_percent && ` (${trade.roi_percent.toFixed(1)}%)`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};