import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { User, RefreshCw, AlertTriangle, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";

export const TokenCreatorTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<any>(null);

  const trackCreator = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });

      const txs = data?.transactions || [];
      const deployments = txs.filter((tx: any) => 
        tx.type?.toLowerCase().includes("create") || 
        tx.type?.toLowerCase().includes("mint") ||
        tx.type?.toLowerCase().includes("initialize")
      );

      setCreatorInfo({
        totalDeployments: deployments.length,
        isActiveDeployer: deployments.length > 3,
        recentDeployments: deployments.slice(0, 5),
        riskLevel: deployments.length > 10 ? "high" : deployments.length > 3 ? "medium" : "low",
      });

      toast({ title: "Analysis complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-pink-500/10">
          <User className="h-5 w-5 text-pink-500" />
        </div>
        <div>
          <h3 className="font-semibold">Token Creator Tracker</h3>
          <p className="text-sm text-muted-foreground">Track wallets that deploy tokens</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={trackCreator} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Track"}
        </Button>
      </div>

      {creatorInfo && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04]">
            <div>
              <p className="text-xs text-muted-foreground">Token Deployments</p>
              <p className="text-xl font-bold">{creatorInfo.totalDeployments}</p>
            </div>
            <Badge 
              variant={creatorInfo.riskLevel === "high" ? "destructive" : creatorInfo.riskLevel === "medium" ? "secondary" : "default"}
            >
              {creatorInfo.riskLevel === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {creatorInfo.riskLevel === "low" && <Shield className="h-3 w-3 mr-1" />}
              {creatorInfo.riskLevel.toUpperCase()} RISK
            </Badge>
          </div>

          {creatorInfo.isActiveDeployer && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <p className="text-sm font-medium text-yellow-500">Active Token Deployer</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">This wallet has created multiple tokens</p>
            </div>
          )}

          {creatorInfo.recentDeployments?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Recent Deployments</p>
              {creatorInfo.recentDeployments.map((tx: any, i: number) => (
                <div key={i} className="p-2 rounded bg-white/[0.04] text-xs">
                  <p className="font-mono">{formatAddress(tx.signature, 8)}</p>
                  <p className="text-muted-foreground">{tx.type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
