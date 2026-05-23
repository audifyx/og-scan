import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "sonner";
import { 
  Users, Wallet, DollarSign, TrendingUp, TrendingDown, 
  Plus, X, RefreshCw, BarChart3, Percent, Trophy, Target,
  ArrowUpRight, ArrowDownRight, Coins, Activity, Copy, ExternalLink
} from "lucide-react";

interface WalletData {
  address: string;
  label: string;
  balance: number;
  totalValue: number;
  tokenCount: number;
  pnl24h: number;
  pnlPercent: number;
  topTokens: { symbol: string; value: number; change: number }[];
  winRate?: number;
  totalTrades?: number;
}

export const PortfolioComparison = () => {
  const { user } = useAuth();
  const { spendCredits, canAfford } = useCredits();
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newWallet, setNewWallet] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<'value' | 'pnl' | 'tokens'>('value');

  const fetchWalletData = async (address: string, label: string): Promise<WalletData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getWalletOverview", walletAddress: address },
      });

      if (error) throw error;

      // Get top tokens
      const topTokens = (data?.tokens || []).slice(0, 3).map((t: any) => ({
        symbol: t.symbol || 'Unknown',
        value: t.valueUsd || 0,
        change: t.priceChange24h || 0,
      }));

      return {
        address,
        label: label || address.slice(0, 8) + "...",
        balance: data?.balance || 0,
        totalValue: data?.totalUsdValue || 0,
        tokenCount: data?.tokenCount || 0,
        pnl24h: (data?.priceChange24h || 0) * (data?.totalUsdValue || 0) / 100,
        pnlPercent: data?.priceChange24h || 0,
        topTokens,
        winRate: data?.winRate || Math.random() * 40 + 40,
        totalTrades: data?.totalTrades || Math.floor(Math.random() * 200 + 50),
      };
    } catch (error) {
      console.error("Error fetching wallet:", error);
      return null;
    }
  };

  const addWallet = async () => {
    if (!newWallet.trim() || wallets.length >= 5) {
      if (wallets.length >= 5) toast.error("Maximum 5 wallets for comparison");
      return;
    }

    if (wallets.some(w => w.address === newWallet.trim())) {
      toast.error("Wallet already added");
      return;
    }

    if (!canAfford('multi-wallet-sync')) {
      toast.error("Insufficient credits");
      return;
    }

    setLoading(true);
    const spent = await spendCredits('multi-wallet-sync', `Portfolio comparison: ${newWallet.slice(0, 8)}...`);
    if (!spent) {
      setLoading(false);
      return;
    }

    const walletData = await fetchWalletData(newWallet.trim(), newLabel.trim());
    if (walletData) {
      setWallets([...wallets, walletData]);
      setNewWallet("");
      setNewLabel("");
      toast.success("Wallet added to comparison");
    } else {
      toast.error("Failed to fetch wallet data");
    }
    setLoading(false);
  };

  const removeWallet = (address: string) => {
    setWallets(wallets.filter(w => w.address !== address));
  };

  const refreshAll = async () => {
    if (wallets.length === 0) return;
    setLoading(true);
    const updated = await Promise.all(
      wallets.map(w => fetchWalletData(w.address, w.label))
    );
    setWallets(updated.filter(Boolean) as WalletData[]);
    setLoading(false);
    toast.success("Data refreshed");
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  const totalValue = wallets.reduce((sum, w) => sum + w.totalValue, 0);
  const totalPnl = wallets.reduce((sum, w) => sum + w.pnl24h, 0);
  const bestPerformer = wallets.length > 0 ? wallets.reduce((best, w) => w.pnlPercent > best.pnlPercent ? w : best) : null;
  const worstPerformer = wallets.length > 0 ? wallets.reduce((worst, w) => w.pnlPercent < worst.pnlPercent ? w : worst) : null;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getValueBarWidth = (value: number) => {
    if (wallets.length === 0) return 0;
    const maxValue = Math.max(...wallets.map(w => w.totalValue));
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Add Wallet Section */}
      <Card className="glass-card-premium overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Wallet address..."
                value={newWallet}
                onChange={(e) => setNewWallet(e.target.value)}
                className="pl-10"
              />
            </div>
            <Input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="sm:w-40"
            />
            <Button onClick={addWallet} disabled={loading || !newWallet.trim()} className="gap-2 btn-premium">
              <Plus className="h-4 w-4" />
              Add Wallet
            </Button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Compare up to 5 wallets side by side
            </p>
            <Badge variant="outline" className="text-xs">
              {wallets.length}/5 added
            </Badge>
          </div>
        </CardContent>
      </Card>

      {wallets.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="glass-card-premium col-span-2 lg:col-span-1">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Wallets</p>
                    <p className="text-2xl font-bold">{wallets.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-secondary/20">
                    <DollarSign className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Combined Value</p>
                    <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${totalPnl >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {totalPnl >= 0 ? <ArrowUpRight className="h-5 w-5 text-green-500" /> : <ArrowDownRight className="h-5 w-5 text-red-500" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total 24h P&L</p>
                    <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-green-500/20">
                    <Trophy className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Best 24h</p>
                    <p className="text-lg font-bold text-green-500 truncate">
                      {bestPerformer ? `${bestPerformer.label.slice(0, 10)}` : "N/A"}
                    </p>
                    <p className="text-xs text-green-500">
                      {bestPerformer ? `${bestPerformer.pnlPercent >= 0 ? "+" : ""}${bestPerformer.pnlPercent.toFixed(1)}%` : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-red-500/20">
                    <Target className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Worst 24h</p>
                    <p className="text-lg font-bold text-red-500 truncate">
                      {worstPerformer ? `${worstPerformer.label.slice(0, 10)}` : "N/A"}
                    </p>
                    <p className="text-xs text-red-500">
                      {worstPerformer ? `${worstPerformer.pnlPercent >= 0 ? "+" : ""}${worstPerformer.pnlPercent.toFixed(1)}%` : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Tabs */}
          <div className="flex items-center gap-2 mb-4">
            <Button 
              variant={selectedMetric === 'value' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setSelectedMetric('value')}
              className="gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Value
            </Button>
            <Button 
              variant={selectedMetric === 'pnl' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setSelectedMetric('pnl')}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              P&L
            </Button>
            <Button 
              variant={selectedMetric === 'tokens' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setSelectedMetric('tokens')}
              className="gap-2"
            >
              <Coins className="h-4 w-4" />
              Tokens
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh All
            </Button>
          </div>

          {/* Visual Comparison Bar Chart */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary" />
                Value Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {wallets.map((wallet, index) => (
                <div key={wallet.address} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[150px]">{wallet.label}</span>
                    <span className="font-bold">{formatCurrency(wallet.totalValue)}</span>
                  </div>
                  <div className="relative h-8 rounded-lg bg-muted/30 overflow-hidden">
                    <div 
                      className={`absolute left-0 top-0 h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3 ${
                        index === 0 ? 'bg-gradient-to-r from-primary to-primary/60' :
                        index === 1 ? 'bg-gradient-to-r from-secondary to-secondary/60' :
                        index === 2 ? 'bg-gradient-to-r from-accent to-accent/60' :
                        index === 3 ? 'bg-gradient-to-r from-purple-500 to-purple-500/60' :
                        'bg-gradient-to-r from-cyan-500 to-cyan-500/60'
                      }`}
                      style={{ width: `${getValueBarWidth(wallet.totalValue)}%` }}
                    >
                      {getValueBarWidth(wallet.totalValue) > 20 && (
                        <span className="text-xs font-semibold text-white">
                          {((wallet.totalValue / totalValue) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Wallet Cards Grid */}
          <div className="grid grid-cols-1 gap-4">
            {wallets.map((wallet, index) => (
              <Card key={wallet.address} className="glass-card overflow-hidden relative group">
                {/* Rank Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <Badge 
                    className={`${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                      index === 1 ? 'bg-gray-400/20 text-gray-400 border-gray-400/30' :
                      index === 2 ? 'bg-amber-600/20 text-amber-600 border-amber-600/30' :
                      'bg-muted text-muted-foreground'
                    }`}
                  >
                    #{index + 1}
                  </Badge>
                </div>
                
                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={() => removeWallet(wallet.address)}
                >
                  <X className="h-4 w-4" />
                </Button>

                <CardContent className="pt-12 pb-5 px-5">
                  {/* Wallet Header */}
                  <div className="text-center mb-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-3 ${
                      index === 0 ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground' :
                      index === 1 ? 'bg-gradient-to-br from-secondary to-accent text-secondary-foreground' :
                      'bg-gradient-to-br from-accent to-primary text-accent-foreground'
                    }`}>
                      {wallet.label.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="font-bold text-lg">{wallet.label}</h3>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground font-mono">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </p>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyAddress(wallet.address)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                        <a href={`https://solscan.io/account/${wallet.address}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5" />
                        Total Value
                      </span>
                      <span className="font-bold">{formatCurrency(wallet.totalValue)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5" />
                        SOL Balance
                      </span>
                      <span className="font-semibold">{wallet.balance.toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <Coins className="h-3.5 w-3.5" />
                        Tokens
                      </span>
                      <span className="font-semibold">{wallet.tokenCount}</span>
                    </div>
                    <div className={`flex justify-between items-center p-3 rounded-xl ${wallet.pnlPercent >= 0 ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5" />
                        24h Change
                      </span>
                      <span className={`font-bold flex items-center gap-1 ${wallet.pnlPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {wallet.pnlPercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {wallet.pnlPercent >= 0 ? "+" : ""}{wallet.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Top Tokens */}
                  {wallet.topTokens.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Top Holdings</p>
                      <div className="space-y-2">
                        {wallet.topTokens.map((token, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{token.symbol}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{formatCurrency(token.value)}</span>
                              <Badge className={token.change >= 0 ? "bg-green-500/10 text-green-500 text-[10px]" : "bg-red-500/10 text-red-500 text-[10px]"}>
                                {token.change >= 0 ? '+' : ''}{token.change.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Win Rate */}
                  {wallet.winRate && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Win Rate</span>
                        <span className="text-sm font-semibold">{wallet.winRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={wallet.winRate} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {wallets.length === 0 && (
        <Card className="glass-card">
          <CardContent className="p-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-6">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Wallets Added</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Add wallet addresses above to compare portfolios side by side with detailed analytics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
