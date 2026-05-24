import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { OGBannerPromo } from "@/components/banners/OGBanner3D";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/useCredits";
import { 
  Coins, Clock, TrendingDown, AlertTriangle, Zap, Image, Search,
  RefreshCw, Sparkles, BarChart3, Wallet, Calendar, ArrowDownRight,
  History, PieChart, Crown, ChevronRight, Flame, Award
} from "lucide-react";
import { groupPricingByCategory, formatCreditCost, MONTHLY_CREDIT_ALLOWANCE, DAILY_USAGE_ALLOWANCE } from "@/lib/credit-pricing";
import { format, subDays } from "date-fns";

const Credits = () => {
  const { 
    credits, transactions, loading, todayUsed, dailyLimit,
    getRemainingCredits, getUsagePercentage, getDaysUntilReset,
    getDailyRemaining, refreshCredits, refreshTransactions
  } = useCredits();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshCredits();
    await refreshTransactions();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!credits) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Wallet className="h-16 w-16 text-white/40" />
          <p className="text-white/40">Please sign in to view credits</p>
        </div>
      </AppLayout>
    );
  }

  const remaining = getRemainingCredits();
  const percentage = getUsagePercentage();
  const daysUntilReset = getDaysUntilReset();
  const dailyRemaining = getDailyRemaining();
  const pricingByCategory = groupPricingByCategory();

  const formatBalance = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return `${value.toFixed(0)}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'AI Tasks': return <Zap className="h-4 w-4 text-[#22d3ee]" />;
      case 'Visual & Media': return <Image className="h-4 w-4 text-[#eab308]" />;
      case 'Discovery & Tracking': return <Search className="h-4 w-4 text-[#22d3ee]" />;
      case 'Trading': return <BarChart3 className="h-4 w-4 text-purple-500" />;
      default: return <Coins className="h-4 w-4 text-white/40" />;
    }
  };

  const weekAgo = subDays(new Date(), 7);
  const weeklyTransactions = transactions.filter(tx => new Date(tx.created_at) >= weekAgo);
  const weeklyTotal = weeklyTransactions.reduce((sum, tx) => sum + tx.cost, 0);

  const transactionsByDay: Record<string, typeof transactions> = {};
  transactions.forEach(tx => {
    const day = format(new Date(tx.created_at), 'yyyy-MM-dd');
    if (!transactionsByDay[day]) transactionsByDay[day] = [];
    transactionsByDay[day].push(tx);
  });

  const toolUsage: Record<string, { count: number; cost: number }> = {};
  transactions.forEach(tx => {
    if (!toolUsage[tx.tool_name]) toolUsage[tx.tool_name] = { count: 0, cost: 0 };
    toolUsage[tx.tool_name].count++;
    toolUsage[tx.tool_name].cost += tx.cost;
  });
  const topTools = Object.entries(toolUsage).sort((a, b) => b[1].cost - a[1].cost).slice(0, 5);

  return (
    <AppLayout>
      <PageHeader title="Credits" description="Track your credit usage and spending history">
        <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">
          <OGBannerPromo title="Credits" subtitle="Track usage, spending history & manage your credit balance" accent="gold" />
        {/* Hero Balance Card */}
        <Card className="og-glass-frame overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee]/8 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#22d3ee]/10 rounded-full blur-[150px]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/40 to-transparent" />
          
          <CardContent className="relative p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee] to-[#eab308] blur-xl opacity-40" />
                  <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#22d3ee] to-[#eab308] shadow-2xl shadow-[#22d3ee]/25">
                    <Sparkles className="h-10 w-10 text-[hsl(var(--og-ink))]" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-white/40 font-medium mb-1">Available Credits</p>
                  <p className="text-5xl font-bold font-mono gradient-text">{formatBalance(remaining)}</p>
                  <p className="text-sm text-white/35 mt-1">
                    of <span className="font-mono text-foreground">{formatBalance(MONTHLY_CREDIT_ALLOWANCE)}</span> monthly credits • <span className="font-mono text-foreground">{formatBalance(DAILY_USAGE_ALLOWANCE)}</span> usable cap
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className="bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20 gap-1.5 px-3 py-1.5">
                  <Crown className="h-3.5 w-3.5" />
                  Pro Plan
                </Badge>
              </div>
            </div>
            
            <div className="mt-8 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#22d3ee] font-medium">{percentage.toFixed(0)}% remaining</span>
                {percentage < 20 && (
                  <span className="text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Low credits
                  </span>
                )}
              </div>
              <div className="h-4 rounded-full bg-white/[0.04] overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#22d3ee] via-[#eab308] to-[#22d3ee] rounded-full transition-all duration-700 relative overflow-hidden"
                  style={{ width: `${percentage}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="og-glass-card hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-accent/20">
                  <Clock className="h-5 w-5 text-[#22d3ee]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/40">Usable Cap Left</p>
                  <p className="text-2xl font-bold">{formatBalance(dailyRemaining)}</p>
                </div>
              </div>
              <Progress value={(dailyRemaining / dailyLimit) * 100} className="h-2" />
            </CardContent>
          </Card>

          <Card className="og-glass-card hover:border-secondary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-secondary/20">
                  <Calendar className="h-5 w-5 text-[#eab308]" />
                </div>
                <div>
                  <p className="text-xs text-white/40">Renews In</p>
                  <p className="text-2xl font-bold">{daysUntilReset} days</p>
                  <p className="text-xs text-white/40">
                    {credits.next_reset_at ? format(new Date(credits.next_reset_at), 'MMM d') : ''}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="og-glass-card hover:border-destructive/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-destructive/20">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-white/40">Used This Month</p>
                  <p className="text-2xl font-bold font-mono">{formatBalance(credits.used_credits)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="og-glass-card hover:border-purple-500/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20">
                  <Flame className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-white/40">Weekly Usage</p>
                  <p className="text-2xl font-bold font-mono">{formatBalance(weeklyTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 bg-white/[0.04] p-1.5 rounded-xl">
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-[hsl(var(--og-ink))/90] data-[state=active]:shadow-sm gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="rounded-lg data-[state=active]:bg-[hsl(var(--og-ink))/90] data-[state=active]:shadow-sm gap-2">
              <PieChart className="h-4 w-4" />
              Breakdown
            </TabsTrigger>
            <TabsTrigger value="pricing" className="rounded-lg data-[state=active]:bg-[hsl(var(--og-ink))/90] data-[state=active]:shadow-sm gap-2">
              <Coins className="h-4 w-4" />
              Pricing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-6">
            <Card className="og-glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[#22d3ee]" />
                  Transaction History
                </CardTitle>
                <CardDescription>{transactions.length} transactions this month</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {transactions.length === 0 ? (
                    <div className="text-center py-16 text-white/40">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No transactions yet</p>
                      <p className="text-sm mt-1">Your usage history will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <div 
                          key={tx.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.04] transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-destructive/10">
                              <ArrowDownRight className="h-4 w-4 text-destructive" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{tx.tool_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px] px-2">{tx.tool_category}</Badge>
                                <span className="text-xs text-white/40">{format(new Date(tx.created_at), 'MMM d, h:mm a')}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="destructive" className="font-mono text-xs shrink-0">
                            -{formatCreditCost(tx.cost)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="breakdown" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="og-glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-[#22d3ee]" />
                    Top Tools by Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topTools.length === 0 ? (
                    <p className="text-sm text-white/35 text-center py-8">No usage data yet</p>
                  ) : (
                    <div className="space-y-4">
                      {topTools.map(([name, data], index) => (
                        <div key={name} className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                              index === 1 ? 'bg-gray-400/20 text-gray-400' :
                              index === 2 ? 'bg-amber-600/20 text-amber-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{name}</span>
                                <span className="text-sm font-mono text-white/40">
                                  {formatCreditCost(data.cost)} ({data.count}x)
                                </span>
                              </div>
                              <Progress value={(data.cost / (topTools[0][1].cost || 1)) * 100} className="h-2" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="og-glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#22d3ee]" />
                    Daily Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(transactionsByDay).slice(0, 7).map(([day, txs]) => {
                      const dayTotal = txs.reduce((sum, tx) => sum + tx.cost, 0);
                      const isToday = day === format(new Date(), 'yyyy-MM-dd');
                      return (
                        <div key={day} className={`flex items-center justify-between p-3 rounded-xl ${isToday ? 'bg-primary/10 border border-primary/20' : 'bg-white/[0.04]'}`}>
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-white/40" />
                            <span className="text-sm font-medium">
                              {isToday ? 'Today' : format(new Date(day), 'MMM d')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/40">{txs.length} txns</span>
                            <Badge variant={isToday ? "default" : "outline"} className="font-mono">
                              {formatCreditCost(dayTotal)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="mt-6">
            <Card className="og-glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-[#22d3ee]" />
                  Credit Pricing
                </CardTitle>
                <CardDescription>Cost breakdown for all tools and features</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-6 pr-3">
                    {Object.entries(pricingByCategory).map(([category, tools]) => (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2 sticky top-0 bg-[hsl(var(--og-ink))/90] py-2">
                          {getCategoryIcon(category)}
                          <h3 className="font-semibold text-lg">{category}</h3>
                          <Badge variant="outline" className="ml-auto text-xs">{tools.length} tools</Badge>
                        </div>
                        <div className="grid gap-2">
                          {tools.map((tool) => (
                            <div key={tool.key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.04] transition-colors">
                              <div className="flex items-center gap-3">
                                <ChevronRight className="h-4 w-4 text-white/40" />
                                <p className="font-medium">{tool.name}</p>
                              </div>
                              <Badge className="font-mono bg-primary/10 text-primary border-primary/20">
                                {formatCreditCost(tool.cost)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Credits;
