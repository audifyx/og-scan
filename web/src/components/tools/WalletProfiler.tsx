import { useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Search, RefreshCw, TrendingUp, DollarSign, Coins, Activity, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { solanaTracker } from "@/lib/solana-tools";

interface WalletStats {
  currentValue: number;
  solBalance: number;
  tokenCount: number;
  tradeCount: number;
  estimatedPnL: number;
  winRate: string;
  realizedPnlUsd?: number;
  unrealizedPnlUsd?: number;
  address?: string;
}

const n = (v: unknown, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

export const WalletProfiler = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<WalletStats | null>(null);

  const analyzeWallet = async () => {
    const addr = walletAddress.trim();
    if (!addr || addr.length < 32) {
      toast.error("Enter a valid wallet address");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await solanaTracker("getWalletPnL", { walletAddress: addr });
      if (error) throw new Error(error.message || "Analyze failed");
      if (!data) throw new Error("No wallet data");
      setStats({
        currentValue: n(data.currentValue),
        solBalance: n(data.solBalance),
        tokenCount: n(data.tokenCount),
        tradeCount: n(data.tradeCount ?? data.swapCount),
        estimatedPnL: n(data.estimatedPnL ?? data.totalPnL ?? data.netUsd),
        winRate: String(data.winRate ?? "0"),
        realizedPnlUsd: n(data.realizedPnlUsd),
        unrealizedPnlUsd: n(data.unrealizedPnlUsd),
        address: data.address || addr,
      });
      toast.success("Wallet analyzed");
    } catch (error) {
      console.error("Error analyzing wallet:", error);
      setStats(null);
      toast.error(error instanceof Error ? error.message : "Failed to analyze wallet");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    const v = n(num);
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };

  return (
    <Card className="og-glass-card h-full">
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
              onKeyDown={(e) => e.key === "Enter" && analyzeWallet()}
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
              <div className="p-3 rounded-lg bg-white/[0.04]">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Portfolio Value</span>
                </div>
                <p className="text-xl font-bold">{formatNumber(stats.currentValue)}</p>
              </div>

              <div className="p-3 rounded-lg bg-white/[0.04]">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Coins className="h-4 w-4" />
                  <span className="text-xs">SOL Balance</span>
                </div>
                <p className="text-xl font-bold">{n(stats.solBalance).toFixed(4)}</p>
              </div>

              <div className="p-3 rounded-lg bg-white/[0.04]">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs">Closed trades</span>
                </div>
                <p className="text-xl font-bold">{stats.tradeCount}</p>
              </div>

              <div className="p-3 rounded-lg bg-white/[0.04]">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Win Rate</span>
                </div>
                <p className="text-xl font-bold text-primary">{stats.winRate}%</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated PnL</span>
                <span
                  className={`font-bold ${n(stats.estimatedPnL) >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {formatNumber(stats.estimatedPnL)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Realized {formatNumber(stats.realizedPnlUsd ?? 0)}</span>
                <span>Unrealized {formatNumber(stats.unrealizedPnlUsd ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Token Holdings</span>
                <Badge variant="secondary">{stats.tokenCount} tokens</Badge>
              </div>
            </div>

            {stats.address && (
              <Link
                to={`/trade/wallet/${stats.address}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open full portfolio <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
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
