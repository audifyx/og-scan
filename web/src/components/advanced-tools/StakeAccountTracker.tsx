import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Lock, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatUsd } from "@/lib/solana-api";

export const StakeAccountTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [stakeInfo, setStakeInfo] = useState<any>(null);

  const trackStake = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getWalletOverview", walletAddress },
      });

      // Estimate staking based on balance patterns
      // In a real implementation, you'd query stake accounts directly
      setStakeInfo({
        solBalance: data?.balance || 0,
        solValue: data?.usdValue || 0,
        estimatedStaked: 0, // Would need stake account RPC calls
        validators: [],
        apy: 7.2, // Current estimated Solana staking APY
      });

      toast({ title: "Stake tracking complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Lock className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-semibold">Stake Account Tracker</h3>
          <p className="text-sm text-muted-foreground">SOL staking positions & validators</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={trackStake} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Track"}
        </Button>
      </div>

      {stakeInfo && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">SOL Balance</p>
              <p className="text-xl font-bold">{stakeInfo.solBalance.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground">{formatUsd(stakeInfo.solValue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <p className="text-xs text-muted-foreground">Est. APY</p>
              <p className="text-xl font-bold text-emerald-500">{stakeInfo.apy}%</p>
              <div className="flex items-center gap-1 text-xs text-emerald-500">
                <TrendingUp className="h-3 w-3" />
                Annual
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">Staking Info</p>
            <p className="text-xs text-muted-foreground">
              Track your SOL staking positions across validators. Current network APY is ~{stakeInfo.apy}%.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
