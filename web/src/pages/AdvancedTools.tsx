import { useState } from "react";
import { Wrench, Rocket, Shield, Zap, TrendingUp, BarChart3, Cpu, X, Search, Activity, Flame, Link2, Eye, Clock, Users, AlertTriangle, Coins, Wallet, LineChart, DollarSign, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenSniper } from "@/components/tools/TokenSniper";
import { WalletProfiler } from "@/components/tools/WalletProfiler";
import { HolderAnalysis } from "@/components/tools/HolderAnalysis";
import { LiquidityScanner } from "@/components/tools/LiquidityScanner";
import { StakingCalculator } from "@/components/tools/StakingCalculator";
import { ImpermanentLossCalculator } from "@/components/tools/ImpermanentLossCalculator";
import { JupiterRouteTracker } from "@/components/advanced-tools/JupiterRouteTracker";
import { ProgramInteractionMonitor } from "@/components/advanced-tools/ProgramInteractionMonitor";
import { LPPositionScanner } from "@/components/advanced-tools/LPPositionScanner";
import { TokenMetadataInspector } from "@/components/advanced-tools/TokenMetadataInspector";
import { WalletAgeCalculator } from "@/components/advanced-tools/WalletAgeCalculator";
import { TokenCreatorTracker } from "@/components/advanced-tools/TokenCreatorTracker";
import { RiskDetector } from "@/components/advanced-tools/RiskDetector";
import { StakeAccountTracker } from "@/components/advanced-tools/StakeAccountTracker";
import { TransferProfiler } from "@/components/advanced-tools/TransferProfiler";
import { RugDetector } from "@/components/advanced-tools/RugDetector";
import { BurnWatcher } from "@/components/advanced-tools/BurnWatcher";
import { WalletRelationshipGraph } from "@/components/advanced-tools/WalletRelationshipGraph";
import { MEVTracker } from "@/components/advanced-tools/MEVTracker";
import { FeeAnalyzer } from "@/components/advanced-tools/FeeAnalyzer";
import { WhaleConcentration } from "@/components/advanced-tools/WhaleConcentration";
import { TradingStyleClassifier } from "@/components/advanced-tools/TradingStyleClassifier";
import { LiquiditySniper } from "@/components/advanced-tools/LiquiditySniper";
import { AirdropAnalyzer } from "@/components/advanced-tools/AirdropAnalyzer";
import { WashTradingScanner } from "@/components/advanced-tools/WashTradingScanner";
import { TokenLockMonitor } from "@/components/advanced-tools/TokenLockMonitor";
import { SolDepletionWarning } from "@/components/advanced-tools/SolDepletionWarning";
import { ProfitCurveGenerator } from "@/components/advanced-tools/ProfitCurveGenerator";
import { InsiderDetector } from "@/components/advanced-tools/InsiderDetector";
import { MultiWalletMerge } from "@/components/advanced-tools/MultiWalletMerge";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { TOOL_NAME_TO_KEY, CREDIT_PRICING, formatCreditCost } from "@/lib/credit-pricing";
import { toast } from "sonner";

type ToolComponent = React.FC;

const toolComponents: Record<string, ToolComponent> = {
  "Token Sniper": TokenSniper,
  "Wallet Profiler": WalletProfiler,
  "Holder Analysis": HolderAnalysis,
  "Liquidity Scanner": LiquidityScanner,
  "Staking Calculator": StakingCalculator,
  "Impermanent Loss": ImpermanentLossCalculator,
  "Jupiter Routes": JupiterRouteTracker,
  "Program Monitor": ProgramInteractionMonitor,
  "LP Scanner": LPPositionScanner,
  "Token Metadata": TokenMetadataInspector,
  "Wallet Age": WalletAgeCalculator,
  "Token Creator": TokenCreatorTracker,
  "Risk Detector": RiskDetector,
  "Stake Tracker": StakeAccountTracker,
  "Transfer Profiler": TransferProfiler,
  "Rug Detector": RugDetector,
  "Burn Watcher": BurnWatcher,
  "Wallet Graph": WalletRelationshipGraph,
  "MEV Tracker": MEVTracker,
  "Fee Analyzer": FeeAnalyzer,
  "Whale Concentration": WhaleConcentration,
  "Trading Style": TradingStyleClassifier,
  "Liquidity Sniper": LiquiditySniper,
  "Airdrop Analyzer": AirdropAnalyzer,
  "Wash Trading": WashTradingScanner,
  "Token Locks": TokenLockMonitor,
  "SOL Depletion": SolDepletionWarning,
  "Profit Curve": ProfitCurveGenerator,
  "Insider Detector": InsiderDetector,
  "Multi-Wallet": MultiWalletMerge,
};

