import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, Globe, Twitter, Send, Copy, Star,
  DollarSign, AlertTriangle, CheckCircle, Sparkles,
  BarChart3, Droplets, Zap, ArrowUpRight, ArrowDownRight,
  Loader2, TrendingUp, Search, Users, Activity, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Submission {
  id: string;
  token_name: string;
  symbol: string;
  contract_address: string;
  launch_platform: string;
  launch_time: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  creator_wallet: string | null;
  banner_url: string | null;
  logo_url: string | null;
  status: string;
  promotion_tier: string;
  is_featured: boolean;
  ai_risk_score: number | null;
  liquidity_usd: number | null;
  holder_count: number | null;
  market_cap: number | null;
  created_at: string;
}

interface TokenLiveData {
  price: string;
  priceChange24h: number;
  priceChange6h?: number;
  priceChange1h: number;
  volume24h: number;
  volume6h?: number;
  volume1h?: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  buys24h?: number;
  sells24h?: number;
  txns24h?: { buys?: number; sells?: number };
  socials?: Array<{ type: string; url: string }>;
  websites?: Array<{ label: string; url: string }>;
  imageUrl?: string;
  dexId?: string;
  pairCreatedAt?: number;
  holderCount?: number;
  description?: string;
}

interface AIAnalysis {
  riskScore: number;
  summary: string;
  about?: string;
  pros: string[];
  cons: string[];
  recommendation: string;
  marketSentiment?: string;
  liquidityRating?: string;
  volumeRating?: string;
}

interface TokenDetailModalProps {
  token: Submission | null;
  tokenLiveData: TokenLiveData | null;
  aiAnalysis: AIAnalysis | null;
  loadingLiveData: boolean;
  onClose: () => void;
}

