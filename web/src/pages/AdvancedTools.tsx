import { useState } from "react";
import {
  Wrench, Rocket, Shield, Zap, TrendingUp, BarChart3, Cpu, X, Search,
  Activity, Flame, Link2, Eye, Clock, Users, AlertTriangle, Coins,
  Wallet, LineChart, DollarSign, Sparkles, ChevronRight, Star
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { OGBannerPromo } from "@/components/banners/OGBanner3D";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  if (key && CREDIT_PRICING[key]) return CREDIT_PRICING[key].cost;
  return 10;
};

const toolCategories = [
  {
    id: "trading",
    name: "Trading",
    icon: TrendingUp,
    accent: "#22d3ee",
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
    accent: "#eab308",
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
    accent: "#22d3ee",
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
    accent: "#f87171",
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
    accent: "#eab308",
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

const totalTools = toolCategories.reduce((s, c) => s + c.tools.length, 0);

const AdvancedTools = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allTools = toolCategories.flatMap((cat) =>
    cat.tools.map((tool) => ({ ...tool, category: cat.name, accent: cat.accent }))
  );
  const filteredTools = searchQuery
    ? allTools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleToolClick = (toolName: string) => {
    if (toolComponents[toolName]) setSelectedTool(toolName);
    else toast.info(`${toolName} opened`);
  };

  const ToolComponent = selectedTool ? toolComponents[selectedTool] : null;

  return (
    <AppLayout>
      <PageHeader title="Advanced Tools" description="30+ professional Solana analytics tools">
        <div className="flex items-center gap-3">
          <CreditBalance compact />
          <Badge className="bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20 gap-1.5 font-mono text-xs">
            <Sparkles className="h-3 w-3" />
            {totalTools} Tools
          </Badge>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">
          <OGBannerPromo title="Advanced Analytics" subtitle="30+ professional forensic tools for Solana intelligence" accent="purple" />

        {/* ── Search ── */}
        <div className="relative max-w-xl">
          <div className="og-search-box og-search-box-sm px-3">
            <Search className="h-4 w-4 text-[#22d3ee] shrink-0" />
            <input
              className="og-search-input og-search-input-sm text-sm"
              placeholder="Search tools by name or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 transition shrink-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {searchQuery && filteredTools.length > 0 && (
            <div className="absolute top-full mt-2 w-full z-[60] og-glass-frame p-2 rounded-2xl">
              <ScrollArea className="max-h-72">
                {filteredTools.map((tool) => (
                  <button
                    key={tool.name}
                    className="w-full p-3 rounded-xl hover:bg-white/[0.06] cursor-pointer flex items-center gap-3 transition-colors text-left"
                    onClick={() => { handleToolClick(tool.name); setSearchQuery(""); }}
                  >
                    <div className="p-2 rounded-lg border border-white/10 bg-white/[0.05]">
                      <tool.icon className="h-4 w-4 text-white/60" style={{ color: tool.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white">{tool.name}</p>
                      <p className="text-xs text-white/40 truncate">{tool.category}</p>
                    </div>
                    <Badge className="text-[10px] font-mono shrink-0 bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20">
                      {formatCreditCost(getToolCost(tool.name))}
                    </Badge>
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
          {searchQuery && filteredTools.length === 0 && (
            <div className="absolute top-full mt-2 w-full z-[60] og-glass-frame p-4 rounded-2xl text-center">
              <p className="text-sm text-white/30">No tools match "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Wrench, label: "Total Tools", value: totalTools, accent: "#22d3ee" },
            { icon: Zap, label: "Categories", value: toolCategories.length, accent: "#eab308" },
            { icon: DollarSign, label: "Min Cost", value: "$5", accent: "#22d3ee" },
          ].map((s) => (
            <div key={s.label} className="og-glass-card p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl border border-white/10" style={{ background: `${s.accent}18` }}>
                <s.icon className="h-4 w-4" style={{ color: s.accent }} />
              </div>
              <div>
                <p className="text-2xl font-black text-white font-mono">{s.value}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-widest">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Category Tabs ── */}
        <Tabs defaultValue="trading" className="w-full">
          <div className="overflow-x-auto ios-scroll mb-4">
            <TabsList className="inline-flex w-auto gap-1.5 bg-transparent p-0 h-auto">
              {toolCategories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/50 font-bold text-sm transition-all data-[state=active]:bg-white/[0.09] data-[state=active]:border-white/20 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <category.icon className="h-4 w-4" style={{ color: category.accent }} />
                  {category.name}
                  <span className="text-[10px] font-mono text-white/30">{category.tools.length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {toolCategories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.tools.map((tool) => {
                  const cost = getToolCost(tool.name);
                  return (
                    <button
                      key={tool.name}
                      className="group text-left p-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-4"
                      onClick={() => handleToolClick(tool.name)}
                    >
                      <div
                        className="p-3 rounded-xl border border-white/10 shrink-0 transition-all group-hover:scale-105"
                        style={{ background: `${category.accent}18` }}
                      >
                        <tool.icon className="h-5 w-5" style={{ color: category.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="font-bold text-sm text-white group-hover:text-white">{tool.name}</h3>
                          <Badge
                            className="text-[10px] font-mono shrink-0 ml-2"
                            style={{
                              background: cost >= 40 ? "rgba(234,179,8,0.12)" : "rgba(34,211,238,0.12)",
                              color: cost >= 40 ? "#eab308" : "#22d3ee",
                              borderColor: cost >= 40 ? "rgba(234,179,8,0.2)" : "rgba(34,211,238,0.2)",
                            }}
                          >
                            {formatCreditCost(cost)}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/40 line-clamp-1">{tool.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* ── Tool Modal ── */}
      <Dialog open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto p-0 og-glass-frame border-white/10">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] sticky top-0 z-10 backdrop-blur-sm bg-[hsl(var(--og-ink))/90]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20">
                <Wrench className="h-4 w-4 text-[#22d3ee]" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">{selectedTool}</h2>
                {selectedTool && (
                  <Badge className="text-[10px] font-mono mt-0.5 bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20">
                    Cost: {formatCreditCost(getToolCost(selectedTool))}
                  </Badge>
                )}
              </div>
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] transition"
              onClick={() => setSelectedTool(null)}
            >
              <X className="h-4 w-4" />
            </button>
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
