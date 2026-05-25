import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Copy, ExternalLink, TrendingUp, TrendingDown, BarChart3, Droplets,
  Users, Shield, Check, Loader2,
  DollarSign, Activity, Globe, Twitter
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
  imageUrl?: string;
  socials?: Array<{ type: string; url: string }>;
  websites?: Array<{ label: string; url: string }>;
  pairAddress?: string;
}

export const TokenDetailPopup = ({
  open,
  onOpenChange,
  tokenAddress,
  tokenName,
  tokenSymbol,
}: TokenDetailPopupProps) => {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && tokenAddress) {
      fetchTokenData();
    }
  }, [open, tokenAddress]);

  const fetchTokenData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}`);
      const pairs = await res.json();
      const pair = Array.isArray(pairs) ? pairs[0] : null;
      if (pair) {
        setTokenData({
          name: pair.baseToken?.name || tokenName,
          symbol: pair.baseToken?.symbol || tokenSymbol,
          price: pair.priceUsd || "0",
          priceChange24h: parseFloat(pair.priceChange?.h24 ?? "0"),
          priceChange1h: parseFloat(pair.priceChange?.h1 ?? "0"),
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
          marketCap: pair.marketCap || 0,
          fdv: pair.fdv || 0,
          imageUrl: pair.info?.imageUrl,
          socials: pair.info?.socials,
          websites: pair.info?.websites,
          pairAddress: pair.pairAddress,
        });
      }
    } catch (error) {
      console.error("Error fetching token data:", error);
      toast.error("Failed to load token data");
    } finally {
      setLoading(false);
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

  const displayName = tokenData?.name || tokenName || "Unknown Token";
  const displaySymbol = tokenData?.symbol || tokenSymbol || "???";
  const chartAddr = tokenData?.pairAddress || tokenAddress;

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
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="chart">Chart</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {/* Price & Change */}
                  <Card className="bg-white/[0.04] border-white/[0.08]">
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
                      { icon: DollarSign, label: "FDV", value: formatNumber(tokenData?.fdv) },
                    ].map((stat, i) => (
                      <Card key={i} className="bg-white/[0.04] border-white/[0.06]">
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
                  <Card className="overflow-hidden border-white/[0.08]">
                    <div className="aspect-video">
                      <iframe
                        src={`https://dexscreener.com/solana/${chartAddr}?embed=1&theme=dark&trades=0&info=0`}
                        className="w-full h-full"
                        title={`${displaySymbol} Chart`}
                        allow="clipboard-write"
                      />
                    </div>
                  </Card>
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
