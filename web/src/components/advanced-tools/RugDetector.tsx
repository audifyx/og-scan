import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, RefreshCw, Shield, Check, X, Lock, Users, Droplets, Zap, Eye, ExternalLink, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { solanaTracker } from "@/lib/solana-tools";

interface RiskFlag {
  flag: string;
  risk: "high" | "medium" | "low";
  desc: string;
  impact: number;
}

interface TokenAnalysis {
  name?: string;
  symbol?: string;
  price?: number;
  marketCap?: number;
  holders?: number;
  liquidity?: number;
  mintAuthority?: boolean;
  freezeAuthority?: boolean;
  topHolderPercent?: number;
  lpLocked?: boolean;
  rugFlags: RiskFlag[];
  rugScore: number;
  isSafe: boolean;
}

export const RugDetector = () => {
  const { spendCredits, canAfford } = useCredits();
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TokenAnalysis | null>(null);

  const detectRug = async () => {
    if (!tokenAddress) {
      toast({ title: "Enter a token address", variant: "destructive" });
      return;
    }

    // Check credits
    if (!canAfford('rug-detector')) {
      toast({ title: "Insufficient credits for Rug Detector scan", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Spend credits
      const success = await spendCredits('rug-detector', `Scanned token: ${tokenAddress.slice(0, 8)}...`);
      if (!success) {
        setLoading(false);
        return;
      }

      const { data } = await solanaTracker("analyzeToken", { tokenAddress });

      const rugFlags: RiskFlag[] = [];
      let rugScore = 0;

      // Check mint authority (Critical)
      if (data?.mintAuthority) {
        rugFlags.push({ 
          flag: "Mint Authority Active", 
          risk: "high", 
          desc: "Token creator can mint unlimited new tokens, diluting your holdings",
          impact: 30
        });
        rugScore += 30;
      }

      // Check freeze authority (Critical)
      if (data?.freezeAuthority) {
        rugFlags.push({ 
          flag: "Freeze Authority Active", 
          risk: "high", 
          desc: "Creator can freeze your tokens at any time, preventing sales",
          impact: 25
        });
        rugScore += 25;
      }

      // Check holder concentration (High Risk)
      if (data?.topHolderPercent > 50) {
        rugFlags.push({ 
          flag: "Extreme Holder Concentration", 
          risk: "high", 
          desc: `Top holder owns ${data.topHolderPercent?.toFixed(1)}% of supply - massive dump risk`,
          impact: 25
        });
        rugScore += 25;
      } else if (data?.topHolderPercent > 30) {
        rugFlags.push({ 
          flag: "High Holder Concentration", 
          risk: "medium", 
          desc: `Top holder owns ${data.topHolderPercent?.toFixed(1)}% of supply`,
          impact: 15
        });
        rugScore += 15;
      }

      // Check liquidity (Medium Risk)
      if (data?.liquidity < 5000) {
        rugFlags.push({ 
          flag: "Very Low Liquidity", 
          risk: "high", 
          desc: "Less than $5k liquidity - extreme slippage and rug risk",
          impact: 20
        });
        rugScore += 20;
      } else if (data?.liquidity < 25000) {
        rugFlags.push({ 
          flag: "Low Liquidity", 
          risk: "medium", 
          desc: "Less than $25k liquidity - higher slippage risk",
          impact: 10
        });
        rugScore += 10;
      }

      // Check LP lock status
      if (!data?.lpLocked) {
        rugFlags.push({ 
          flag: "Liquidity Not Locked", 
          risk: "medium", 
          desc: "LP tokens can be withdrawn at any time",
          impact: 15
        });
        rugScore += 15;
      }

      // Check holder count
      if (data?.holders && data.holders < 100) {
        rugFlags.push({ 
          flag: "Very Few Holders", 
          risk: "medium", 
          desc: `Only ${data.holders} holders - low distribution`,
          impact: 10
        });
        rugScore += 10;
      }

      // Safe indicators
      if (!data?.mintAuthority) {
        rugFlags.push({ 
          flag: "Mint Disabled", 
          risk: "low", 
          desc: "No new tokens can be minted",
          impact: -5
        });
      }
      if (!data?.freezeAuthority) {
        rugFlags.push({ 
          flag: "Freeze Disabled", 
          risk: "low", 
          desc: "Tokens cannot be frozen",
          impact: -5
        });
      }
      if (data?.lpLocked) {
        rugFlags.push({ 
          flag: "Liquidity Locked", 
          risk: "low", 
          desc: "LP tokens are locked and cannot be withdrawn",
          impact: -10
        });
      }

      setAnalysis({
        ...data,
        rugFlags: rugFlags.sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.risk] - order[b.risk];
        }),
        rugScore: Math.min(Math.max(rugScore, 0), 100),
        isSafe: rugScore < 30,
      });

      toast({ title: "Rug analysis complete" });
    } catch (error) {
      console.error("Rug detection error:", error);
      toast({ title: "Error analyzing token", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { label: "EXTREME RISK", color: "text-red-500", bg: "bg-red-500/10 border-red-500/30" };
    if (score >= 50) return { label: "HIGH RISK", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30" };
    if (score >= 30) return { label: "MODERATE RISK", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/30" };
    return { label: "LOW RISK", color: "text-green-500", bg: "bg-green-500/10 border-green-500/30" };
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(tokenAddress);
    toast({ title: "Address copied" });
  };

  return (
    <Card className="og-glass-card-premium overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <span className="text-lg">Rug Detector Pro</span>
            <p className="text-sm font-normal text-muted-foreground">Advanced security analysis</p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Search Input */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Input
              placeholder="Enter Solana token address..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="h-12 pr-10 rounded-xl bg-white/[0.04] border-white/[0.07]"
            />
            {tokenAddress && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-10 w-10"
                onClick={copyAddress}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button 
            onClick={detectRug} 
            disabled={loading || !tokenAddress} 
            className="h-12 px-6 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
            <span className="ml-2">{loading ? "Scanning..." : "Scan Token"}</span>
          </Button>
        </div>

        {/* Results */}
        {analysis && (
          <div className="space-y-5 animate-fade-in">
            {/* Risk Score Header */}
            <div className={`p-5 rounded-2xl border ${getRiskLevel(analysis.rugScore).bg}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {analysis.isSafe ? (
                    <div className="p-2 rounded-xl bg-green-500/20">
                      <Shield className="h-6 w-6 text-green-500" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-red-500/20">
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                  )}
                  <div>
                    <span className={`text-xl font-bold ${getRiskLevel(analysis.rugScore).color}`}>
                      {getRiskLevel(analysis.rugScore).label}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {analysis.name || "Unknown"} ({analysis.symbol || "???"})
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                  <p className={`text-4xl font-bold ${getRiskLevel(analysis.rugScore).color}`}>
                    {analysis.rugScore}%
                  </p>
                </div>
              </div>
              <Progress 
                value={analysis.rugScore} 
                className="h-3 rounded-full" 
              />
            </div>

            {/* Token Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Price</span>
                </div>
                <p className="text-lg font-bold">${analysis.price?.toFixed(8) || 'N/A'}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Liquidity</span>
                </div>
                <p className="text-lg font-bold">${analysis.liquidity?.toLocaleString() || 'N/A'}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Holders</span>
                </div>
                <p className="text-lg font-bold">{analysis.holders?.toLocaleString() || 'N/A'}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-secondary" />
                  <span className="text-xs text-muted-foreground">Market Cap</span>
                </div>
                <p className="text-lg font-bold">${analysis.marketCap?.toLocaleString() || 'N/A'}</p>
              </div>
            </div>

            {/* Risk Flags */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Security Analysis
              </h4>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {analysis.rugFlags.map((flag, i) => (
                    <div 
                      key={i} 
                      className={`p-4 rounded-xl border flex items-start gap-3 ${
                        flag.risk === "high" 
                          ? "bg-red-500/5 border-red-500/20" 
                          : flag.risk === "medium"
                            ? "bg-yellow-500/5 border-yellow-500/20"
                            : "bg-green-500/5 border-green-500/20"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${
                        flag.risk === "high" 
                          ? "bg-red-500/20" 
                          : flag.risk === "medium"
                            ? "bg-yellow-500/20"
                            : "bg-green-500/20"
                      }`}>
                        {flag.risk === "low" ? (
                          <Check className={`h-4 w-4 text-green-500`} />
                        ) : (
                          <X className={`h-4 w-4 ${flag.risk === "high" ? "text-red-500" : "text-yellow-500"}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{flag.flag}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] ${
                              flag.risk === "high" 
                                ? "border-red-500/30 text-red-500" 
                                : flag.risk === "medium"
                                  ? "border-yellow-500/30 text-yellow-500"
                                  : "border-green-500/30 text-green-500"
                            }`}
                          >
                            {flag.risk.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{flag.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-11 rounded-xl"
                onClick={() => window.open(`https://dexscreener.com/solana/${tokenAddress}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on DexScreener
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 h-11 rounded-xl"
                onClick={() => window.open(`https://solscan.io/token/${tokenAddress}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Solscan
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!analysis && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-red-500/10 blur-2xl rounded-full" />
              <Shield className="relative h-16 w-16 mx-auto opacity-30" />
            </div>
            <p className="font-medium">Enter a token address to scan</p>
            <p className="text-sm">We'll analyze the token for potential rug pull risks</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};