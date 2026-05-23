import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "sonner";
import {
  Copy, ExternalLink, TrendingUp, TrendingDown, BarChart3, Droplets,
  Users, Shield, AlertTriangle, Check, Loader2, Brain, Target,
  DollarSign, Activity, Zap, Globe, Twitter
} from "lucide-react";

interface TokenDetailPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
}

interface TokenData {
  name?: string;
  symbol?: string;
  price: string;
  priceChange24h: number;
  priceChange1h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  holderCount?: number;
  supply?: number;
  imageUrl?: string;
  socials?: Array<{ type: string; url: string }>;
  websites?: Array<{ label: string; url: string }>;
  description?: string;
}

interface AIAnalysis {
  riskScore: number;
  summary: string;
  pros: string[];
  cons: string[];
  recommendation: string;
  marketSentiment?: string;
  liquidityRating?: string;
  volumeRating?: string;
  teamAssessment?: string;
  narrativeTrend?: string;
}

export const TokenDetailPopup = ({
  open,
  onOpenChange,
  tokenAddress,
  tokenName,
  tokenSymbol,
}: TokenDetailPopupProps) => {
  const { spendCredits, canAfford } = useCredits();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && tokenAddress) {
      fetchTokenData();
    }
  }, [open, tokenAddress]);

  const fetchTokenData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("token-data", {
        body: { action: "get_token_data", tokenAddress },
      });

      if (!error && data?.success) {
        setTokenData(data.data);
      }
    } catch (error) {
      console.error("Error fetching token data:", error);
      toast.error("Failed to load token data");
    } finally {
      setLoading(false);
    }
  };

  const runAIAnalysis = async () => {
    if (!canAfford("ai-token-analysis")) {
      toast.error("Insufficient credits for AI analysis");
      return;
    }

    setAnalyzingAI(true);
    try {
      const success = await spendCredits("ai-token-analysis", `AI analysis for ${tokenSymbol || tokenAddress.slice(0, 8)}`);
      if (!success) {
        setAnalyzingAI(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("token-data", {
        body: { action: "ai_analysis", tokenAddress, tokenName: tokenName || tokenData?.name },
      });

      if (!error && data?.success) {
        setAiAnalysis(data.analysis);
        toast.success("AI Analysis complete!");
      } else {
        toast.error("AI analysis failed");
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error("Failed to run AI analysis");
    } finally {
      setAnalyzingAI(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return "—";
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price: string | undefined) => {
    if (!price) return "—";
    const num = parseFloat(price);
    if (num < 0.000001) return `$${num.toExponential(2)}`;
    if (num < 0.01) return `$${num.toFixed(8)}`;
    return `$${num.toFixed(4)}`;
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return "text-accent";
    if (score < 60) return "text-yellow-500";
    return "text-destructive";
  };

  const getRiskLabel = (score: number) => {
    if (score < 30) return "Low Risk";
    if (score < 60) return "Medium Risk";
    return "High Risk";
  };

  const displayName = tokenData?.name || tokenName || "Unknown Token";
  const displaySymbol = tokenData?.symbol || tokenSymbol || "???";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {tokenData?.imageUrl ? (
                <img 
                  src={tokenData.imageUrl} 
                  alt={displaySymbol} 
                  className="w-14 h-14 rounded-2xl object-cover bg-muted"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {displaySymbol.slice(0, 2)}
                </div>
              )}
              <div>
                <DialogTitle className="text-xl">{displayName}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">${displaySymbol}</Badge>
                  <Badge variant="outline" className="text-xs">Solana</Badge>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={copyAddress}
              className="shrink-0 h-10 w-10 rounded-xl"
            >
              {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6 pt-4 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="chart">Chart</TabsTrigger>
                  <TabsTrigger value="ai">AI Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {/* Price & Change */}
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Price</p>
                          <p className="text-3xl font-bold">{formatPrice(tokenData?.price)}</p>
                        </div>
                        <div className={`flex items-center gap-1 text-lg font-semibold ${
                          (tokenData?.priceChange24h || 0) >= 0 ? "text-accent" : "text-destructive"
                        }`}>
                          {(tokenData?.priceChange24h || 0) >= 0 ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                          {tokenData?.priceChange24h?.toFixed(2) || 0}%
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: BarChart3, label: "Market Cap", value: formatNumber(tokenData?.marketCap) },
                      { icon: Droplets, label: "Liquidity", value: formatNumber(tokenData?.liquidity) },
                      { icon: Activity, label: "24h Volume", value: formatNumber(tokenData?.volume24h) },
                      { icon: Users, label: "Holders", value: tokenData?.holderCount?.toLocaleString() || "—" },
                    ].map((stat, i) => (
                      <Card key={i} className="bg-muted/30">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{stat.label}</span>
                          </div>
                          <p className="text-lg font-bold">{stat.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Description */}
                  {tokenData?.description && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">{tokenData.description}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Links */}
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 rounded-xl"
                      onClick={() => window.open(`https://dexscreener.com/solana/${tokenAddress}`, "_blank")}
                    >
                      <BarChart3 className="h-4 w-4" />
                      DexScreener
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 rounded-xl"
                      onClick={() => window.open(`https://solscan.io/token/${tokenAddress}`, "_blank")}
                    >
                      <Shield className="h-4 w-4" />
                      Solscan
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {tokenData?.socials?.map((social, i) => (
                      <Button 
                        key={i}
                        variant="outline" 
                        size="sm" 
                        className="gap-2 rounded-xl"
                        onClick={() => window.open(social.url, "_blank")}
                      >
                        {social.type === "twitter" ? <Twitter className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                        {social.type}
                      </Button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="chart">
                  <Card className="overflow-hidden">
                    <div className="aspect-video">
                      <iframe
                        src={`https://dexscreener.com/solana/${tokenAddress}?embed=1&theme=dark&trades=0&info=0`}
                        className="w-full h-full"
                        title={`${displaySymbol} Chart`}
                        allow="clipboard-write"
                      />
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="ai" className="space-y-4">
                  {!aiAnalysis ? (
                    <Card className="glass-card">
                      <CardContent className="p-8 text-center">
                        <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                        <h3 className="font-bold text-lg mb-2">AI Token Analysis</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          Get project strength, risk assessment, and trading insights powered by AI.
                        </p>
                        <Button 
                          onClick={runAIAnalysis} 
                          disabled={analyzingAI}
                          className="btn-premium gap-2"
                        >
                          {analyzingAI ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          {analyzingAI ? "Analyzing..." : "Run AI Analysis"}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-3">Uses credits</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Risk Score */}
                      <Card className={`border-2 ${
                        aiAnalysis.riskScore < 30 ? "border-accent/30 bg-accent/5" :
                        aiAnalysis.riskScore < 60 ? "border-yellow-500/30 bg-yellow-500/5" :
                        "border-destructive/30 bg-destructive/5"
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Shield className={`h-5 w-5 ${getRiskColor(aiAnalysis.riskScore)}`} />
                              <span className="font-semibold">Risk Assessment</span>
                            </div>
                            <Badge className={`${
                              aiAnalysis.riskScore < 30 ? "bg-accent/20 text-accent" :
                              aiAnalysis.riskScore < 60 ? "bg-yellow-500/20 text-yellow-500" :
                              "bg-destructive/20 text-destructive"
                            }`}>
                              {getRiskLabel(aiAnalysis.riskScore)}
                            </Badge>
                          </div>
                          <Progress value={100 - aiAnalysis.riskScore} className="h-3 mb-2" />
                          <p className="text-sm text-muted-foreground">Score: {aiAnalysis.riskScore}/100</p>
                        </CardContent>
                      </Card>

                      {/* Summary */}
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            Summary
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.summary}</p>
                        </CardContent>
                      </Card>

                      {/* Pros & Cons */}
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="bg-accent/5 border-accent/20">
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-2 text-accent flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Pros
                            </h4>
                            <ul className="space-y-1">
                              {aiAnalysis.pros.map((pro, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <Check className="h-3 w-3 text-accent mt-1 shrink-0" />
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                        <Card className="bg-destructive/5 border-destructive/20">
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-2 text-destructive flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Cons
                            </h4>
                            <ul className="space-y-1">
                              {aiAnalysis.cons.map((con, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <AlertTriangle className="h-3 w-3 text-destructive mt-1 shrink-0" />
                                  {con}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Recommendation */}
                      <Card className="glass-card-premium">
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            AI Recommendation
                          </h4>
                          <p className="text-sm font-medium">{aiAnalysis.recommendation}</p>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TokenDetailPopup;
