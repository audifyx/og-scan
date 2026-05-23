import { useState } from "react";
import { 
  Crown, Brain, MessageSquare, Waves, Bell, Calculator, Image, TrendingUp, 
  Users, Sparkles, Zap, BarChart3, Wallet, ChevronRight, Star
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AIChat } from "@/components/ai/AIChat";
import { WalletAnalyzer } from "@/components/ai/WalletAnalyzer";
import { WhaleTracker } from "@/components/premium/WhaleTracker";
import { PriceAlerts } from "@/components/premium/PriceAlerts";
import { PnLTracker } from "@/components/premium/PnLTracker";
import { ShareablePnLCard } from "@/components/premium/ShareablePnLCard";
import { TradeHistory } from "@/components/premium/TradeHistory";
import { PortfolioComparison } from "@/components/premium/PortfolioComparison";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { useCredits } from "@/hooks/useCredits";

import { Link } from "react-router-dom";

const tabItems = [
  { value: "chat", icon: MessageSquare, label: "AI Chat", description: "Chat with AI about crypto" },
  { value: "analyzer", icon: Brain, label: "Analyzer", description: "Deep wallet analysis" },
  { value: "whales", icon: Waves, label: "Whales", description: "Track whale movements" },
  { value: "alerts", icon: Bell, label: "Alerts", description: "Price notifications" },
  { value: "pnl", icon: Calculator, label: "P&L", description: "Profit/Loss tracking" },
  { value: "trades", icon: TrendingUp, label: "Trades", description: "Trade history" },
  { value: "compare", icon: Users, label: "Compare", description: "Multi-wallet compare" },
  { value: "share", icon: Image, label: "Cards", description: "Shareable stats" },
];

const Premium = () => {
  const { getRemainingCredits, getDailyRemaining, getUsagePercentage, getDaysUntilReset, credits } = useCredits();
  const [activeTab, setActiveTab] = useState("chat");

  const remaining = getRemainingCredits();
  const dailyRemaining = getDailyRemaining();
  const percentage = getUsagePercentage();
  const daysUntilReset = getDaysUntilReset();

  return (
    <AppLayout>
      <PageHeader 
        title="Premium Tools" 
        description="AI-powered trading tools and advanced analytics"
      >
        <div className="flex items-center gap-3">
          <CreditBalance compact />
          <Badge className="bg-gradient-to-r from-primary/20 to-secondary/20 text-primary border border-primary/20 gap-1.5 px-3 py-1">
            <Crown className="h-3.5 w-3.5" />
            <span className="font-medium">Pro</span>
          </Badge>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Credits Overview - Enhanced */}
        <Card className="glass-card-premium overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <CardContent className="relative p-5">
            <div className="grid grid-cols-2 gap-4">
              {/* Main Balance */}
              <div className="col-span-2 lg:col-span-1 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold gradient-text">${remaining.toLocaleString()}</p>
                </div>
              </div>

              {/* Daily Allowance */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily Left</p>
                  <p className="text-xl font-bold">${dailyRemaining.toLocaleString()}</p>
                </div>
              </div>

              {/* Usage Percentage */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-secondary/10">
                  <BarChart3 className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="text-xl font-bold">{percentage.toFixed(0)}%</p>
                </div>
              </div>

              {/* Days Until Reset */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-yellow-500/10">
                  <Zap className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reset In</p>
                  <p className="text-xl font-bold">{daysUntilReset} days</p>
                </div>
              </div>

              {/* Link to Credits Page */}
              <Link to="/credits" className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                <span>View Details</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <Progress value={percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Brain, label: "AI Analysis", desc: "Deep insights" },
            { icon: Waves, label: "Whale Tracking", desc: "Big moves" },
            { icon: Bell, label: "Price Alerts", desc: "Never miss" },
            { icon: Users, label: "Compare", desc: "Multi-wallet" },
          ].map((feature, i) => (
            <Card key={i} className="glass-card hover:border-primary/30 transition-all hover:scale-[1.02] cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tools Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-3 -mx-4 px-4">
            <TabsList className="inline-flex h-auto gap-1.5 bg-muted/30 p-2 rounded-2xl min-w-max">
              {tabItems.map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="flex items-center gap-2 px-4 py-3 rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-primary whitespace-nowrap transition-all text-sm"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-6">
            <TabsContent value="chat" className="animate-fade-in m-0">
              <AIChat />
            </TabsContent>

            <TabsContent value="analyzer" className="animate-fade-in m-0">
              <WalletAnalyzer />
            </TabsContent>

            <TabsContent value="whales" className="animate-fade-in m-0">
              <WhaleTracker />
            </TabsContent>

            <TabsContent value="alerts" className="animate-fade-in m-0">
              <PriceAlerts />
            </TabsContent>

            <TabsContent value="pnl" className="animate-fade-in m-0">
              <PnLTracker />
            </TabsContent>

            <TabsContent value="trades" className="animate-fade-in m-0">
              <TradeHistory />
            </TabsContent>

            <TabsContent value="compare" className="animate-fade-in m-0">
              <PortfolioComparison />
            </TabsContent>

            <TabsContent value="share" className="animate-fade-in m-0">
              <ShareablePnLCard />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Premium;