const getPlatformColor = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case "pump.fun": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
    case "raydium": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "jupiter": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "orca": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "meteora": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "moonshot": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const formatNumber = (num: number | null | undefined) => {
  if (num === null || num === undefined) return "N/A";
  if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatPrice = (price: string | number | null | undefined) => {
  if (!price) return "N/A";
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (num < 0.00001) return `$${num.toExponential(4)}`;
  if (num < 0.01) return `$${num.toFixed(8)}`;
  if (num < 1) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(4)}`;
};

export function TokenDetailModal({ 
  token, 
  tokenLiveData, 
  aiAnalysis, 
  loadingLiveData, 
  onClose 
}: TokenDetailModalProps) {
  if (!token) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toUpperCase()) {
      case "BULLISH": return "bg-green-500/20 text-green-400";
      case "BEARISH": return "bg-red-500/20 text-red-400";
      default: return "bg-yellow-500/20 text-yellow-400";
    }
  };

  const getRatingColor = (rating?: string) => {
    switch (rating?.toUpperCase()) {
      case "HIGH": return "text-green-400";
      case "LOW": return "text-red-400";
      default: return "text-yellow-400";
    }
  };

  const getRecommendationColor = (rec?: string) => {
    switch (rec?.toUpperCase()) {
      case "BUY": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "HOLD": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "CAUTION": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "AVOID": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  // Combine socials from live data and submission
  const allSocials = [
    ...(tokenLiveData?.socials || []),
  ];

  const allWebsites = [
    ...(tokenLiveData?.websites || []),
    ...(token.website ? [{ label: "Website", url: token.website }] : []),
  ];

  return (
    <Dialog open={!!token} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto p-0">
        {/* Banner */}
        <div className="h-32 lg:h-44 bg-gradient-to-br from-primary/20 to-secondary/10 relative">
          {token.banner_url && (
            <img src={token.banner_url} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        <div className="p-6 -mt-16 relative">
          {/* Header */}
          <div className="flex items-end gap-4 mb-6">
            {token.logo_url || tokenLiveData?.imageUrl ? (
              <img 
                src={token.logo_url || tokenLiveData?.imageUrl} 
                alt={token.symbol} 
                className="h-20 w-20 rounded-2xl object-cover ring-4 ring-background shadow-lg" 
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-2xl ring-4 ring-background shadow-lg">
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold">{token.token_name}</h2>
                <Badge variant="outline" className="text-sm">${token.symbol}</Badge>
                {token.is_featured && (
                  <Badge className="bg-yellow-500/20 text-yellow-500">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={getPlatformColor(token.launch_platform)}>
                  {token.launch_platform}
                </Badge>
                {tokenLiveData?.dexId && (
                  <Badge variant="outline" className="bg-muted/50">
                    {tokenLiveData.dexId}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Listed {formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}
                </span>
                {tokenLiveData?.pairCreatedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Pair: {formatDistanceToNow(new Date(tokenLiveData.pairCreatedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(token.contract_address)}>
                <Copy className="h-4 w-4 mr-1" />
                Copy CA
              </Button>
              <Button size="sm" asChild>
                <a href={`https://dexscreener.com/solana/${token.contract_address}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  DexScreener
                </a>
              </Button>
            </div>
          </div>

          {/* Live Data */}
          {loadingLiveData ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading live data...</p>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Price & Stats */}
              <div className="lg:col-span-2 space-y-4">
                {/* Price Card */}
                <Card className="glass-card">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Price</p>
                        <p className="text-3xl font-bold">
                          {formatPrice(tokenLiveData?.price)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {tokenLiveData?.priceChange24h !== undefined && (
                          <Badge className={tokenLiveData.priceChange24h >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                            {tokenLiveData.priceChange24h >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                            {Math.abs(tokenLiveData.priceChange24h).toFixed(2)}% 24h
                          </Badge>
                        )}
                        {tokenLiveData?.priceChange1h !== undefined && (
                          <Badge variant="outline" className={tokenLiveData.priceChange1h >= 0 ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}>
                            {tokenLiveData.priceChange1h >= 0 ? "+" : ""}{tokenLiveData.priceChange1h.toFixed(2)}% 1h
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs">Market Cap</span>
                        </div>
                        <p className="font-semibold">{formatNumber(tokenLiveData?.marketCap)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Droplets className="h-4 w-4" />
                          <span className="text-xs">Liquidity</span>
                        </div>
                        <p className="font-semibold">{formatNumber(tokenLiveData?.liquidity)}</p>
                        {aiAnalysis?.liquidityRating && (
                          <p className={`text-xs mt-0.5 ${getRatingColor(aiAnalysis.liquidityRating)}`}>
                            {aiAnalysis.liquidityRating}
                          </p>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <BarChart3 className="h-4 w-4" />
                          <span className="text-xs">24h Volume</span>
                        </div>
                        <p className="font-semibold">{formatNumber(tokenLiveData?.volume24h)}</p>
                        {aiAnalysis?.volumeRating && (
                          <p className={`text-xs mt-0.5 ${getRatingColor(aiAnalysis.volumeRating)}`}>
                            {aiAnalysis.volumeRating}
                          </p>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Zap className="h-4 w-4" />
                          <span className="text-xs">FDV</span>
                        </div>
                        <p className="font-semibold">{formatNumber(tokenLiveData?.fdv)}</p>
                      </div>
                    </div>

                    {/* Trading Activity */}
                    {(tokenLiveData?.buys24h !== undefined || tokenLiveData?.txns24h) && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">24h Trading Activity</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 rounded-lg bg-green-500/10">
                            <p className="text-xs text-muted-foreground">Buys</p>
                            <p className="font-semibold text-green-400">
                              {tokenLiveData?.buys24h || tokenLiveData?.txns24h?.buys || 0}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-red-500/10">
                            <p className="text-xs text-muted-foreground">Sells</p>
                            <p className="font-semibold text-red-400">
                              {tokenLiveData?.sells24h || tokenLiveData?.txns24h?.sells || 0}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/30">
                            <p className="text-xs text-muted-foreground">B/S Ratio</p>
                            <p className="font-semibold">
                              {(() => {
                                const buys = tokenLiveData?.buys24h || tokenLiveData?.txns24h?.buys || 0;
                                const sells = tokenLiveData?.sells24h || tokenLiveData?.txns24h?.sells || 1;
                                return (buys / sells).toFixed(2);
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Chart Embed */}
                <Card className="glass-card overflow-hidden">
                  <CardContent className="p-0">
                    <iframe
                      src={`https://dexscreener.com/solana/${token.contract_address}?embed=1&theme=dark&trades=0&info=0`}
                      className="w-full h-[400px] border-0"
                      title="DexScreener Chart"
                    />
                  </CardContent>
                </Card>

                {/* About Section */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      About
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {aiAnalysis?.about || tokenLiveData?.description || token.description || 
                        `${token.token_name} (${token.symbol}) is a Solana-based token available for trading.`}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* AI Analysis */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Analysis
                      </span>
                      {aiAnalysis?.marketSentiment && (
                        <Badge className={getSentimentColor(aiAnalysis.marketSentiment)}>
                          {aiAnalysis.marketSentiment}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {aiAnalysis ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Risk Score</span>
                          <Badge className={
                            aiAnalysis.riskScore >= 70 ? "bg-green-500/20 text-green-400" :
                            aiAnalysis.riskScore >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400"
                          }>
                            {aiAnalysis.riskScore}/100
                          </Badge>
                        </div>
                        
                        <p className="text-sm">{aiAnalysis.summary}</p>
                        
                        {aiAnalysis.pros?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-green-400 mb-2">Strengths</p>
                            <ul className="text-xs text-muted-foreground space-y-1.5">
                              {aiAnalysis.pros.map((pro: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {aiAnalysis.cons?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-red-400 mb-2">Risks</p>
                            <ul className="text-xs text-muted-foreground space-y-1.5">
                              {aiAnalysis.cons.map((con: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                                  {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Recommendation</p>
                          <Badge className={getRecommendationColor(aiAnalysis.recommendation)}>
                            {aiAnalysis.recommendation?.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Analyzing token...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Links */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Websites from API */}
                    {allWebsites.map((website, i) => (
                      <a 
                        key={`website-${i}`}
                        href={website.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="text-sm">{website.label || "Website"}</span>
                        <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                      </a>
                    ))}
                    
                    {/* Socials from API */}
                    {allSocials.map((social, i) => (
                      <a 
                        key={`social-${i}`}
                        href={social.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        {social.type === 'twitter' ? (
                          <Twitter className="h-4 w-4 text-primary" />
                        ) : social.type === 'telegram' ? (
                          <Send className="h-4 w-4 text-primary" />
                        ) : (
                          <Globe className="h-4 w-4 text-primary" />
                        )}
                        <span className="text-sm capitalize">{social.type}</span>
                        <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                      </a>
                    ))}
                    
                    {/* Fallback to submission data */}
                    {!allSocials.find(s => s.type === 'twitter') && token.twitter && (
                      <a 
                        href={`https://twitter.com/${token.twitter.replace("@", "")}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Twitter className="h-4 w-4 text-primary" />
                        <span className="text-sm">Twitter</span>
                        <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                      </a>
                    )}
                    
                    {!allSocials.find(s => s.type === 'telegram') && token.telegram && (
                      <a 
                        href={token.telegram.startsWith("http") ? token.telegram : `https://t.me/${token.telegram}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Send className="h-4 w-4 text-primary" />
                        <span className="text-sm">Telegram</span>
                        <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                      </a>
                    )}
                    
                    {/* Explorer Links */}
                    <a href={`https://dexscreener.com/solana/${token.contract_address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="text-sm">DexScreener</span>
                      <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                    </a>
                    <a href={`https://birdeye.so/token/${token.contract_address}?chain=solana`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm">Birdeye</span>
                      <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                    </a>
                    <a href={`https://solscan.io/token/${token.contract_address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <Search className="h-4 w-4 text-primary" />
                      <span className="text-sm">Solscan</span>
                      <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                    </a>
                    <a href={`https://pump.fun/${token.contract_address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-sm">Pump.fun</span>
                      <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                    </a>
                  </CardContent>
                </Card>

                {/* Contract */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Contract</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <code className="text-xs break-all">{token.contract_address}</code>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-3"
                      onClick={() => copyToClipboard(token.contract_address)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Address
                    </Button>
                  </CardContent>
                </Card>

                {/* Holder Info */}
                {tokenLiveData?.holderCount && (
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Holders</p>
                          <p className="font-semibold">{tokenLiveData.holderCount.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
