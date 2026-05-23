import { useState } from "react";
import { Wallet, Search, RefreshCw, TrendingUp, DollarSign, Coins, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface WalletStats {
  currentValue: number;
  solBalance: number;
  tokenCount: number;
  tradeCount: number;
  estimatedPnL: number;
  winRate: string;
}

export const WalletProfiler = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<WalletStats | null>(null);

  const analyzeWallet = async () => {
    if (!walletAddress || walletAddress.length < 32) {
      toast.error("Enter a valid wallet address");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('solana-tracker', {
        body: { action: 'getWalletPnL', walletAddress },
      });
      if (error) throw error;
      setStats(data);
      toast.success("Wallet analyzed");
    } catch (error) {
      console.error('Error analyzing wallet:', error);
      toast.error("Failed to analyze wallet");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <Card className="glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Wallet Profiler
        </CardTitle>
        <p className="text-sm text-muted-foreground">Analyze any wallet's performance</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter wallet address..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyzeWallet()}
              className="pl-10"
            />
          </div>
          <Button onClick={analyzeWallet} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
          </Button>
        </div>

        {stats && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Portfolio Value</span>
                </div>
                <p className="text-xl font-bold">{formatNumber(stats.currentValue)}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Coins className="h-4 w-4" />
                  <span className="text-xs">SOL Balance</span>
                </div>
                <p className="text-xl font-bold">{stats.solBalance.toFixed(4)}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs">Trades</span>
                </div>
                <p className="text-xl font-bold">{stats.tradeCount}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Win Rate</span>
                </div>
                <p className="text-xl font-bold text-primary">{stats.winRate}%</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Token Holdings</span>
                <Badge variant="secondary">{stats.tokenCount} tokens</Badge>
              </div>
            </div>
          </div>
        )}

        {!stats && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Enter a wallet address to analyze</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
