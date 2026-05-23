import { useState } from "react";
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, Search, Loader2, 
  Users, Droplets, Lock, ExternalLink, DollarSign, TrendingUp,
  Calendar, Wallet, BarChart3, RefreshCw, Copy, Check, 
  Globe, Twitter, MessageCircle, Zap, Eye, Clock,
  Wrench, Crosshair, Activity, Calculator, Cpu
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
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

const TOOL_CARDS = [
  { id: "rug-checker", name: "Rug Checker", description: "Comprehensive token safety analysis with on-chain data", icon: Shield, color: "text-green-500", bg: "bg-green-500/10", active: true },
  { id: "wallet-profiler", name: "Wallet Profiler", description: "Analyze any wallet's trading performance and patterns", icon: Wallet, color: "text-primary", bg: "bg-primary/10", active: true },
  { id: "holder-scanner", name: "Holder Scanner", description: "Deep dive into token holder distribution and whale concentration", icon: Users, color: "text-secondary", bg: "bg-secondary/10", active: true },
  { id: "liquidity-scanner", name: "Liquidity Scanner", description: "Check pool liquidity depth and LP token status", icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10", active: true },
  { id: "staking-calc", name: "Staking Calculator", description: "Calculate staking rewards and APY estimates", icon: Calculator, color: "text-accent", bg: "bg-accent/10", active: true },
  { id: "token-sniper", name: "Token Sniper", description: "Detect and snipe new token launches in real-time", icon: Crosshair, color: "text-orange-500", bg: "bg-orange-500/10", active: true },
  { id: "mev-tracker", name: "MEV Tracker", description: "Detect MEV activity and sandwich attacks", icon: Cpu, color: "text-purple-500", bg: "bg-purple-500/10", comingSoon: true },
];

const Tools = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TokenAnalysis | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState("rug-checker");
  const { spendCredits, canAfford } = useCredits();

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

      const { data, error } = await supabase.functions.invoke('solana-tracker', { body: { action: 'analyzeToken', tokenAddress } });
      if (error) throw error;

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
        dexUrl: `https://dexscreener.com/solana/${tokenAddress}`,
        solscanUrl: `https://solscan.io/token/${tokenAddress}`,
        rugcheckUrl: `https://rugcheck.xyz/tokens/${tokenAddress}`,
      });
      toast.success(`Analyzed ${pair?.baseToken?.symbol || data?.symbol || 'token'}`);
    } catch (error) { console.error('Analysis error:', error); toast.error("Analysis failed"); }
    finally { setIsAnalyzing(false); }
  };

  const copyAddress = (address: string) => { navigator.clipboard.writeText(address); setCopied(address); setTimeout(() => setCopied(null), 2000); toast.success("Copied!"); };
  const getRiskColor = (s: number) => s >= 80 ? "text-green-500" : s >= 50 ? "text-yellow-500" : "text-red-500";
  const getRiskBg = (s: number) => s >= 80 ? "bg-green-500/20 border-green-500/30" : s >= 50 ? "bg-yellow-500/20 border-yellow-500/30" : "bg-red-500/20 border-red-500/30";
  const getRiskLabel = (s: number) => s >= 80 ? "Low Risk" : s >= 50 ? "Medium Risk" : "High Risk";
  const formatNumber = (n: number) => { if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`; if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`; return `$${n.toFixed(2)}`; };
  const formatAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "N/A";

  return (
    <AppLayout>
      <PageHeader title="Tools" description="Professional Solana analysis toolkit">
        <div className="flex items-center gap-2"><CreditBalance compact /></div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Tool Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {TOOL_CARDS.map((tool) => (
            <Card
              key={tool.id}
              className={`glass-card cursor-pointer transition-all hover:border-primary/30 relative overflow-hidden ${activeTool === tool.id ? 'border-primary bg-primary/5' : ''} ${tool.comingSoon ? 'opacity-60' : ''}`}
              onClick={() => !tool.comingSoon && setActiveTool(tool.id)}
            >
              {tool.comingSoon && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Coming Soon</Badge>
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2.5 rounded-xl ${tool.bg}`}><tool.icon className={`h-5 w-5 ${tool.color}`} /></div>
                  <h3 className="font-semibold text-sm">{tool.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Tool Content */}
        {activeTool === "rug-checker" && (
          <div className="space-y-6">
            <Card className="glass-card-premium">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-green-500/10"><Shield className="h-6 w-6 text-green-500" /></div>
                  <div>
                    <h2 className="font-semibold text-lg">Token Safety Scanner</h2>
                    <p className="text-sm text-muted-foreground">Analyze any Solana token for potential risks</p>
                  </div>
                  <Badge variant="outline" className="ml-auto font-mono text-xs"><DollarSign className="h-3 w-3 mr-0.5" />{rugCost}/scan</Badge>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Enter token mint address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && analyzeToken()} className="pl-10 h-12 rounded-xl bg-muted/30" />
                  </div>
                  <Button onClick={analyzeToken} disabled={isAnalyzing} className="h-12 px-6 rounded-xl">
                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Shield className="h-4 w-4 mr-2" />Analyze</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {analysis && (
              <div className="space-y-6 animate-fade-in">
                {/* Token Header */}
                <Card className="glass-card overflow-hidden">
                  <div className={`h-2 ${getRiskBg(analysis.riskScore)}`} />
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {analysis.image && <img src={analysis.image} alt={analysis.name} className="h-16 w-16 rounded-2xl object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-2xl font-bold">{analysis.name}</h2>
                          <Badge variant="outline">{analysis.symbol}</Badge>
                          <Badge className={getRiskBg(analysis.riskScore)}>{getRiskLabel(analysis.riskScore)}</Badge>
                        </div>
                        {analysis.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{analysis.description}</p>}
                        <Button variant="ghost" size="sm" className="font-mono text-xs h-7 px-2 mt-2" onClick={() => copyAddress(tokenAddress)}>
                          {formatAddr(tokenAddress)}{copied === tokenAddress ? <Check className="h-3 w-3 ml-1 text-green-500" /> : <Copy className="h-3 w-3 ml-1" />}
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className={`text-4xl font-bold ${getRiskColor(analysis.riskScore)}`}>{analysis.riskScore}</p>
                        <p className="text-sm text-muted-foreground">Safety Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs defaultValue="overview" className="w-full">
                  <div className="overflow-x-auto">
                    <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 bg-muted/50">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="holders">Holders</TabsTrigger>
                      <TabsTrigger value="security">Security</TabsTrigger>
                      <TabsTrigger value="links">Links</TabsTrigger>
                      <TabsTrigger value="risks">Risks</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="overview" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { icon: DollarSign, label: "Price", value: `$${analysis.price < 0.01 ? analysis.price.toExponential(2) : analysis.price.toFixed(6)}`, sub: `${analysis.priceChange24h >= 0 ? '+' : ''}${analysis.priceChange24h.toFixed(2)}% 24h`, subColor: analysis.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500' },
                        { icon: BarChart3, label: "Market Cap", value: formatNumber(analysis.marketCap) },
                        { icon: Droplets, label: "Liquidity", value: formatNumber(analysis.liquidity) },
                        { icon: TrendingUp, label: "24h Volume", value: formatNumber(analysis.volume24h) },
                        { icon: Users, label: "Holders", value: analysis.totalHolders?.toLocaleString() || 'N/A' },
                        { icon: Eye, label: "Top 10 Hold", value: `${analysis.top10HoldersPercent?.toFixed(1) || 'N/A'}%` },
                        { icon: Calendar, label: "Created", value: analysis.createdAt ? formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true }) : 'Unknown' },
                        { icon: Wallet, label: "Creator", value: analysis.creatorWallet ? formatAddr(analysis.creatorWallet) : 'Unknown' },
                      ].map((s, i) => (
                        <Card key={i} className="glass-card"><CardContent className="p-4">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1"><s.icon className="h-4 w-4" /><span className="text-xs">{s.label}</span></div>
                          <p className="text-xl font-bold">{s.value}</p>
                          {s.sub && <p className={`text-xs ${s.subColor || ''}`}>{s.sub}</p>}
                        </CardContent></Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="holders" className="mt-4">
                    <Card className="glass-card"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Top Holders</CardTitle></CardHeader>
                      <CardContent>{analysis.topHolders?.length > 0 ? (
                        <div className="space-y-3">{analysis.topHolders.map((h, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">{h.rank}</Badge>
                              <Button variant="ghost" size="sm" className="font-mono text-sm p-0 h-auto" onClick={() => copyAddress(h.address)}>{formatAddr(h.address)}<Copy className="h-3 w-3 ml-1" /></Button>
                            </div>
                            <div className="text-right"><p className="font-semibold">{h.percent}</p><p className="text-xs text-muted-foreground">{h.amount?.toLocaleString() || 'N/A'} tokens</p></div>
                          </div>
                        ))}</div>
                      ) : <div className="text-center py-8 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Holder data not available</p></div>}</CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="security" className="mt-4">
                    <Card className="glass-card"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Security Checks</CardTitle></CardHeader>
                      <CardContent><div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { icon: Lock, label: "Mint Authority", safe: !analysis.mintAuthority, safeText: "Revoked", dangerText: "Active" },
                          { icon: AlertTriangle, label: "Freeze Authority", safe: !analysis.freezeAuthority, safeText: "Revoked", dangerText: "Active" },
                          { icon: Droplets, label: "LP Status", safe: analysis.lpBurned, safeText: "Burned/Locked", dangerText: "Not Burned", warn: true },
                          { icon: Users, label: "Top 10 Concentration", safe: (analysis.top10HoldersPercent || 100) < 50, safeText: "Distributed", dangerText: "Concentrated", warn: true },
                        ].map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                            <div className="flex items-center gap-2"><c.icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{c.label}</span></div>
                            {c.safe ? (
                              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="text-xs text-green-500">{c.safeText}</span></div>
                            ) : (
                              <div className="flex items-center gap-2"><XCircle className={`h-5 w-5 ${c.warn ? 'text-yellow-500' : 'text-red-500'}`} /><span className={`text-xs ${c.warn ? 'text-yellow-500' : 'text-red-500'}`}>{c.dangerText}</span></div>
                            )}
                          </div>
                        ))}
                      </div></CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="links" className="mt-4">
                    <Card className="glass-card"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" />Links</CardTitle></CardHeader>
                      <CardContent><div className="grid gap-3 sm:grid-cols-2">
                        {[
                          analysis.dexUrl && { icon: BarChart3, label: "DexScreener Chart", url: analysis.dexUrl },
                          analysis.solscanUrl && { icon: ExternalLink, label: "Solscan Explorer", url: analysis.solscanUrl },
                          analysis.rugcheckUrl && { icon: Shield, label: "RugCheck Analysis", url: analysis.rugcheckUrl },
                          analysis.links?.website && { icon: Globe, label: "Website", url: analysis.links.website },
                          analysis.links?.twitter && { icon: Twitter, label: "Twitter / X", url: analysis.links.twitter },
                          analysis.links?.telegram && { icon: MessageCircle, label: "Telegram", url: analysis.links.telegram },
                        ].filter(Boolean).map((link: any, i) => (
                          <Button key={i} variant="outline" className="justify-start gap-2 h-12" asChild>
                            <a href={link.url} target="_blank" rel="noopener noreferrer"><link.icon className="h-4 w-4" />{link.label}</a>
                          </Button>
                        ))}
                      </div></CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="risks" className="mt-4">
                    <Card className="glass-card"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Risk Factors</CardTitle></CardHeader>
                      <CardContent>{analysis.riskFactors?.length > 0 ? (
                        <div className="space-y-3">{analysis.riskFactors.map((risk, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" /><p className="text-sm">{risk}</p></div>
                        ))}</div>
                      ) : (
                        <div className="text-center py-8"><CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" /><p className="font-medium text-green-500">No major risk factors detected</p><p className="text-sm text-muted-foreground mt-1">Always DYOR before investing</p></div>
                      )}</CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {!analysis && !isAnalyzing && (
              <Card className="glass-card"><CardContent className="py-16 text-center">
                <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">Enter a Token Address</h3>
                <p className="text-muted-foreground max-w-md mx-auto">Paste any Solana token mint address above to run a comprehensive safety analysis.</p>
              </CardContent></Card>
            )}
          </div>
        )}

        {activeTool === "wallet-profiler" && (
          <Card className="glass-card"><CardContent className="py-16 text-center">
            <Wallet className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Wallet Profiler</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Use the dedicated Wallet Tracker page for full wallet profiling with live tracking, token holdings, and transaction history.</p>
            <Button className="mt-4" onClick={() => window.location.href = '/wallets'}>Go to Wallet Tracker</Button>
          </CardContent></Card>
        )}

        {activeTool === "holder-scanner" && (
          <Card className="glass-card"><CardContent className="py-16 text-center">
            <Users className="h-16 w-16 text-secondary mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Holder Scanner</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Run a Rug Check on any token to see full holder distribution, top 10 holders, and concentration metrics.</p>
            <Button className="mt-4" onClick={() => setActiveTool('rug-checker')}>Open Rug Checker</Button>
          </CardContent></Card>
        )}

        {activeTool === "liquidity-scanner" && (
          <Card className="glass-card"><CardContent className="py-16 text-center">
            <Droplets className="h-16 w-16 text-blue-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Liquidity Scanner</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Use the Advanced Tools page for the full Liquidity Scanner with LP position analysis and yield tracking.</p>
            <Button className="mt-4" onClick={() => window.location.href = '/advanced-tools'}>Go to Advanced Tools</Button>
          </CardContent></Card>
        )}

        {activeTool === "staking-calc" && (
          <Card className="glass-card"><CardContent className="py-16 text-center">
            <Calculator className="h-16 w-16 text-accent mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Staking Calculator</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Access the Staking Calculator in Advanced Tools for APY estimates and reward projections.</p>
            <Button className="mt-4" onClick={() => window.location.href = '/advanced-tools'}>Go to Advanced Tools</Button>
          </CardContent></Card>
        )}

        {activeTool === "token-sniper" && (
          <Card className="glass-card"><CardContent className="py-16 text-center">
            <Crosshair className="h-16 w-16 text-orange-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Token Sniper</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Detect and snipe new token launches. Head to Advanced Tools for the full Liquidity Sniper and Token Sniper suite.</p>
            <Button className="mt-4" onClick={() => window.location.href = '/advanced-tools'}>Go to Advanced Tools</Button>
          </CardContent></Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Tools;
