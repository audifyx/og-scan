import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Zap, RefreshCw, AlertTriangle, Bot } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const MEVTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [mevAnalysis, setMevAnalysis] = useState<any>(null);

  const trackMEV = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });

      const txs = data?.transactions || [];
      
      // Analyze for MEV patterns
      let jitoCount = 0;
      let highPriorityCount = 0;
      let sandwichSuspect = 0;

      txs.forEach((tx: any) => {
        // Check for Jito bundles (would need specific program detection)
        if (tx.fee && tx.fee > 5000) {
          highPriorityCount++;
        }
        // Simplified sandwich detection
        if (tx.type?.toLowerCase().includes("swap") && tx.fee > 10000) {
          sandwichSuspect++;
        }
      });

      setMevAnalysis({
        totalTxs: txs.length,
        jitoCount,
        highPriorityCount,
        sandwichSuspect,
        mevScore: Math.min(((highPriorityCount + sandwichSuspect) / txs.length) * 100, 100),
        isLikelyBot: highPriorityCount > txs.length * 0.3,
      });

      toast({ title: "MEV analysis complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-yellow-500/10">
          <Zap className="h-5 w-5 text-yellow-500" />
        </div>
        <div>
          <h3 className="font-semibold">MEV Tracker</h3>
          <p className="text-sm text-muted-foreground">Detect Jito bundles & MEV techniques</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={trackMEV} disabled={loading} className="bg-yellow-500 hover:bg-yellow-600 text-black">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Track"}
        </Button>
      </div>

      {mevAnalysis && (
        <div className="space-y-4">
          {mevAnalysis.isLikelyBot && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
              <Bot className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-500">Likely Bot/MEV Wallet</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">High Priority TXs</p>
              <p className="text-xl font-bold">{mevAnalysis.highPriorityCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">MEV Score</p>
              <p className="text-xl font-bold">{mevAnalysis.mevScore.toFixed(1)}%</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-2">Analysis Details</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total Transactions</span>
                <span>{mevAnalysis.totalTxs}</span>
              </div>
              <div className="flex justify-between">
                <span>Sandwich Suspects</span>
                <span>{mevAnalysis.sandwichSuspect}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
