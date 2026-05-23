import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { Gauge, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const FeeAnalyzer = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [feeAnalysis, setFeeAnalysis] = useState<any>(null);

  const analyzeFees = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });

      const txs = data?.transactions || [];
      const fees = txs.map((tx: any) => tx.fee || 5000).filter((f: number) => f > 0);

      if (fees.length === 0) {
        toast({ title: "No fee data available" });
        setLoading(false);
        return;
      }

      const avgFee = fees.reduce((a: number, b: number) => a + b, 0) / fees.length;
      const maxFee = Math.max(...fees);
      const minFee = Math.min(...fees);
      
      // Categorize fee usage
      const lowFees = fees.filter((f: number) => f <= 5000).length;
      const medFees = fees.filter((f: number) => f > 5000 && f <= 50000).length;
      const highFees = fees.filter((f: number) => f > 50000).length;

      setFeeAnalysis({
        avgFee,
        maxFee,
        minFee,
        totalTxs: fees.length,
        lowFees,
        medFees,
        highFees,
        efficiency: lowFees > fees.length * 0.7 ? "Efficient" : highFees > fees.length * 0.3 ? "Aggressive" : "Balanced",
      });

      toast({ title: "Fee analysis complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Gauge className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="font-semibold">Fee Analyzer</h3>
          <p className="text-sm text-muted-foreground">Priority fee patterns & efficiency</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={analyzeFees} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
        </Button>
      </div>

      {feeAnalysis && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
            <span className="text-sm font-medium">Fee Strategy</span>
            <Badge variant="secondary">{feeAnalysis.efficiency}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.04] text-center">
              <p className="text-xs text-muted-foreground">Avg Fee</p>
              <p className="font-bold">{(feeAnalysis.avgFee / 1e9).toFixed(6)}</p>
              <p className="text-xs text-muted-foreground">SOL</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.04] text-center">
              <p className="text-xs text-muted-foreground">Max Fee</p>
              <p className="font-bold">{(feeAnalysis.maxFee / 1e9).toFixed(6)}</p>
              <p className="text-xs text-muted-foreground">SOL</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.04] text-center">
              <p className="text-xs text-muted-foreground">Min Fee</p>
              <p className="font-bold">{(feeAnalysis.minFee / 1e9).toFixed(6)}</p>
              <p className="text-xs text-muted-foreground">SOL</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Fee Distribution</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Low Priority</span>
                <span>{feeAnalysis.lowFees} txns</span>
              </div>
              <Progress value={(feeAnalysis.lowFees / feeAnalysis.totalTxs) * 100} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Medium Priority</span>
                <span>{feeAnalysis.medFees} txns</span>
              </div>
              <Progress value={(feeAnalysis.medFees / feeAnalysis.totalTxs) * 100} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>High Priority</span>
                <span>{feeAnalysis.highFees} txns</span>
              </div>
              <Progress value={(feeAnalysis.highFees / feeAnalysis.totalTxs) * 100} className="h-2" />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