const getToolCost = (toolName: string): number => {
  const key = TOOL_NAME_TO_KEY[toolName];
  if (key && CREDIT_PRICING[key]) {
    return CREDIT_PRICING[key].cost;
  }
  return 10;
};

const toolCategories = [
  {
    id: "trading",
    name: "Trading",
    icon: TrendingUp,
    color: "text-primary",
    bgColor: "bg-primary/10",
    tools: [
      { name: "Token Sniper", description: "Detect new token launches instantly", icon: Zap },
      { name: "Wallet Profiler", description: "Analyze any wallet's performance", icon: Wallet },
      { name: "Jupiter Routes", description: "Track swap routes and slippage", icon: Link2 },
      { name: "Liquidity Sniper", description: "Snipe new liquidity pools", icon: Activity },
      { name: "Profit Curve", description: "Generate PnL curves over time", icon: LineChart },
      { name: "Trading Style", description: "Classify wallet trading patterns", icon: BarChart3 },
    ],
  },
  {
    id: "analysis",
    name: "Analysis",
    icon: BarChart3,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    tools: [
      { name: "Holder Analysis", description: "Deep dive into token holders", icon: Users },
      { name: "Liquidity Scanner", description: "Check pool liquidity depth", icon: Activity },
      { name: "Token Metadata", description: "Inspect on-chain token data", icon: Eye },
      { name: "Whale Concentration", description: "Analyze whale holdings", icon: Users },
      { name: "Wash Trading", description: "Detect wash trading patterns", icon: AlertTriangle },
      { name: "Insider Detector", description: "Find insider trading patterns", icon: Shield },
    ],
  },
  {
    id: "defi",
    name: "DeFi",
    icon: Cpu,
    color: "text-accent",
    bgColor: "bg-accent/10",
    tools: [
      { name: "Staking Calculator", description: "Calculate staking rewards", icon: Coins },
      { name: "Impermanent Loss", description: "IL calculator for LP positions", icon: TrendingUp },
      { name: "LP Scanner", description: "Scan LP positions and yields", icon: Activity },
      { name: "Program Monitor", description: "Monitor DEX interactions", icon: Cpu },
      { name: "Fee Analyzer", description: "Analyze transaction fees", icon: BarChart3 },
      { name: "Token Locks", description: "Monitor token lock schedules", icon: Clock },
    ],
  },
  {
    id: "security",
    name: "Security",
    icon: Shield,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    tools: [
      { name: "Rug Detector", description: "Analyze rug pull risk", icon: AlertTriangle },
      { name: "Risk Detector", description: "Comprehensive risk scoring", icon: Shield },
      { name: "Token Creator", description: "Track token creator history", icon: Eye },
      { name: "Burn Watcher", description: "Monitor token burns", icon: Flame },
      { name: "MEV Tracker", description: "Detect MEV activity", icon: Zap },
      { name: "SOL Depletion", description: "Low balance warnings", icon: AlertTriangle },
    ],
  },
  {
    id: "wallet",
    name: "Wallet",
    icon: Wallet,
    color: "text-cyber-purple",
    bgColor: "bg-cyber-purple/10",
    tools: [
      { name: "Wallet Age", description: "Calculate wallet age & activity", icon: Clock },
      { name: "Transfer Profiler", description: "Analyze transfer patterns", icon: Activity },
      { name: "Wallet Graph", description: "Visualize wallet relationships", icon: Link2 },
      { name: "Stake Tracker", description: "Track staking accounts", icon: Coins },
      { name: "Airdrop Analyzer", description: "Check airdrop eligibility", icon: Zap },
      { name: "Multi-Wallet", description: "Merge multiple wallet views", icon: Users },
    ],
  },
];

