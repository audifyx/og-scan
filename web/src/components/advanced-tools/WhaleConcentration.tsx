import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { PieChart, RefreshCw, AlertTriangle, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";

export const WhaleConcentration = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [holders, setHolders] = useState<any>(null);

  const analyzeConcentration = async () => {
    if (!tokenAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTokenHolders", tokenAddress },
      });

      const topHolders = data?.holders || [];
      const totalPercent = topHolders.reduce((acc: number, h: any) => acc + (h.percentage || 0), 0);
      const top10Percent = topHolders.slice(0, 10).reduce((acc: number, h: any) => acc + (h.percentage || 0), 0);

      setHolders({
        list: topHolders.slice(0, 15),
        totalHolders: data?.totalHolders || topHolders.length,
        top10Percent,
        isHighlyConcentrated: top10Percent > 50,
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
        <div className="p-2 rounded-lg bg-amber-500/10">
          <PieChart className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold">Whale Concentration</h3>
          <p className="text-sm text-muted-foreground">Analyze top holder distribution</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter token address..."
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
        />
        <Button onClick={analyzeConcentration} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
        </Button>
      </div>

      {holders && (
        <div className="space-y-4">
          {holders.isHighlyConcentrated && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-500">High Whale Concentration</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Holders</p>
              <p className="text-xl font-bold">{holders.totalHolders.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Top 10 Hold</p>
              <p className="text-xl font-bold">{holders.top10Percent.toFixed(1)}%</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Top Holders</p>
            </div>
            {holders.list.map((holder: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                  {i + 1}
                </Badge>
                <code className="text-xs font-mono flex-1">{formatAddress(holder.address, 6)}</code>
                <div className="w-24">
                  <Progress value={holder.percentage || 0} className="h-2" />
                </div>
                <span className="text-xs w-12 text-right">{(holder.percentage || 0).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
