import { useState } from "react";
import { Droplets, Search, RefreshCw, ExternalLink, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Pool {
  dex: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string };
  quoteToken: { name: string; symbol: string };
  liquidity: number;
  volume24h: number;
  priceUsd: string;
  url: string;
}

export const LiquidityScanner = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);

  const scanLiquidity = async () => {
    if (!tokenAddress || tokenAddress.length < 32) {
      toast.error("Enter a valid token address");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('solana-tracker', {
        body: { action: 'getLiquidityPools', tokenAddress },
      });
      if (error) throw error;
      setPools(data.pools || []);
      toast.success(`Found ${data.pools?.length || 0} pools`);
    } catch (error) {
      console.error('Error scanning liquidity:', error);
      toast.error("Failed to scan liquidity");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const totalLiquidity = pools.reduce((sum, p) => sum + p.liquidity, 0);
  const totalVolume = pools.reduce((sum, p) => sum + p.volume24h, 0);

  return (
    <Card className="og-glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          Liquidity Scanner
        </CardTitle>
        <p className="text-sm text-muted-foreground">Check liquidity across all DEXs</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter token address..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scanLiquidity()}
              className="pl-10"
            />
          </div>
          <Button onClick={scanLiquidity} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Scan"}
          </Button>
        </div>

        {pools.length > 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.04]">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Total Liquidity</span>
                </div>
                <p className="text-xl font-bold text-primary">{formatNumber(totalLiquidity)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.04]">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs">24h Volume</span>
                </div>
                <p className="text-xl font-bold">{formatNumber(totalVolume)}</p>
              </div>
            </div>

            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {pools.map((pool, index) => (
                  <div 
                    key={pool.pairAddress}
                    className="p-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer"
                    onClick={() => window.open(pool.url, '_blank')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {pool.dex.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-sm">
                          {pool.baseToken.symbol}/{pool.quoteToken.symbol}
                        </span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Liquidity: </span>
                        <span className="font-medium">{formatNumber(pool.liquidity)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Volume: </span>
                        <span className="font-medium">{formatNumber(pool.volume24h)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Price: </span>
                        <span className="font-medium">${parseFloat(pool.priceUsd).toFixed(6)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {pools.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Droplets className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Enter a token address to scan liquidity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
