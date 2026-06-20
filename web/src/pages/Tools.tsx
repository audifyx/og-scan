import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Search, Loader2,
  Users, Droplets, Lock, ExternalLink, DollarSign, TrendingUp,
  Calendar, Wallet, BarChart3, Copy, Check,
  Globe, Twitter, MessageCircle, Zap, Eye,
  Wrench, Crosshair, Activity, Calculator, Cpu,
  ArrowRight, Sparkles, Star
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { solanaTracker, analyzeToken as analyzeTokenDirect, getTokenHolders, getLiquidityPools, getWalletOverview, getWalletPnL, getTransactions } from "@/lib/solana-tools";
import { getChain, explorerAddressUrl, isSolana } from "@/lib/chains";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { CREDIT_PRICING, formatCreditCost } from "@/lib/credit-pricing";

interface TokenAnalysis {
  name: string; symbol: string; image?: string; description?: string;
  mintAuthority: boolean; mintAuthorityAddress?: string;
  freezeAuthority: boolean; freezeAuthorityAddress?: string;
  supply: number; decimals: number; totalHolders: number;
  topHolders: Array<{ rank: number; address: string; amount: number; percent: string }>;
  top10HoldersPercent: number; price: number; priceChange24h: number;
  volume24h: number; liquidity: number; marketCap: number;
  createdAt?: string; creatorWallet?: string; riskScore: number;
  riskFactors: string[]; lpBurned: boolean; dexUrl?: string;
  solscanUrl?: string; rugcheckUrl?: string;
  links?: { website?: string; twitter?: string; telegram?: string; discord?: string; };
}

// Theme-aware accent: alternates between primary and secondary CSS vars so cards
// automatically match whatever theme the user has selected.
const TOOL_CARDS = [
  {
    id: "ai-intelligence",
    name: "AI Intelligence",
    description: "Talk to 40+ AI models, ensemble analysis, and generate beautiful AI reports",
    icon: Sparkles,
    accent: "primary" as const,
    category: "AI",
    active: true,
    route: "/intelligence",
  },
  {
    id: "rug-checker",
    name: "Rug Checker",
    description: "Comprehensive token safety analysis with on-chain data",
    icon: Shield,
    accent: "primary" as const,
    category: "Security",
    active: true,
  },
  {
    id: "wallet-profiler",
    name: "Wallet Profiler",
    description: "Analyze any wallet's trading performance and patterns",
    icon: Wallet,
    accent: "secondary" as const,
    category: "Analytics",
    active: true,
  },
  {
    id: "holder-scanner",
    name: "Holder Scanner",
    description: "Deep dive into token holder distribution and whale concentration",
    icon: Users,
    accent: "primary" as const,
    category: "Analytics",
    active: true,
  },
  {
    id: "liquidity-scanner",
    name: "Liquidity Scanner",
    description: "Check pool liquidity depth and LP token status",
    icon: Droplets,
    accent: "secondary" as const,
    category: "DeFi",
    active: true,
  },
  {
    id: "staking-calc",
    name: "Staking Calc",
    description: "Calculate staking rewards and APY estimates",
    icon: Calculator,
    accent: "primary" as const,
    category: "Finance",
    active: true,
  },
  {
    id: "token-sniper",
    name: "Token Sniper",
    description: "Detect and snipe new token launches in real-time",
    icon: Crosshair,
    accent: "secondary" as const,
    category: "Trading",
    active: true,
  },
  {
    id: "mev-tracker",
    name: "MEV Tracker",
    description: "Detect MEV activity and sandwich attacks",
    icon: Cpu,
    accent: "primary" as const,
    category: "Security",
    active: true,
  },
];