const AdvancedTools = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allTools = toolCategories.flatMap(cat => cat.tools.map(tool => ({ ...tool, category: cat.name, color: cat.color, bgColor: cat.bgColor })));
  const filteredTools = searchQuery 
    ? allTools.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const totalTools = allTools.length;

  const handleToolClick = (toolName: string) => {
    if (toolComponents[toolName]) {
      setSelectedTool(toolName);
    } else {
      toast.info(`${toolName} opened`);
    }
  };

  const ToolComponent = selectedTool ? toolComponents[selectedTool] : null;

  return (
    <AppLayout>
      <PageHeader title="Advanced Tools" description="Professional Solana analytics tools">
        <div className="flex items-center gap-3">
          <CreditBalance compact />
          <Badge className="bg-gradient-to-r from-primary/20 to-secondary/20 text-primary border-primary/20 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {totalTools} Tools
          </Badge>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            className="pl-11 h-12 bg-muted/40 rounded-xl border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && filteredTools.length > 0 && (
            <Card className="absolute top-full mt-2 w-full z-[60] p-2 glass-card">
              <ScrollArea className="max-h-72">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3 rounded-xl hover:bg-muted/50 cursor-pointer flex items-center gap-3 transition-colors"
                    onClick={() => { handleToolClick(tool.name); setSearchQuery(""); }}
                  >
                    <div className={`p-2 rounded-lg ${tool.bgColor}`}>
                      <tool.icon className={`h-4 w-4 ${tool.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{tool.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tool.category}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono shrink-0 border-primary/30 text-primary">
                      {formatCreditCost(getToolCost(tool.name))}
                    </Badge>
                  </div>
                ))}
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="stat-card">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/10">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold font-mono">{totalTools}</p>
                <p className="text-xs text-muted-foreground">Total Tools</p>
              </div>
            </div>
          </Card>
          <Card className="stat-card">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/10">
                <Zap className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-3xl font-bold font-mono">{toolCategories.length}</p>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </Card>
          <Card className="stat-card">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/10">
                <DollarSign className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-3xl font-bold font-mono">$5</p>
                <p className="text-xs text-muted-foreground">Min Cost</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tool Categories */}
        <Tabs defaultValue="trading" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0 mb-6">
            {toolCategories.map((category) => (
              <TabsTrigger 
                key={category.id} 
                value={category.id} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-transparent data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:shadow-sm transition-all"
              >
                <category.icon className={`h-4 w-4 ${category.color}`} />
                <span className="font-medium">{category.name}</span>
                <Badge variant="secondary" className="ml-0.5 h-5 px-2 text-[10px] font-mono">
                  {category.tools.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {toolCategories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-0 animate-fade-in">
              <div className="grid grid-cols-1 gap-4">
                {category.tools.map((tool) => {
                  const cost = getToolCost(tool.name);
                  return (
                    <Card
                      key={tool.name}
                      className="glass-card cursor-pointer hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 group"
                      onClick={() => handleToolClick(tool.name)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                          <div className={`p-4 rounded-2xl ${category.bgColor} border border-transparent group-hover:border-primary/20 transition-colors shrink-0`}>
                            <tool.icon className={`h-7 w-7 ${category.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold text-base">{tool.name}</h3>
                              <Badge 
                                variant="outline" 
                                className={`font-mono text-xs shrink-0 ${cost >= 40 ? 'border-amber-500/50 text-amber-500' : 'border-primary/50 text-primary'}`}
                              >
                                {formatCreditCost(cost)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Tool Modal */}
      <Dialog open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto p-0 glass-card border-border/50">
          <div className="flex items-center justify-between p-5 border-b border-border/50 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{selectedTool}</h2>
                {selectedTool && (
                  <Badge variant="outline" className="font-mono text-xs mt-1 border-primary/30 text-primary">
                    Cost: {formatCreditCost(getToolCost(selectedTool))}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSelectedTool(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-5">
            {ToolComponent && <ToolComponent />}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdvancedTools;
