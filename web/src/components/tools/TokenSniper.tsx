import { useState, useEffect } from "react";
import { Crosshair, RefreshCw, ExternalLink, TrendingUp, Droplets, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { solanaTracker } from "@/lib/solana-tools";

interface NewPair {
  tokenAddress: string;
  name: string;
  symbol: string;
  url: string;
  icon?: string;
  price?: string;
  priceChange?: number;
  volume?: number;
  liquidity?: number;
  marketCap?: number;
  createdAt?: number;
}

export const TokenSniper = () => {
  const [pairs, setPairs] = useState<NewPair[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNewPairs = async () => {
    setLoading(true);
    try {
      const { data, error } = await solanaTracker("getNewPairs");
      if (error) throw error;
      setPairs(data.pairs || []);
    } catch (error) {
      console.error('Error fetching pairs:', error);
      toast.error("Failed to fetch new pairs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewPairs();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <Card className="og-glass-card h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            Token Sniper
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchNewPairs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Latest token launches on Solana</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pairs.length > 0 ? (
            <div className="space-y-3">
              {pairs.map((pair, index) => (
                <div 
                  key={pair.tokenAddress}
                  className="p-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer"
                  onClick={() => window.open(pair.url, '_blank')}
                >
                  <div className="flex items-start gap-3">
                    {pair.icon && (
                      <img 
                        src={pair.icon} 
                        alt={pair.symbol}
                        className="h-10 w-10 rounded-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{pair.symbol || 'Unknown'}</span>
                        {pair.priceChange !== undefined && (
                          <Badge 
                            variant={pair.priceChange >= 0 ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {pair.priceChange >= 0 ? '+' : ''}{pair.priceChange.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{pair.name}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Price: </span>
                      <span className="font-medium">${parseFloat(pair.price || '0').toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liq: </span>
                      <span className="font-medium">{formatNumber(pair.liquidity || 0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">MCap: </span>
                      <span className="font-medium">{formatNumber(pair.marketCap || 0)}</span>
                    </div>
                  </div>
                  {pair.createdAt && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(pair.createdAt), { addSuffix: true })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No new pairs found
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