const Tools = () => {
  const navigate = useNavigate();
  const [tokenAddress, setTokenAddress] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TokenAnalysis | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState("rug-checker");
  const { spendCredits, canAfford } = useCredits();

  // Wallet Profiler state
  const [walletAddress, setWalletAddress] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);

  // Holder Scanner state
  const [holderToken, setHolderToken] = useState("");
  const [holderLoading, setHolderLoading] = useState(false);
  const [holderData, setHolderData] = useState<any[]>([]);

  // Liquidity Scanner state
  const [liqToken, setLiqToken] = useState("");
  const [liqLoading, setLiqLoading] = useState(false);
  const [liqData, setLiqData] = useState<any[]>([]);

  const runWalletProfile = async () => {
    if (!walletAddress || walletAddress.length < 32) { toast.error("Enter a valid wallet address"); return; }
    setWalletLoading(true); setWalletData(null);
    try {
      const [overview, pnl] = await Promise.allSettled([getWalletOverview(walletAddress), getWalletPnL(walletAddress)]);
      setWalletData({ overview: overview.status === "fulfilled" ? overview.value : null, pnl: pnl.status === "fulfilled" ? pnl.value : null });
      toast.success("Wallet profiled!");
    } catch { toast.error("Failed to profile wallet"); }
    finally { setWalletLoading(false); }
  };

  const runHolderScan = async () => {
    if (!holderToken || holderToken.length < 32) { toast.error("Enter a valid token address"); return; }
    setHolderLoading(true); setHolderData([]);
    try {
      const holders = await getTokenHolders(holderToken, 20);
      setHolderData(holders || []);
      toast.success(`Found ${(holders || []).length} holders`);
    } catch { toast.error("Failed to scan holders"); }
    finally { setHolderLoading(false); }
  };

  const runLiqScan = async () => {
    if (!liqToken || liqToken.length < 32) { toast.error("Enter a valid token address"); return; }
    setLiqLoading(true); setLiqData([]);
    try {
      const pools = await getLiquidityPools(liqToken);
      setLiqData(pools || []);
      toast.success(`Found ${(pools || []).length} pools`);
    } catch { toast.error("Failed to scan liquidity"); }
    finally { setLiqLoading(false); }
  };

  const rugCost = CREDIT_PRICING['rug-detector']?.cost || 10;

  const analyzeToken = async () => {
    if (!tokenAddress || tokenAddress.length < 32) { toast.error("Enter a valid token address"); return; }
    if (!canAfford('rug-detector')) { toast.error(`Insufficient credits. Costs ${formatCreditCost(rugCost)}`); return; }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const spent = await spendCredits('rug-detector', `Rug check: ${tokenAddress.slice(0, 8)}...`);
      if (!spent) { setIsAnalyzing(false); return; }

      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const dexData = await dexRes.json();
      const pair = dexData.pairs?.[0];

      const { data, error } = await solanaTracker('analyzeToken', { tokenAddress });
      if (error) throw new Error(error.message);

      const links: TokenAnalysis['links'] = {};
      if (pair?.info?.websites?.[0]?.url) links.website = pair.info.websites[0].url;
      if (pair?.info?.socials) {
        const tw = pair.info.socials.find((s: any) => s.type === 'twitter');
        const tg = pair.info.socials.find((s: any) => s.type === 'telegram');
        const dc = pair.info.socials.find((s: any) => s.type === 'discord');
        if (tw) links.twitter = tw.url;
        if (tg) links.telegram = tg.url;
        if (dc) links.discord = dc.url;
      }

      setAnalysis({
        ...data,
        name: pair?.baseToken?.name || data?.name || "Unknown",
        symbol: pair?.baseToken?.symbol || data?.symbol || "???",
        price: parseFloat(pair?.priceUsd) || data?.price || 0,
        priceChange24h: pair?.priceChange?.h24 || data?.priceChange24h || 0,
        volume24h: pair?.volume?.h24 || data?.volume24h || 0,
        liquidity: pair?.liquidity?.usd || data?.liquidity || 0,
        marketCap: pair?.fdv || data?.marketCap || 0,
        image: pair?.info?.imageUrl || data?.image,
        links,
        dexUrl: pair?.chainId ? `https://dexscreener.com/${pair.chainId}/${tokenAddress}` : `https://dexscreener.com/solana/${tokenAddress}`,
        solscanUrl: explorerAddressUrl(pair?.chainId ?? "solana", tokenAddress),
        rugcheckUrl: `https://rugcheck.xyz/tokens/${tokenAddress}`,
      });
      toast.success(`Analyzed ${pair?.baseToken?.symbol || data?.symbol || 'token'}`);
    } catch (error) { console.error('Analysis error:', error); toast.error("Analysis failed"); }
    finally { setIsAnalyzing(false); }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
  };

  const getRiskColor = (s: number) => s >= 80 ? "text-emerald-400" : s >= 50 ? "text-[#eab308]" : "text-red-400";
  const getRiskBg = (s: number) => s >= 80 ? "bg-emerald-500/15 border-emerald-500/30" : s >= 50 ? "bg-[#eab308]/15 border-[#eab308]/30" : "bg-red-500/15 border-red-500/30";
  const getRiskLabel = (s: number) => s >= 80 ? "Low Risk" : s >= 50 ? "Medium Risk" : "High Risk";
  const formatNumber = (n: number) => { if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`; if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`; return `$${n.toFixed(2)}`; };
  const formatAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "N/A";

  return (
    <AppLayout>
      <PageHeader title="OG Tools" showBack={false}>
        <div className="flex items-center gap-2">
          <CreditBalance compact />
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">

        {/* ── Tool Picker — compact pill chips ── */}
        <div className="flex flex-wrap justify-center gap-2 px-2">
          {TOOL_CARDS.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => (("route" in tool && tool.route) ? navigate(tool.route as string) : setActiveTool(tool.id))}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 transition-all duration-200 active:scale-95",
                  isActive
                    ? "border-primary/50 bg-primary/15 shadow-[0_0_16px_-6px_hsl(var(--primary)/0.8)]"
                    : "border-white/[0.08] bg-white/[0.04] hover:border-primary/25 hover:bg-primary/[0.06]",
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
                  isActive ? "bg-primary/25" : "bg-white/[0.06]",
                )}>
                  <tool.icon className={cn(
                    "h-3.5 w-3.5",
                    isActive ? "text-primary" : "text-white/45",
                  )} />
                </div>
                <span className={cn(
                  "text-[11px] font-bold leading-none whitespace-nowrap",
                  isActive ? "text-primary" : "text-white/55",
                )}>{tool.name}</span>
              </button>
            );
          })}
        </div>

        {activeTool === "ai-intelligence" && (
          <div className="space-y-4">
            <Card className="p-6 glass-card border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">AI Intelligence</h3>
              </div>
              <p className="text-white/60 mb-4">
                Talk to 40+ AI models across 5 specialized teams, generate AI-powered token reports, and analyze any token with ensemble voting.
              </p>
              <Button 
                onClick={() => navigate("/intelligence")}
                className="w-full btn-3d gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Open AI Intelligence
              </Button>
            </Card>
          </div>
        )}

        {activeTool === "rug-checker" && (
          <div className="space-y-5">
            {/* Search Bar */}
            <div className="og-search-box px-4">
              <Shield className="og-search-icon h-5 w-5 text-[#22d3ee] shrink-0" />
              <input
                className="og-search-input text-sm"
                placeholder="Paste token mint address to scan…"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyzeToken()}
              />
              <button
                onClick={analyzeToken}
                disabled={isAnalyzing}
                className="og-search-action flex items-center gap-2 px-5 text-sm font-bold text-white/80 hover:text-[hsl(var(--og-ink))] transition-colors"
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Shield className="h-4 w-4" /><span className="hidden sm:inline">Analyze</span></>}
              </button>
            </div>

            {/* Cost badge */}
            <div className="flex items-center gap-2">
              <Badge className="bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20 text-xs font-mono gap-1">
                <DollarSign className="h-3 w-3" />{rugCost} credits / scan
              </Badge>
              <span className="text-xs text-white/30">On-chain safety report</span>
            </div>

            {/* Results */}
            {analysis && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Token Header Card */}
                <div className="og-glass-card p-5">
                  <div className="flex items-start gap-4">
                    {analysis.image && (
                      <img
                        src={analysis.image}
                        alt={analysis.name}
                        className="h-14 w-14 rounded-2xl object-cover border border-white/10 shrink-0"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-xl font-black text-white">{analysis.name}</h2>
                        <Badge className="bg-white/10 text-white/70 border-white/10 font-mono text-xs">{analysis.symbol}</Badge>
                        <Badge className={`border text-xs font-bold ${getRiskBg(analysis.riskScore)}`}>
                          {getRiskLabel(analysis.riskScore)}
                        </Badge>
                      </div>
                      {analysis.description && <p className="text-sm text-white/45 line-clamp-1">{analysis.description}</p>}
                      <button
                        className="flex items-center gap-1.5 mt-2 font-mono text-xs text-white/35 hover:text-white/70 transition-colors"
                        onClick={() => copyAddress(tokenAddress)}
                      >
                        {formatAddr(tokenAddress)}
                        {copied === tokenAddress ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-4xl font-black tabular-nums ${getRiskColor(analysis.riskScore)}`}>{analysis.riskScore}</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">Safety Score</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="overview" className="w-full">
                  <div className="overflow-x-auto ios-scroll">
                    <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-1 gap-0.5">
                      {["overview", "holders", "security", "links", "risks"].map((t) => (
                        <TabsTrigger key={t} value={t} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide data-[state=active]:bg-white/10 data-[state=active]:text-white capitalize">
                          {t}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <TabsContent value="overview" className="mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { icon: DollarSign, label: "Price", value: `$${analysis.price < 0.01 ? analysis.price.toExponential(2) : analysis.price.toFixed(6)}`, sub: `${analysis.priceChange24h >= 0 ? "+" : ""}${analysis.priceChange24h.toFixed(2)}% 24h`, subColor: analysis.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400" },
                        { icon: BarChart3, label: "Market Cap", value: formatNumber(analysis.marketCap) },
                        { icon: Droplets, label: "Liquidity", value: formatNumber(analysis.liquidity) },
                        { icon: TrendingUp, label: "24h Volume", value: formatNumber(analysis.volume24h) },
                        { icon: Users, label: "Holders", value: analysis.totalHolders?.toLocaleString() || "N/A" },
                        { icon: Eye, label: "Top 10 Hold", value: `${analysis.top10HoldersPercent?.toFixed(1) || "N/A"}%` },
                        { icon: Calendar, label: "Created", value: analysis.createdAt ? formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true }) : "Unknown" },
                        { icon: Wallet, label: "Creator", value: analysis.creatorWallet ? formatAddr(analysis.creatorWallet) : "Unknown" },
                      ].map((s, i) => (
                        <div key={i} className="og-glass-card p-4">
                          <div className="flex items-center gap-2 text-white/35 mb-1.5">
                            <s.icon className="h-3.5 w-3.5" />
                            <span className="text-[10px] uppercase tracking-wider font-bold">{s.label}</span>
                          </div>
                          <p className="text-lg font-black text-white">{s.value}</p>
                          {s.sub && <p className={`text-xs mt-0.5 font-semibold ${(s as any).subColor || ""}`}>{s.sub}</p>}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="holders" className="mt-4">
                    <div className="og-glass-card p-5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#22d3ee]" /> Top Holders
                      </h3>
                      {analysis.topHolders?.length > 0 ? (
                        <div className="space-y-2">
                          {analysis.topHolders.map((h, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-[#22d3ee] w-5 text-center">#{h.rank}</span>
                                <button className="font-mono text-xs text-white/50 hover:text-white flex items-center gap-1" onClick={() => copyAddress(h.address)}>
                                  {formatAddr(h.address)}<Copy className="h-2.5 w-2.5" />
                                </button>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-sm text-white">{h.percent}</p>
                                <p className="text-[10px] text-white/30">{h.amount?.toLocaleString() || "N/A"} tokens</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-white/30">
                          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">Holder data not available</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="security" className="mt-4">
                    <div className="og-glass-card p-5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#22d3ee]" /> Security Checks
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { icon: Lock, label: "Mint Authority", safe: !analysis.mintAuthority, safeText: "Revoked ✓", dangerText: "Active ✗" },
                          { icon: AlertTriangle, label: "Freeze Authority", safe: !analysis.freezeAuthority, safeText: "Revoked ✓", dangerText: "Active ✗" },
                          { icon: Droplets, label: "LP Status", safe: analysis.lpBurned, safeText: "Burned ✓", dangerText: "Not Burned", warn: true },
                          { icon: Users, label: "Top 10 Concentration", safe: (analysis.top10HoldersPercent || 100) < 50, safeText: "Distributed ✓", dangerText: "Concentrated", warn: true },
                        ].map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/[0.05]">
                            <div className="flex items-center gap-2.5">
                              <c.icon className="h-4 w-4 text-white/30" />
                              <span className="text-sm font-semibold text-white/70">{c.label}</span>
                            </div>
                            {c.safe ? (
                              <span className="text-xs font-bold text-emerald-400">{c.safeText}</span>
                            ) : (
                              <span className={`text-xs font-bold ${c.warn ? "text-[#eab308]" : "text-red-400"}`}>{c.dangerText}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="links" className="mt-4">
                    <div className="og-glass-card p-5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-[#22d3ee]" /> External Links
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          analysis.dexUrl && { icon: BarChart3, label: "DexScreener", url: analysis.dexUrl, color: "text-[#22d3ee]" },
                          analysis.solscanUrl && { icon: ExternalLink, label: "Block Explorer", url: analysis.solscanUrl, color: "text-white/60" },
                          analysis.rugcheckUrl && { icon: Shield, label: "RugCheck", url: analysis.rugcheckUrl, color: "text-emerald-400" },
                          analysis.links?.website && { icon: Globe, label: "Website", url: analysis.links.website, color: "text-white/60" },
                          analysis.links?.twitter && { icon: Twitter, label: "Twitter / X", url: analysis.links.twitter, color: "text-white/60" },
                          analysis.links?.telegram && { icon: MessageCircle, label: "Telegram", url: analysis.links.telegram, color: "text-[#22d3ee]" },
                        ].filter(Boolean).map((link: any, i) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/10 transition-all group"
                          >
                            <link.icon className={`h-4 w-4 ${link.color}`} />
                            <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">{link.label}</span>
                            <ArrowRight className="h-3 w-3 text-white/20 ml-auto group-hover:text-white/50 transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="risks" className="mt-4">
                    <div className="og-glass-card p-5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#eab308]" /> Risk Factors
                      </h3>
                      {analysis.riskFactors?.length > 0 ? (
                        <div className="space-y-2.5">
                          {analysis.riskFactors.map((risk, i) => (
                            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/8 border border-red-500/20">
                              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                              <p className="text-sm text-white/80">{risk}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                          <p className="font-bold text-emerald-400">No major risk factors detected</p>
                          <p className="text-xs text-white/30 mt-1">Always DYOR before investing</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Empty state */}
            {!analysis && !isAnalyzing && (
              <div className="og-glass-card p-12 text-center">
                <div className="p-4 rounded-3xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 inline-flex mb-5">
                  <Shield className="h-10 w-10 text-[#22d3ee]" />
                </div>
                <h3 className="text-lg font-black text-white mb-2">Token Safety Scanner</h3>
                <p className="text-sm text-white/35 max-w-sm mx-auto">Paste any token address (Solana, ETH, Base, BSC, or any supported chain) above to run a comprehensive on-chain safety analysis.</p>
                <div className="flex items-center justify-center gap-6 mt-6">
                  {["Mint Authority", "LP Status", "Top Holders", "Risk Score"].map((f) => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-white/30">
                      <CheckCircle className="h-3 w-3 text-[#22d3ee]" />{f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Wallet Profiler ── */}
        {activeTool === "wallet-profiler" && (
          <div className="space-y-5">
            <div className="og-search-box px-4">
              <Wallet className="og-search-icon h-5 w-5 text-[#eab308] shrink-0" />
              <input className="og-search-input text-sm" placeholder="Paste wallet address to profile…" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runWalletProfile()} />
              <button onClick={runWalletProfile} disabled={walletLoading} className="og-search-action flex items-center gap-2 px-5 text-sm font-bold text-white/80 hover:text-[hsl(var(--og-ink))] transition-colors">
                {walletLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wallet className="h-4 w-4" /><span className="hidden sm:inline">Profile</span></>}
              </button>
            </div>
            {walletData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="og-glass-card p-4"><div className="flex items-center gap-2 text-white/35 mb-1.5"><DollarSign className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider font-bold">SOL Balance</span></div><p className="text-lg font-black text-white">{walletData.overview?.sol?.toFixed(4) ?? "N/A"}</p><p className="text-[10px] text-white/30">{walletData.overview?.solUsd ? formatNumber(walletData.overview.solUsd) : ""}</p></div>
                <div className="og-glass-card p-4"><div className="flex items-center gap-2 text-white/35 mb-1.5"><BarChart3 className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider font-bold">Portfolio Value</span></div><p className="text-lg font-black text-white">{walletData.overview?.totalValueUsd ? formatNumber(walletData.overview.totalValueUsd) : "N/A"}</p></div>
                <div className="og-glass-card p-4"><div className="flex items-center gap-2 text-white/35 mb-1.5"><Activity className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider font-bold">Tokens</span></div><p className="text-lg font-black text-white">{walletData.overview?.tokenCount ?? "N/A"}</p></div>
                <div className="og-glass-card p-4"><div className="flex items-center gap-2 text-white/35 mb-1.5"><TrendingUp className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider font-bold">Net Flow (SOL)</span></div><p className={`text-lg font-black ${(walletData.pnl?.netSol ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{walletData.pnl?.netSol != null ? `${walletData.pnl.netSol >= 0 ? "+" : ""}${walletData.pnl.netSol.toFixed(4)}` : "N/A"}</p><p className="text-[10px] text-white/30">{walletData.pnl?.swapCount ? `${walletData.pnl.swapCount} swaps` : ""}</p></div>
              </div>
            )}
            {!walletData && !walletLoading && (
              <div className="og-glass-card p-12 text-center">
                <div className="p-4 rounded-3xl bg-[#eab308]/10 border border-[#eab308]/20 inline-flex mb-5"><Wallet className="h-10 w-10 text-[#eab308]" /></div>
                <h3 className="text-lg font-black text-white mb-2">Wallet Profiler</h3>
                <p className="text-sm text-white/35 max-w-sm mx-auto">Paste any wallet address above to see SOL balance, token holdings, portfolio value, and realized PnL.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Holder Scanner ── */}
        {activeTool === "holder-scanner" && (
          <div className="space-y-5">
            <div className="og-search-box px-4">
              <Users className="og-search-icon h-5 w-5 text-[#22d3ee] shrink-0" />
              <input className="og-search-input text-sm" placeholder="Paste token address to scan holders…" value={holderToken} onChange={(e) => setHolderToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runHolderScan()} />
              <button onClick={runHolderScan} disabled={holderLoading} className="og-search-action flex items-center gap-2 px-5 text-sm font-bold text-white/80 hover:text-[hsl(var(--og-ink))] transition-colors">
                {holderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Users className="h-4 w-4" /><span className="hidden sm:inline">Scan</span></>}
              </button>
            </div>
            {holderData.length > 0 && (
              <div className="og-glass-card p-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-[#22d3ee]" /> Top {holderData.length} Holders</h3>
                <div className="space-y-2">
                  {holderData.map((h: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-[#22d3ee] w-5 text-center">#{h.rank}</span>
                        <button className="font-mono text-xs text-white/50 hover:text-white flex items-center gap-1" onClick={() => copyAddress(h.address)}>{formatAddr(h.address)}<Copy className="h-2.5 w-2.5" /></button>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm text-white">{h.percentage?.toFixed(2)}%</p>
                        <p className="text-[10px] text-white/30">{h.value ? formatNumber(h.value) : `${h.amount?.toLocaleString()} tokens`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {holderData.length === 0 && !holderLoading && (
              <div className="og-glass-card p-12 text-center">
                <div className="p-4 rounded-3xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 inline-flex mb-5"><Users className="h-10 w-10 text-[#22d3ee]" /></div>
                <h3 className="text-lg font-black text-white mb-2">Holder Scanner</h3>
                <p className="text-sm text-white/35 max-w-sm mx-auto">Paste any token address to see the top holders, their percentages, and USD values.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Liquidity Scanner ── */}
        {activeTool === "liquidity-scanner" && (
          <div className="space-y-5">
            <div className="og-search-box px-4">
              <Droplets className="og-search-icon h-5 w-5 text-[#eab308] shrink-0" />
              <input className="og-search-input text-sm" placeholder="Paste token address to scan liquidity pools…" value={liqToken} onChange={(e) => setLiqToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runLiqScan()} />
              <button onClick={runLiqScan} disabled={liqLoading} className="og-search-action flex items-center gap-2 px-5 text-sm font-bold text-white/80 hover:text-[hsl(var(--og-ink))] transition-colors">
                {liqLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Droplets className="h-4 w-4" /><span className="hidden sm:inline">Scan</span></>}
              </button>
            </div>
            {liqData.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {liqData.map((pool: any, i: number) => (
                  <div key={i} className="og-glass-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20 text-xs font-bold">{pool.dex || "DEX"}</Badge>
                        <span className="text-sm font-bold text-white">{pool.baseToken?.symbol}/{pool.quoteToken?.symbol}</span>
                      </div>
                      {pool.pairAddress && <button className="font-mono text-[10px] text-white/30 hover:text-white/60" onClick={() => copyAddress(pool.pairAddress)}>{formatAddr(pool.pairAddress)}</button>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><span className="text-[10px] text-white/35 uppercase font-bold">Liquidity</span><p className="text-sm font-black text-white">{formatNumber(pool.liquidity || 0)}</p></div>
                      <div><span className="text-[10px] text-white/35 uppercase font-bold">24h Volume</span><p className="text-sm font-black text-white">{formatNumber(pool.volume24h || 0)}</p></div>
                      <div><span className="text-[10px] text-white/35 uppercase font-bold">FDV</span><p className="text-sm font-black text-white">{formatNumber(pool.fdv || 0)}</p></div>
                      <div><span className="text-[10px] text-white/35 uppercase font-bold">Price</span><p className="text-sm font-black text-white">${parseFloat(pool.priceUsd || 0) < 0.01 ? parseFloat(pool.priceUsd || 0).toExponential(2) : parseFloat(pool.priceUsd || 0).toFixed(6)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {liqData.length === 0 && !liqLoading && (
              <div className="og-glass-card p-12 text-center">
                <div className="p-4 rounded-3xl bg-[#eab308]/10 border border-[#eab308]/20 inline-flex mb-5"><Droplets className="h-10 w-10 text-[#eab308]" /></div>
                <h3 className="text-lg font-black text-white mb-2">Liquidity Scanner</h3>
                <p className="text-sm text-white/35 max-w-sm mx-auto">Paste any token address to see all liquidity pools, their depth, volume, and FDV across DEXes.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Staking Calculator ── */}
        {activeTool === "staking-calc" && (
          <div className="og-glass-card p-8 text-center space-y-4">
            <div className="p-4 rounded-3xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 inline-flex mb-2"><Calculator className="h-10 w-10 text-[#22d3ee]" /></div>
            <h3 className="text-lg font-black text-white">Staking Calculator</h3>
            <p className="text-sm text-white/35 max-w-md mx-auto">Solana staking currently yields ~7-8% APY. Enter your SOL amount below:</p>
            <div className="max-w-xs mx-auto space-y-3">
              <Input type="number" placeholder="SOL amount" className="bg-white/5 border-white/10 text-white text-center" id="stakeAmt" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="og-glass-card p-3"><span className="text-[10px] text-white/35 uppercase font-bold block">30 days</span><p className="text-sm font-black text-[#22d3ee]" id="stake30">—</p></div>
                <div className="og-glass-card p-3"><span className="text-[10px] text-white/35 uppercase font-bold block">6 months</span><p className="text-sm font-black text-[#22d3ee]" id="stake180">—</p></div>
                <div className="og-glass-card p-3"><span className="text-[10px] text-white/35 uppercase font-bold block">1 year</span><p className="text-sm font-black text-[#22d3ee]" id="stake365">—</p></div>
              </div>
              <Button className="w-full" onClick={() => {
                const amt = parseFloat((document.getElementById("stakeAmt") as HTMLInputElement)?.value || "0");
                if (!amt) { toast.error("Enter an amount"); return; }
                const apy = 0.075;
                const d30 = document.getElementById("stake30"); if (d30) d30.textContent = `+${(amt * apy * 30/365).toFixed(4)} SOL`;
                const d180 = document.getElementById("stake180"); if (d180) d180.textContent = `+${(amt * apy * 180/365).toFixed(4)} SOL`;
                const d365 = document.getElementById("stake365"); if (d365) d365.textContent = `+${(amt * apy).toFixed(4)} SOL`;
                toast.success("Calculated!");
              }}>Calculate Rewards</Button>
            </div>
          </div>
        )}

        {/* ── Token Sniper → Snipe Feed ── */}
        {activeTool === "token-sniper" && (
          <div className="og-glass-card p-12 text-center">
            <div className="p-4 rounded-3xl bg-[#eab308]/10 border border-[#eab308]/20 inline-flex mb-5"><Crosshair className="h-10 w-10 text-[#eab308]" /></div>
            <h3 className="text-lg font-black text-white mb-2">Token Sniper</h3>
            <p className="text-sm text-white/35 max-w-sm mx-auto">Real-time snipe detection across all chains. Use the Snipe Feed for live alerts.</p>
            <button onClick={() => window.location.href = "/snipe-feed"} className="ios-primary-button mt-6 gap-2"><Crosshair className="h-4 w-4" /> Open Snipe Feed</button>
          </div>
        )}

        {/* ── MEV Tracker → Migrations ── */}
        {activeTool === "mev-tracker" && (
          <div className="og-glass-card p-12 text-center">
            <div className="p-4 rounded-3xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 inline-flex mb-5"><Cpu className="h-10 w-10 text-[#22d3ee]" /></div>
            <h3 className="text-lg font-black text-white mb-2">MEV Tracker</h3>
            <p className="text-sm text-white/35 max-w-sm mx-auto">Track sandwich attacks and MEV activity. Use the Migrations page for real-time on-chain flow tracking.</p>
            <button onClick={() => window.location.href = "/migrations"} className="ios-primary-button mt-6 gap-2"><Activity className="h-4 w-4" /> Open Migrations</button>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default Tools;
// Force rebuild Fri Jun 19 19:30:01 UTC 2026
