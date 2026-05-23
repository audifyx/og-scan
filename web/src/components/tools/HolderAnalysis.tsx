import { useState } from "react";
import { Users, Search, RefreshCw, Copy, Check, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Holder {
  rank: number;
  address: string;
  amount: number;
  percent: string;
}

export const HolderAnalysis = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [totalSupply, setTotalSupply] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const analyzeHolders = async () => {
    if (!tokenAddress || tokenAddress.length < 32) {
      toast.error("Enter a valid token address");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('solana-tracker', {
        body: { action: 'getTokenHolders', tokenAddress },
      });
      if (error) throw error;
      setHolders(data.holders || []);
      setTotalSupply(data.totalSupply || 0);
      toast.success("Holders analyzed");
    } catch (error) {
      console.error('Error analyzing holders:', error);
      toast.error("Failed to analyze holders");
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const top10Percent = holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percent), 0);

  return (
    <Card className="og-glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Holder Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">Deep dive into token holder distribution</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter token address..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyzeHolders()}
              className="pl-10"
            />
          </div>
          <Button onClick={analyzeHolders} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
          </Button>
        </div>

        {holders.length > 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04]">
              <span className="text-sm">Top 10 Holders Control</span>
              <span className={`font-bold ${top10Percent > 50 ? 'text-red-500' : 'text-green-500'}`}>
                {top10Percent.toFixed(1)}%
              </span>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {holders.map((holder) => (
                  <div 
                    key={holder.address}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        holder.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {holder.rank}
                      </span>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto font-mono text-sm"
                          onClick={() => copyAddress(holder.address)}
                        >
                          {formatAddress(holder.address)}
                          {copied === holder.address ? (
                            <Check className="h-3 w-3 ml-1 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(holder.amount)} tokens
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{holder.percent}%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(`https://solscan.io/account/${holder.address}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {holders.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Enter a token address to analyze holders</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
