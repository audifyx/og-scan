import { useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Clock, 
  TrendingDown, 
  AlertTriangle,
  Zap,
  Image,
  Search,
  RefreshCw,
  Sparkles,
  BarChart3,
  Wallet
} from "lucide-react";
import { groupPricingByCategory, formatCreditCost, MONTHLY_CREDIT_ALLOWANCE } from "@/lib/credit-pricing";
import { format } from "date-fns";

export const CreditsUsagePanel = () => {
  const { 
    credits, 
    transactions, 
    loading, 
    getRemainingCredits, 
    getUsagePercentage,
    getDaysUntilReset 
  } = useCredits();
  const [lowCreditWarning, setLowCreditWarning] = useState(true);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 bg-muted rounded-2xl" />
        <div className="h-72 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!credits) {
    return (
      <Card className="p-8 text-center glass-card">
        <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Please sign in to view credits</p>
      </Card>
    );
  }

  const remaining = getRemainingCredits();
  const percentage = getUsagePercentage();
  const daysUntilReset = getDaysUntilReset();
  const pricingByCategory = groupPricingByCategory();

  const formatBalance = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'AI Tasks': return <Zap className="h-4 w-4 text-primary" />;
      case 'Visual & Media': return <Image className="h-4 w-4 text-secondary" />;
      case 'Discovery & Tracking': return <Search className="h-4 w-4 text-accent" />;
      case 'Trading': return <BarChart3 className="h-4 w-4 text-cyber-purple" />;
      default: return <DollarSign className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Balance Card */}
      <Card className="p-6 glass-card-premium overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Available Credits</p>
              <p className="text-4xl font-bold font-mono gradient-text">{formatBalance(remaining)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                of <span className="font-mono text-foreground">{formatBalance(MONTHLY_CREDIT_ALLOWANCE)}</span> monthly
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 lg:text-right">
            <div className="flex items-center gap-2 lg:justify-end">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Renews in <strong className="text-primary">{daysUntilReset}</strong> days</span>
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Used: <strong className="font-mono">{formatBalance(credits.used_credits)}</strong></span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-primary font-medium">{percentage.toFixed(0)}% remaining</span>
            {percentage < 20 && lowCreditWarning && (
              <span className="text-amber-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Low credits
              </span>
            )}
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary via-primary/80 to-secondary rounded-full transition-all duration-700"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-5 glass-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <Label htmlFor="low-credit-warning" className="font-medium">Low Credits Warning</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified when credits drop below 20%
              </p>
            </div>
          </div>
          <Switch
            id="low-credit-warning"
            checked={lowCreditWarning}
            onCheckedChange={setLowCreditWarning}
          />
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pricing" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-xl">
          <TabsTrigger value="pricing" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Cost Breakdown
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Usage Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="mt-4">
          <Card className="p-4 glass-card">
            <ScrollArea className="h-[420px]">
              <div className="space-y-6 pr-3">
                {Object.entries(pricingByCategory).map(([category, tools]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2.5 mb-3 sticky top-0 bg-card/95 backdrop-blur-sm py-2 -mx-1 px-1">
                      <div className="p-1.5 rounded-lg bg-muted">
                        {getCategoryIcon(category)}
                      </div>
                      <h3 className="font-semibold text-sm">{category}</h3>
                      <Badge variant="secondary" className="ml-auto text-[10px] px-2">
                        {tools.length} tools
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {tools.map((tool) => (
                        <div 
                          key={tool.key}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                        >
                          <span className="text-sm">{tool.name}</span>
                          <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                            {formatCreditCost(tool.cost)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="p-4 glass-card">
            <ScrollArea className="h-[420px]">
              {transactions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No transactions yet</p>
                  <p className="text-sm mt-1">Your usage history will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 pr-3">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.tool_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Badge variant="secondary" className="text-[10px] px-2 py-0">
                            {tx.tool_category}
                          </Badge>
                          <span>{format(new Date(tx.created_at), 'MMM d, h:mm a')}</span>
                        </div>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 truncate max-w-[280px]">
                            {tx.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="destructive" className="font-mono text-xs ml-3 shrink-0">
                        -{formatCreditCost(tx.cost)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
