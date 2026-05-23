import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Layers, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatUsd } from "@/lib/solana-api";

export const LPPositionScanner = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);

  const scanPositions = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getAssets", walletAddress },
      });

      // Filter for LP tokens
      const lpTokens = data?.items?.filter((item: any) => {
        const name = item.content?.metadata?.name?.toLowerCase() || "";
        return name.includes("lp") || name.includes("pool") || name.includes("liquidity");
      }) || [];

      setPositions(lpTokens.map((lp: any) => ({
        name: lp.content?.metadata?.name || "LP Token",
        symbol: lp.content?.metadata?.symbol || "LP",
        balance: (lp.token_info?.balance || 0) / Math.pow(10, lp.token_info?.decimals || 0),
        value: lp.token_info?.price_info?.total_price || 0,
      })));

      toast({ title: "Scan complete", description: `Found ${lpTokens.length} LP positions` });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Layers className="h-5 w-5 text-purple-500" />
        </div>
        <div>
          <h3 className="font-semibold">LP Position Scanner</h3>
          <p className="text-sm text-muted-foreground">Raydium & Meteora liquidity positions</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={scanPositions} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Scan"}
        </Button>
      </div>

      {positions.length > 0 ? (
        <div className="space-y-2">
          {positions.map((pos, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/[0.04] flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{pos.name}</p>
                <p className="text-xs text-muted-foreground">{pos.balance.toFixed(6)} {pos.symbol}</p>
              </div>
              <Badge variant="outline" className="text-green-500">
                {formatUsd(pos.value)}
              </Badge>
            </div>
          ))}
        </div>
      ) : !loading && walletAddress && (
        <p className="text-sm text-muted-foreground text-center py-4">No LP positions found</p>
      )}
    </Card>
  );
};
